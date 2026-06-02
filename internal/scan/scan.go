// Package scan walks the filesystem to measure sizes and surface large items.
// Terminal-agnostic; safe against permission errors and missing paths.
package scan

import (
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/gor3a/disk-scan/internal/rules"
)

// DirSize returns the total bytes under path (recursively). A missing path
// returns (0, nil). Permission errors on individual entries are ignored.
func DirSize(path string) (int64, error) {
	info, err := os.Lstat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return 0, nil
		}
		return 0, err
	}
	if !info.IsDir() {
		return info.Size(), nil
	}
	var total int64
	_ = filepath.WalkDir(path, func(_ string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil // skip unreadable entries
		}
		if d.IsDir() {
			return nil
		}
		if fi, e := d.Info(); e == nil {
			total += fi.Size()
		}
		return nil
	})
	return total, nil
}

// Found is a heuristic result.
type Found = rules.Item

// TopNLargest measures each immediate child dir/file of root and returns the n
// largest, skipping any path present in covered. Sorted largest-first.
func TopNLargest(root string, n int, covered map[string]bool) []Found {
	entries, err := os.ReadDir(root)
	if err != nil {
		return nil
	}
	var items []Found
	for _, de := range entries {
		p := filepath.Join(root, de.Name())
		if overlapsCovered(p, covered) {
			continue
		}
		size, _ := DirSize(p)
		if size == 0 {
			continue
		}
		it := rules.ClassifyHeuristic(p)
		it.Bytes = size
		items = append(items, it)
	}
	sort.Slice(items, func(i, j int) bool { return items[i].Bytes > items[j].Bytes })
	if n >= 0 && len(items) > n {
		items = items[:n]
	}
	return items
}

func overlapsCovered(p string, covered map[string]bool) bool {
	for cov := range covered {
		if p == cov ||
			strings.HasPrefix(p+string(os.PathSeparator), cov+string(os.PathSeparator)) ||
			strings.HasPrefix(cov+string(os.PathSeparator), p+string(os.PathSeparator)) {
			return true
		}
	}
	return false
}
