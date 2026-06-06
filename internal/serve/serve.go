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
// out until in is exhausted. It is the GUI sidecar entry point (`dscan serve`).
func Run(in io.Reader, out io.Writer, goos, home string) error {
	s := &server{home: home, goos: goos, enc: json.NewEncoder(out), byID: map[string]rules.Item{}}
	sc := bufio.NewScanner(in)
	sc.Buffer(make([]byte, 1024*1024), 4*1024*1024)
	for sc.Scan() {
		var req Request
		if err := json.Unmarshal(sc.Bytes(), &req); err != nil {
			s.emit(Event{Event: "error", Message: "bad request: " + err.Error()})
			continue
		}
		switch req.Cmd {
		case "scan":
			s.scan(req.System)
		case "clean":
			s.clean(req.IDs, req.DryRun)
		case "cancel":
			s.cancelScan()
		}
	}
	return sc.Err()
}

type server struct {
	home, goos string
	enc        *json.Encoder
	mu         sync.Mutex // guards enc + byID
	byID       map[string]rules.Item
	cancel     chan struct{}
}

func (s *server) emit(e Event) {
	s.mu.Lock()
	defer s.mu.Unlock()
	_ = s.enc.Encode(e) // newline added by Encoder
}

func (s *server) scan(system bool) {
	if d, err := engine.DiskUsage(s.home); err == nil {
		s.emit(Event{Event: "disk", Disk: &diskInfo{Used: d.Used, Free: d.Free, Total: d.Total}})
	}
	s.mu.Lock()
	s.byID = map[string]rules.Item{}
	s.mu.Unlock()

	n := 0
	items := engine.ScanAll(s.goos, s.home, system, func(it rules.Item) {
		dto := ToDTO(it)
		s.mu.Lock()
		s.byID[dto.ID] = it
		s.mu.Unlock()
		s.emit(Event{Event: "item", Item: &dto})
		n++
		s.emit(Event{Event: "progress", Scanned: n})
	})
	var total int64
	for _, it := range items {
		if it.Selectable() && it.Tier == rules.Safe {
			total += it.Bytes
		}
	}
	s.emit(Event{Event: "scanDone", Reclaimable: total})
}

func (s *server) clean(ids []string, dryRun bool) {
	s.mu.Lock()
	var items []rules.Item
	for _, id := range ids {
		if it, ok := s.byID[id]; ok {
			items = append(items, it)
		}
	}
	s.mu.Unlock()

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
}

func (s *server) cancelScan() {
	s.mu.Lock()
	if s.cancel != nil {
		close(s.cancel)
		s.cancel = nil
	}
	s.mu.Unlock()
}
