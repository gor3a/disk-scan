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

func contains(items []rules.Item, path string) bool {
	for _, it := range items {
		if it.Path == path {
			return true
		}
	}
	return false
}
