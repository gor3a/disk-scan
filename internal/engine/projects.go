package engine

import (
	"io/fs"
	"os"
	"path/filepath"
	"syscall"

	"github.com/gor3a/disk-scan/internal/scan"
)

// Project is one node_modules directory found under a root.
type Project struct {
	Path     string // absolute path to the node_modules dir (removed when cleaned)
	Dir      string // absolute path to the parent project dir (for the label)
	Bytes    int64
	Modified int64 // unix secs: newest mtime among the project dir's non-node_modules children
}

// FindProjects walks root depth-first for directories named "node_modules"
// without recursing into a found one, streaming each via onItem. It stays on a
// single filesystem, skips symlinked dirs, tolerates permission errors, and
// stops early when cancel is closed (nil = never).
func FindProjects(root string, onItem func(Project), cancel <-chan struct{}) {
	info, err := os.Stat(root)
	if err != nil || !info.IsDir() {
		return
	}
	rootDev := deviceID(info)

	_ = filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if canceled(cancel) {
			return fs.SkipAll
		}
		if err != nil || !d.IsDir() {
			return nil // skip unreadable entries and files
		}
		if d.Type()&fs.ModeSymlink != 0 {
			return fs.SkipDir
		}
		if fi, e := d.Info(); e == nil && deviceID(fi) != rootDev {
			return fs.SkipDir // different filesystem
		}
		if d.Name() == "node_modules" {
			parent := filepath.Dir(path)
			size, _ := scan.DirSizeCancel(path, cancel)
			onItem(Project{
				Path:     path,
				Dir:      parent,
				Bytes:    size,
				Modified: latestChildMtime(parent),
			})
			return fs.SkipDir // don't descend into node_modules
		}
		return nil
	})
}

func deviceID(fi os.FileInfo) uint64 {
	if st, ok := fi.Sys().(*syscall.Stat_t); ok {
		return uint64(st.Dev)
	}
	return 0
}

// latestChildMtime returns the newest mtime among dir's immediate children,
// excluding node_modules, so "last used" tracks source edits not dependency
// installs. Falls back to dir's own mtime.
func latestChildMtime(dir string) int64 {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return 0
	}
	var newest int64
	for _, e := range entries {
		if e.Name() == "node_modules" {
			continue
		}
		if info, err := e.Info(); err == nil {
			if t := info.ModTime().Unix(); t > newest {
				newest = t
			}
		}
	}
	if newest == 0 {
		if info, err := os.Stat(dir); err == nil {
			newest = info.ModTime().Unix()
		}
	}
	return newest
}
