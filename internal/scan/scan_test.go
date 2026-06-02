package scan

import (
	"os"
	"path/filepath"
	"testing"
)

func writeFile(t *testing.T, path string, size int) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, make([]byte, size), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestDirSize(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, filepath.Join(dir, "a.bin"), 1000)
	writeFile(t, filepath.Join(dir, "sub", "b.bin"), 2000)
	got, err := DirSize(dir)
	if err != nil {
		t.Fatal(err)
	}
	if got < 3000 {
		t.Errorf("DirSize = %d, want >= 3000", got)
	}
}

func TestDirSizeMissingPath(t *testing.T) {
	// Missing path returns 0, no error (catalog entries may not exist).
	got, err := DirSize(filepath.Join(t.TempDir(), "nope"))
	if err != nil || got != 0 {
		t.Errorf("missing path => (%d,%v), want (0,nil)", got, err)
	}
}

func TestTopNLargest(t *testing.T) {
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "big", "x.bin"), 5000)
	writeFile(t, filepath.Join(root, "small", "y.bin"), 100)
	writeFile(t, filepath.Join(root, "mid", "z.bin"), 1000)
	got := TopNLargest(root, 2, nil)
	if len(got) != 2 {
		t.Fatalf("want 2 results, got %d", len(got))
	}
	if filepath.Base(got[0].Path) != "big" {
		t.Errorf("largest should be 'big', got %q", got[0].Path)
	}
}

func TestTopNSkipsCovered(t *testing.T) {
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "covered", "x.bin"), 5000)
	writeFile(t, filepath.Join(root, "fresh", "y.bin"), 4000)
	covered := map[string]bool{filepath.Join(root, "covered"): true}
	got := TopNLargest(root, 5, covered)
	for _, it := range got {
		if it.Path == filepath.Join(root, "covered") {
			t.Error("covered path must be skipped")
		}
	}
}

func TestTopNSkipsCoveredByPrefix(t *testing.T) {
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "Library", "Caches", "x.bin"), 5000)
	writeFile(t, filepath.Join(root, "other", "y.bin"), 100)
	covered := map[string]bool{filepath.Join(root, "Library", "Caches"): true}
	got := TopNLargest(root, 5, covered)
	for _, it := range got {
		if it.Path == filepath.Join(root, "Library") {
			t.Error("parent of a covered path must be skipped to avoid double counting")
		}
	}
}
