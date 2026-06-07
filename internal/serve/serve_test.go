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

func TestServeCancelStillFinishesCleanly(t *testing.T) {
	home := t.TempDir()
	cache := filepath.Join(home, ".cache", "x")
	if err := os.MkdirAll(cache, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(cache, "b"), make([]byte, 4096), 0o644); err != nil {
		t.Fatal(err)
	}

	// scan immediately followed by cancel — must not panic or hang, and the
	// scan goroutine must still emit a terminal scanDone.
	var out strings.Builder
	in := strings.NewReader(`{"cmd":"scan"}` + "\n" + `{"cmd":"cancel"}` + "\n")
	if err := Run(in, &out, "linux", home); err != nil {
		t.Fatal(err)
	}
	var sawDone bool
	for _, e := range decodeEvents(t, out.String()) {
		if e.Event == "scanDone" {
			sawDone = true
		}
	}
	if !sawDone {
		t.Fatal("a canceled scan must still emit scanDone so the UI can advance")
	}
}

func TestServeScanProjects(t *testing.T) {
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "proj", "node_modules", "x"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "proj", "node_modules", "x", "f"), make([]byte, 4096), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "proj", "main.js"), []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}

	var out strings.Builder
	in := strings.NewReader(`{"cmd":"scan","kind":"projects","root":"` + root + `"}` + "\n")
	if err := Run(in, &out, "darwin", root); err != nil {
		t.Fatal(err)
	}

	var sawProjItem, sawProjPhase, sawDone bool
	for _, e := range decodeEvents(t, out.String()) {
		if e.Event == "item" && e.Item != nil && e.Item.Category == "Projects" && e.Item.Modified > 0 {
			sawProjItem = true
		}
		if e.Event == "progress" && e.Phase == "projects" {
			sawProjPhase = true
		}
		if e.Event == "scanDone" {
			sawDone = true
		}
	}
	if !sawProjItem || !sawProjPhase || !sawDone {
		t.Fatalf("item=%v phase=%v done=%v", sawProjItem, sawProjPhase, sawDone)
	}
}

func TestServeCleanKillLockersRunsCleanly(t *testing.T) {
	home := t.TempDir()
	root := t.TempDir()
	proj := filepath.Join(root, "app", "node_modules", "x")
	if err := os.MkdirAll(proj, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(proj, "f"), make([]byte, 2048), 0o644); err != nil {
		t.Fatal(err)
	}
	nm := filepath.Join(root, "app", "node_modules")

	// killLockers runs lsof/SIGTERM before the (already-tested) clean. This
	// asserts that path doesn't panic and still emits a cleanResult. (Whether
	// the item is in byID yet is racy by design — mid-scan clean.)
	var out strings.Builder
	in := strings.NewReader(
		`{"cmd":"scan","kind":"projects","root":"` + root + `"}` + "\n" +
			`{"cmd":"clean","ids":["` + nm + `"],"killLockers":true}` + "\n")
	if err := Run(in, &out, "darwin", home); err != nil {
		t.Fatal(err)
	}
	var sawResult bool
	for _, e := range decodeEvents(t, out.String()) {
		if e.Event == "cleanResult" {
			sawResult = true
		}
	}
	if !sawResult {
		t.Error("expected a cleanResult even with killLockers")
	}
}

func TestServeMapEmitsTree(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "f"), make([]byte, 4096), 0o644); err != nil {
		t.Fatal(err)
	}
	var out strings.Builder
	in := strings.NewReader(`{"cmd":"map","root":"` + root + `"}` + "\n")
	if err := Run(in, &out, "darwin", root); err != nil {
		t.Fatal(err)
	}
	var sawTree bool
	for _, e := range decodeEvents(t, out.String()) {
		if e.Event == "tree" {
			sawTree = true
			if e.Node == nil || e.Node.Bytes < 4096 {
				t.Errorf("tree node bytes = %v", e.Node)
			}
		}
	}
	if !sawTree {
		t.Error("expected a tree event")
	}
}

func TestServeTrashMovesPath(t *testing.T) {
	root := t.TempDir()
	target := filepath.Join(root, "victim")
	if err := os.WriteFile(target, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	trashDir := t.TempDir()
	t.Setenv("DSCAN_TRASH_DIR", trashDir)
	var out strings.Builder
	in := strings.NewReader(`{"cmd":"trash","path":"` + target + `"}` + "\n")
	if err := Run(in, &out, "darwin", root); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(target); !os.IsNotExist(err) {
		t.Error("trash should remove the source")
	}
}

func TestServeScanProjectsExcludes(t *testing.T) {
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "skip", "node_modules", "x"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "skip", "node_modules", "x", "f"), make([]byte, 2048), 0o644); err != nil {
		t.Fatal(err)
	}
	var out strings.Builder
	in := strings.NewReader(`{"cmd":"scan","kind":"projects","root":"` + root +
		`","excludes":["` + filepath.Join(root, "skip") + `"]}` + "\n")
	if err := Run(in, &out, "darwin", root); err != nil {
		t.Fatal(err)
	}
	for _, e := range decodeEvents(t, out.String()) {
		if e.Event == "item" {
			t.Error("excluded project must not be scanned")
		}
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
