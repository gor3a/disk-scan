package engine

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/gor3a/disk-scan/internal/rules"
)

func writeTree(t *testing.T, dir string, size int) error {
	t.Helper()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dir, "blob"), make([]byte, size), 0o644)
}

func mkfileP(t *testing.T, path string, size int) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, make([]byte, size), 0o644); err != nil {
		t.Fatal(err)
	}
}

func contains(items []rules.Item, path string) bool {
	for _, it := range items {
		if it.Path == path {
			return true
		}
	}
	return false
}
