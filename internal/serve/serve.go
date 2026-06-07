package serve

import (
	"bufio"
	"encoding/json"
	"io"
	"sync"

	"github.com/gor3a/disk-scan/internal/clean"
	"github.com/gor3a/disk-scan/internal/engine"
	"github.com/gor3a/disk-scan/internal/rules"
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
		case "clean":
			s.startClean(req.IDs, req.DryRun, req.KillLockers)
		case "cancel":
			s.cancelScan()
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
			s.runScanProjects(req.Root, cancel)
		} else {
			s.runScan(req.System, cancel)
		}
	}()
}

func (s *server) runScanProjects(root string, cancel <-chan struct{}) {
	if root == "" {
		root = s.home
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
	}, cancel)
	s.emit(Event{Event: "scanDone", Reclaimable: bytes})
}

func (s *server) runScan(system bool, cancel <-chan struct{}) {
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
	}, cancel)

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
