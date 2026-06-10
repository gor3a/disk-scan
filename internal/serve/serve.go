package serve

import (
	"bufio"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"sync"

	"github.com/gor3a/disk-scan/internal/apps"
	"github.com/gor3a/disk-scan/internal/clean"
	"github.com/gor3a/disk-scan/internal/engine"
	"github.com/gor3a/disk-scan/internal/rules"
	"github.com/gor3a/disk-scan/internal/scan"
)

// Run reads newline-delimited JSON requests from in and writes JSON events to
// out. It is the GUI sidecar entry point (`dscan serve`). Requests are read on
// a separate goroutine so a `cancel` arriving mid-scan is acted on immediately;
// scan and clean run asynchronously. Run returns once in is exhausted and all
// in-flight work has drained.
func Run(in io.Reader, out io.Writer, goos, home string) error {
	s := &server{home: home, goos: goos, enc: json.NewEncoder(out), byID: map[string]rules.Item{}}

	reqs := make(chan Request, 8)
	go func() {
		sc := bufio.NewScanner(in)
		sc.Buffer(make([]byte, 1024*1024), 4*1024*1024)
		for sc.Scan() {
			var req Request
			if err := json.Unmarshal(sc.Bytes(), &req); err != nil {
				s.emit(Event{Event: "error", Message: "bad request: " + err.Error()})
				continue
			}
			reqs <- req
		}
		close(reqs)
	}()

	for req := range reqs {
		switch req.Cmd {
		case "scan":
			s.startScan(req)
		case "map":
			s.startMap(req)
		case "clean":
			s.startClean(req.IDs, req.DryRun, req.KillLockers)
		case "trash":
			s.trashPath(req.Path)
		case "cancel":
			s.cancelScan()
		case "apps":
			s.startApps()
		case "appLeftovers":
			s.appLeftovers(req.Path)
		case "uninstall":
			s.uninstall(req.Paths)
		}
	}
	s.wg.Wait()
	return nil
}

type server struct {
	home, goos string
	enc        *json.Encoder
	mu         sync.Mutex // guards enc + byID + cancel
	byID       map[string]rules.Item
	cancel     chan struct{}
	wg         sync.WaitGroup // all in-flight ops (drained before Run returns)
}

func (s *server) emit(e Event) {
	s.mu.Lock()
	defer s.mu.Unlock()
	_ = s.enc.Encode(e) // Encoder appends the newline
}

func (s *server) startScan(req Request) {
	s.cancelScan() // supersede any in-flight scan
	cancel := make(chan struct{})
	s.mu.Lock()
	s.cancel = cancel
	s.byID = map[string]rules.Item{}
	s.mu.Unlock()

	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		if req.Kind == "projects" {
			s.runScanProjects(req.Root, cancel, req.Excludes)
		} else {
			s.runScan(req.System, cancel, req.Excludes)
		}
	}()
}

func (s *server) startMap(req Request) {
	s.cancelScan()
	cancel := make(chan struct{})
	s.mu.Lock()
	s.cancel = cancel
	s.mu.Unlock()

	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		root := req.Root
		if root == "" {
			root = s.home
		}
		node := engine.BuildSizeTree(root, req.Excludes, func(scanned int, bytes int64, path string) {
			s.emit(Event{Event: "progress", Phase: "map", Scanned: scanned, Bytes: bytes, Path: path})
		}, cancel)
		aborted := false
		select {
		case <-cancel:
			aborted = true
		default:
		}
		if !aborted {
			s.emit(Event{Event: "tree", Path: root, Node: node})
		}
	}()
}

func (s *server) trashPath(path string) {
	if path == "" || !filepath.IsAbs(path) {
		s.emit(Event{Event: "cleanResult", Errors: []string{"invalid path"}})
		return
	}
	if _, err := os.Stat(path); err != nil {
		s.emit(Event{Event: "cleanResult", Errors: []string{err.Error()}})
		return
	}
	size, _ := scan.DirSizeCancel(path, nil)
	if err := clean.Trash(path); err != nil {
		s.emit(Event{Event: "cleanResult", Errors: []string{err.Error()}})
		return
	}
	s.emit(Event{Event: "cleanResult", Trashed: size})
}

func (s *server) runScanProjects(root string, cancel <-chan struct{}, excludes []string) {
	if root == "" {
		root = s.home
	}
	if d, err := engine.DiskUsage(root); err == nil {
		s.emit(Event{Event: "disk", Disk: &diskInfo{Used: d.Used, Free: d.Free, Total: d.Total}})
	}
	n := 0
	var bytes int64
	engine.FindProjects(root, func(p engine.Project) {
		dto := projectDTO(p)
		s.mu.Lock()
		s.byID[dto.ID] = rules.Item{Path: p.Path, Label: dto.Label, Bytes: p.Bytes, Tier: rules.Safe, Method: rules.Remove}
		s.mu.Unlock()
		s.emit(Event{Event: "item", Item: &dto})
		n++
		bytes += p.Bytes
		s.emit(Event{Event: "progress", Phase: "projects", Scanned: n, Bytes: bytes, Path: p.Path})
	}, cancel, excludes)
	s.emit(Event{Event: "scanDone", Reclaimable: bytes})
}

