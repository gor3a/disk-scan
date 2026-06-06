// Package engine wires the scan → rules passes into a single ordered item list,
// shared by the TUI and the JSON serve mode. No terminal dependency.
package engine

import (
	"sort"
	"syscall"

	"github.com/gor3a/disk-scan/internal/rules"
	"github.com/gor3a/disk-scan/internal/scan"
)

// ScanAll runs the catalog pass then the heuristic pass, de-duped and sorted.
// onItem (may be nil) is called for each item as it is discovered, so a UI can
// stream rows in. Catalog items stream as they are measured; heuristic (top-N)
// items stream after.
func ScanAll(goos, home string, system bool, onItem func(rules.Item)) []rules.Item {
	var items []rules.Item
	covered := map[string]bool{}
	for _, e := range rules.Catalog(goos, home) {
		if e.Method == rules.Command {
			it := rules.Item{
				Label: e.Label, Category: e.Category, Tier: e.Tier,
				Method: rules.Command, Command: e.Command, Source: rules.CatalogSource,
			}
			items = append(items, it)
			if onItem != nil {
				onItem(it)
			}
			continue
		}
		path := e.Expand(home)
		size, _ := scan.DirSize(path)
		if size == 0 {
			continue
		}
		covered[path] = true
		it := rules.Item{
			Path: path, Label: e.Label, Bytes: size,
			Category: e.Category, Tier: e.Tier, Method: e.Method, Source: rules.CatalogSource,
		}
		items = append(items, it)
		if onItem != nil {
			onItem(it)
		}
	}
	heur := scan.TopNLargest(home, 20, covered)
	for _, it := range heur {
		if onItem != nil {
			onItem(it)
		}
	}
	items = append(items, heur...)
	sort.SliceStable(items, func(i, j int) bool {
		if items[i].Tier != items[j].Tier {
			return items[i].Tier < items[j].Tier
		}
		return items[i].Bytes > items[j].Bytes
	})
	return items
}

// AutoSafeSelection picks regenerable SAFE path items (no REVIEW/KEEP, no
// tool-commands) — the set `--yes` and the GUI's default selection clean.
func AutoSafeSelection(items []rules.Item) []rules.Item {
	var out []rules.Item
	for _, it := range items {
		if it.Tier == rules.Safe && it.Path != "" && it.EffectiveMethod() == rules.Remove {
			out = append(out, it)
		}
	}
	return out
}

// Disk reports capacity for the filesystem holding a path.
type Disk struct {
	Used  int64 `json:"used"`
	Free  int64 `json:"free"`
	Total int64 `json:"total"`
}

// DiskUsage stats the filesystem at path. Works on darwin and linux (both
// expose Bsize/Blocks/Bavail on Statfs_t).
func DiskUsage(path string) (Disk, error) {
	var st syscall.Statfs_t
	if err := syscall.Statfs(path, &st); err != nil {
		return Disk{}, err
	}
	bs := int64(st.Bsize)
	total := int64(st.Blocks) * bs
	free := int64(st.Bavail) * bs
	return Disk{Used: total - free, Free: free, Total: total}, nil
}
