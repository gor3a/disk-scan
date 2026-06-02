package clean

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestFreedesktopTrashWritesInfoAndMoves(t *testing.T) {
	root := t.TempDir()
	src := filepath.Join(t.TempDir(), "doomed")
	if err := os.MkdirAll(src, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := freedesktopTrash(src, root); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(src); !os.IsNotExist(err) {
		t.Error("source should be moved out of its original location")
	}
	if _, err := os.Stat(filepath.Join(root, "files", "doomed")); err != nil {
		t.Error("item should land in <trash>/files")
	}
	info, err := os.ReadFile(filepath.Join(root, "info", "doomed.trashinfo"))
	if err != nil {
		t.Fatalf("trashinfo record missing: %v", err)
	}
	s := string(info)
	for _, want := range []string{"[Trash Info]", "Path=", "DeletionDate="} {
		if !strings.Contains(s, want) {
			t.Errorf("trashinfo missing %q; got:\n%s", want, s)
		}
	}
}

func TestFreedesktopTrashCollisionKeepsBoth(t *testing.T) {
	root := t.TempDir()
	mk := func() string {
		p := filepath.Join(t.TempDir(), "dup")
		if err := os.WriteFile(p, []byte("x"), 0o644); err != nil {
			t.Fatal(err)
		}
		return p
	}
	if err := freedesktopTrash(mk(), root); err != nil {
		t.Fatal(err)
	}
	if err := freedesktopTrash(mk(), root); err != nil {
		t.Fatal(err)
	}
	files, _ := os.ReadDir(filepath.Join(root, "files"))
	if len(files) != 2 {
		t.Errorf("collision should keep both files, got %d", len(files))
	}
	infos, _ := os.ReadDir(filepath.Join(root, "info"))
	if len(infos) != 2 {
		t.Errorf("each trashed item needs its own .trashinfo, got %d", len(infos))
	}
}