func (s *server) runScan(system bool, cancel <-chan struct{}, excludes []string) {
	if d, err := engine.DiskUsage(s.home); err == nil {
		s.emit(Event{Event: "disk", Disk: &diskInfo{Used: d.Used, Free: d.Free, Total: d.Total}})
	}

	n := 0
	var bytes int64
	items := engine.ScanAll(s.goos, s.home, system, func(it rules.Item) {
		dto := ToDTO(it)
		s.mu.Lock()
		s.byID[dto.ID] = it
		s.mu.Unlock()
		s.emit(Event{Event: "item", Item: &dto})
		n++
		bytes += it.Bytes
		phase := "caches"
		if it.Source == rules.Heuristic {
			phase = "largeFiles"
		}
		s.emit(Event{Event: "progress", Phase: phase, Scanned: n, Bytes: bytes})
	}, cancel, excludes)

	// Reclaimable matches the GUI's default selection: SAFE, regenerable,
	// path-backed items (never tool-commands).
	var total int64
	for _, it := range items {
		if it.Tier == rules.Safe && it.Path != "" && it.EffectiveMethod() == rules.Remove {
			total += it.Bytes
		}
	}
	s.emit(Event{Event: "scanDone", Reclaimable: total})
}

func (s *server) startClean(ids []string, dryRun, kill bool) {
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		// No barrier: clean acts on whatever the scan has streamed into byID so
		// far, so the user can clean found items while the scan keeps running.
		s.mu.Lock()
		var items []rules.Item
		var paths []string
		for _, id := range ids {
			if it, ok := s.byID[id]; ok {
				items = append(items, it)
				if it.Path != "" {
					paths = append(paths, it.Path)
				}
			}
		}
		s.mu.Unlock()

		if kill && !dryRun {
			killLockers(paths)
		}

		res := clean.Run(items, clean.Options{DryRun: dryRun})

		var freed, trashed int64
		var errs []string
		for _, a := range res.Actions {
			if a.Err != nil {
				errs = append(errs, a.Item.Label+": "+a.Err.Error())
				continue
			}
			switch a.Method {
			case rules.Trash:
				trashed += a.Item.Bytes
			case rules.Remove:
				freed += a.Item.Bytes
			}
		}
		s.emit(Event{Event: "cleanResult", Freed: freed, Trashed: trashed, Errors: errs})
	}()
}

func (s *server) cancelScan() {
	s.mu.Lock()
	if s.cancel != nil {
		close(s.cancel)
		s.cancel = nil
	}
	s.mu.Unlock()
}

// startApps reports the host arch, then streams the installed apps.
func (s *server) startApps() {
	s.cancelScan()
	cancel := make(chan struct{})
	s.mu.Lock()
	s.cancel = cancel
	s.mu.Unlock()

	arch := "other"
	if apps.HostIsAppleSilicon() {
		arch = "appleSilicon"
	}
	s.emit(Event{Event: "host", Host: &hostInfo{Arch: arch}})

	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		n := 0
		apps.Scan(s.home, func(a apps.App) {
			d := appDTO(a)
			s.emit(Event{Event: "app", App: &d})
			n++
			s.emit(Event{Event: "progress", Phase: "apps", Scanned: n, Path: a.Path})
		}, cancel)
		if !canceledCh(cancel) {
			s.emit(Event{Event: "scanDone"})
		}
	}()
}

// appLeftovers emits the support files associated with an app's bundle id.
func (s *server) appLeftovers(appPath string) {
	_, bundleID := apps.BundleInfo(appPath)
	var dtos []leftoverDTO
	for _, l := range apps.Leftovers(s.home, bundleID) {
		dtos = append(dtos, toLeftoverDTO(l))
	}
	s.emit(Event{Event: "leftovers", Path: appPath, Leftovers: dtos})
}

// uninstall moves each given path to the Trash (app bundle + chosen leftovers).
func (s *server) uninstall(paths []string) {
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		var trashed int64
		var errs []string
		for _, p := range paths {
			if p == "" || !filepath.IsAbs(p) {
				errs = append(errs, "invalid path: "+p)
				continue
			}
			if _, err := os.Stat(p); err != nil {
				errs = append(errs, err.Error())
				continue
			}
			size, _ := scan.DirSizeCancel(p, nil)
			if err := clean.Trash(p); err != nil {
				errs = append(errs, filepath.Base(p)+": "+err.Error())
				continue
			}
			trashed += size
		}
		s.emit(Event{Event: "cleanResult", Trashed: trashed, Errors: errs})
	}()
}

func canceledCh(c <-chan struct{}) bool {
	select {
	case <-c:
		return true
	default:
		return false
	}
}
