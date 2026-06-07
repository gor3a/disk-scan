package engine

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/gor3a/disk-scan/internal/scan"
)

// Node is a directory or file in the disk-map size tree. Aggregate ("+N small")
// nodes have an empty Path and Dir=false.
type Node struct {
	Name     string  `json:"name"`
	Path     string  `json:"path"`
	Bytes    int64   `json:"bytes"`
	Dir      bool    `json:"dir"`
	Children []*Node `json:"children,omitempty"`
}

const (
	mapMinFraction = 0.004 // a tile must be >= 0.4% of the root total to show
	mapTopFiles    = 200   // largest files kept per directory during the walk
)

type szDir struct {
	node  *Node
	files []*Node
	subs  []*Node
}

// BuildSizeTree walks root once and returns a pruned size tree for a treemap.
// Excluded subtrees, symlinks, and other devices are skipped; unreadable
// entries are skipped best-effort; the walk stops when cancel is closed.
func BuildSizeTree(root string, excludes []string, onProgress func(scanned int, bytes int64, path string), cancel <-chan struct{}) *Node {
	info, err := os.Stat(root)
	if err != nil || !info.IsDir() {
		return nil
	}
	rootDev := deviceID(info)

	dirs := map[string]*szDir{}
	get := func(path, name string) *szDir {
		d := dirs[path]
		if d == nil {
			d = &szDir{node: &Node{Name: name, Path: path, Dir: true}}
			dirs[path] = d
		}
		return d
	}
	get(root, filepath.Base(root))

	scanned := 0
	var totalBytes int64
	_ = filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if canceled(cancel) {
			return fs.SkipAll
		}
		if err != nil {
			if d != nil && d.IsDir() {
				return fs.SkipDir
			}
			return nil
		}
		if path != root && scan.IsExcluded(path, excludes) {
			if d.IsDir() {
				return fs.SkipDir
			}
			return nil
		}
		if d.IsDir() {
			if d.Type()&fs.ModeSymlink != 0 {
				return fs.SkipDir
			}
			if fi, e := d.Info(); e == nil && deviceID(fi) != rootDev && path != root {
				return fs.SkipDir
			}
			if path != root {
				get(path, d.Name())
			}
			return nil
		}
		fi, e := d.Info()
		if e != nil {
			return nil
		}
		size := fi.Size()
		parent := get(filepath.Dir(path), filepath.Base(filepath.Dir(path)))
		parent.files = append(parent.files, &Node{Name: d.Name(), Path: path, Bytes: size})
		if len(parent.files) > mapTopFiles {
			sort.Slice(parent.files, func(i, j int) bool { return parent.files[i].Bytes > parent.files[j].Bytes })
			parent.files = parent.files[:mapTopFiles]
		}
		totalBytes += size
		scanned++
		if onProgress != nil && scanned%2000 == 0 {
			onProgress(scanned, totalBytes, path)
		}
		return nil
	})

	// Link child dirs to their parents.
	for path, d := range dirs {
		if path == root {
			continue
		}
		if p := dirs[filepath.Dir(path)]; p != nil {
			p.subs = append(p.subs, d.node)
		}
	}
	// Post-order sum: deepest paths first so children are summed before parents.
	paths := make([]string, 0, len(dirs))
	for p := range dirs {
		paths = append(paths, p)
	}
	sep := string(os.PathSeparator)
	sort.Slice(paths, func(i, j int) bool {
		return strings.Count(paths[i], sep) > strings.Count(paths[j], sep)
	})
	for _, p := range paths {
		d := dirs[p]
		var sum int64
		for _, f := range d.files {
			sum += f.Bytes
		}
		for _, c := range d.subs {
			sum += c.Bytes
		}
		d.node.Bytes = sum
	}

	rootNode := dirs[root].node
	threshold := int64(float64(rootNode.Bytes) * mapMinFraction)
	pruneDir(dirs, root, threshold)
	if onProgress != nil {
		onProgress(scanned, totalBytes, root)
	}
	return rootNode
}

// pruneDir keeps each directory's children that are >= threshold and collapses
// the smaller ones into a single "+N small" aggregate (empty Path, Dir=false).
func pruneDir(dirs map[string]*szDir, path string, threshold int64) {
	d := dirs[path]
	if d == nil {
		return
	}
	var kept, smalls []*Node
	for _, c := range d.subs {
		if c.Bytes >= threshold {
			kept = append(kept, c)
		} else {
			smalls = append(smalls, c)
		}
	}
	for _, f := range d.files {
		if f.Bytes >= threshold {
			kept = append(kept, f)
		} else {
			smalls = append(smalls, f)
		}
	}
	if len(smalls) == 1 {
		kept = append(kept, smalls[0])
	} else if len(smalls) > 1 {
		var sum int64
		for _, n := range smalls {
			sum += n.Bytes
		}
		kept = append(kept, &Node{Name: fmt.Sprintf("+%d small", len(smalls)), Bytes: sum})
	}
	sort.Slice(kept, func(i, j int) bool { return kept[i].Bytes > kept[j].Bytes })
	d.node.Children = kept
	for _, c := range kept {
		if c.Dir {
			pruneDir(dirs, c.Path, threshold)
		}
	}
}
