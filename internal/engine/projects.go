package engine

import (
	"io/fs"
	"os"
	"path/filepath"
	"syscall"

	"github.com/gor3a/disk-scan/internal/scan"
)

// Project is one regenerable artifact directory found under a root.
type Project struct {
	Path     string // absolute path to the artifact dir (removed when cleaned)
	Dir      string // absolute path to the parent project dir (for the label)
	Kind     string // node_modules | .next | dist | build | target | __pycache__ | ...
	Bytes    int64
	Modified int64 // unix secs: newest mtime among the project dir's non-artifact children
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
		if kind, ok := artifactKind(d.Name(), filepath.Dir(path)); ok {
			parent := filepath.Dir(path)
			size, _ := scan.DirSizeCancel(path, cancel)
			onItem(Project{
				Path:     path,
				Dir:      parent,
				Kind:     kind,
				Bytes:    size,
				Modified: latestChildMtime(parent),
			})
			return fs.SkipDir // don't descend into the artifact
		}
		return nil
	})
}

// artifactKind reports whether dirName under parent is a regenerable build/dep
// artifact, and its kind. Ambiguous names require a sibling manifest so we never
// nuke real source.
func artifactKind(dirName, parent string) (string, bool) {
	switch dirName {
	case "node_modules", ".next", ".nuxt", ".svelte-kit", ".turbo", "__pycache__", ".gradle":
		return dirName, true
	case "target":
		if exists(filepath.Join(parent, "Cargo.toml")) {
			return dirName, true
		}
	case "dist", "build", "out":
		if exists(filepath.Join(parent, "package.json")) {
			return dirName, true
		}
	}
	return "", false
}

func exists(p string) bool {
	_, err := os.Stat(p)
	return err == nil
}

func isArtifactName(name string) bool {
	switch name {
	case "node_modules", ".next", ".nuxt", ".svelte-kit", ".turbo", "__pycache__",
		".gradle", "target", "dist", "build", "out":
		return true
	}
	return false
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
		if isArtifactName(e.Name()) {
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
