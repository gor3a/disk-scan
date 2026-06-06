package serve

import (
	"bufio"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// decodeEvents parses newline-delimited JSON Events from r.
func decodeEvents(t *testing.T, r string) []Event {
	t.Helper()
	var evs []Event
	sc := bufio.NewScanner(strings.NewReader(r))
	sc.Buffer(make([]byte, 1024*1024), 1024*1024)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" {
			continue
		}
		var e Event
		if err := json.Unmarshal([]byte(line), &e); err != nil {
			t.Fatalf("bad event line %q: %v", line, err)
		}
		evs = append(evs, e)
	}
	return evs
}

func TestServeScanEmitsDiskItemsAndDone(t *testing.T) {
	home := t.TempDir()
	cache := filepath.Join(home, ".cache", "blobs")
	if err := os.MkdirAll(cache, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(cache, "b"), make([]byte, 8192), 0o644); err != nil {
		t.Fatal(err)
	}

	var out strings.Builder
	in := strings.NewReader(`{"cmd":"scan"}` + "\n")
	if err := Run(in, &out, "linux", home); err != nil {
		t.Fatal(err)
	}

	evs := decodeEvents(t, out.String())
	var sawDisk, sawItem, sawDone bool
	for _, e := range evs {
		switch e.Event {
		case "disk":
			sawDisk = e.Disk != nil && e.Disk.Total > 0
		case "item":
			sawItem = sawItem || e.Item != nil
		case "scanDone":
			sawDone = true
		}
	}
	if !sawDisk || !sawItem || !sawDone {
		t.Fatalf("missing events: disk=%v item=%v done=%v", sawDisk, sawItem, sawDone)
	}
}

func TestServeCleanDryRunRemovesNothing(t *testing.T) {
	home := t.TempDir()
	target := filepath.Join(home, ".cache", "x")
	if err := os.MkdirAll(target, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(target, "b"), make([]byte, 4096), 0o644); err != nil {
		t.Fatal(err)
	}

	var out strings.Builder
	cacheID := filepath.Join(home, ".cache")
	in := strings.NewReader(
		`{"cmd":"scan"}` + "\n" +
			`{"cmd":"clean","ids":["` + cacheID + `"],"dryRun":true}` + "\n")
	if err := Run(in, &out, "linux", home); err != nil {
		t.Fatal(err)
	}

	if _, err := os.Stat(target); err != nil {
		t.Fatalf("dry run must not delete: %v", err)
	}

	evs := decodeEvents(t, out.String())
	// The scanned cache must appear as an item so the id we clean is valid.
	var sawCacheItem, sawResult bool
	for _, e := range evs {
		if e.Event == "item" && e.Item != nil && e.Item.ID == cacheID {
			sawCacheItem = true
		}
		if e.Event == "cleanResult" {
			sawResult = true
		}
	}
	if !sawCacheItem {
		t.Fatalf("expected ~/.cache to be scanned as item id %q", cacheID)
	}
	if !sawResult {
		t.Fatal("expected a cleanResult event")
	}
}
