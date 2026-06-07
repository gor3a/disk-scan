package clean

import (
	"os"
	"path/filepath"
	"testing"
)

func TestTrashMovesPath(t *testing.T) {
	src := t.TempDir()
	target := filepath.Join(src, "victim")
	if err := os.WriteFile(target, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	trashDir := t.TempDir()
	t.Setenv("DSCAN_TRASH_DIR", trashDir)

	if err := Trash(target); err != nil {
		t.Fatalf("Trash: %v", err)
	}
	if _, err := os.Stat(target); !os.IsNotExist(err) {
		t.Error("source should be gone")
	}
	if _, err := os.Stat(filepath.Join(trashDir, "victim")); err != nil {
		t.Error("file should be in the redirected trash dir")
	}
}
