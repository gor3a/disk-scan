// Command dscan scans the disk, categorizes space, and cleans selected items.
package main

import (
	"flag"
	"fmt"
	"os"
	"runtime"
	"sort"

	tea "github.com/charmbracelet/bubbletea"

	"github.com/gor3a/disk-scan/internal/clean"
	"github.com/gor3a/disk-scan/internal/rules"
	"github.com/gor3a/disk-scan/internal/scan"
)

var (
	flagSystem  = flag.Bool("system", false, "also scan system dirs (slow/permissioned)")
	flagDryRun  = flag.Bool("dry-run", false, "preview actions without deleting")
	flagYes     = flag.Bool("yes", false, "non-interactive: clean all SAFE items (caches/build) without the TUI; skips REVIEW/KEEP and tool-commands")
	flagVersion = flag.Bool("version", false, "print version and exit")
	version     = "0.1.0"
)

func main() {
	flag.Parse()
	if *flagVersion {
		fmt.Println("dscan", version)
		return
	}
	home, _ := os.UserHomeDir()
	items := scanAll(runtime.GOOS, home, *flagSystem)

	// Non-interactive mode: clean the regenerable SAFE items and exit. Useful
	// for scripts/CI and any context without a TTY.
	if *flagYes {
		res := clean.Run(autoSafeSelection(items), clean.Options{DryRun: *flagDryRun})
		report(res, *flagDryRun)
		return
	}

	m := newProgram(items)
	prog := tea.NewProgram(m)
	final, err := prog.Run()
	if err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
	pm := final.(*programModel)
	if !pm.confirmed {
		return
	}
	res := clean.Run(pm.model.Selected(), clean.Options{DryRun: *flagDryRun})
	report(res, *flagDryRun)
}

// autoSafeSelection picks the regenerable SAFE items for non-interactive
// cleaning. It deliberately excludes REVIEW/KEEP items and tool-command entries,
// so `--yes` never runs external tools or touches user data.
func autoSafeSelection(items []rules.Item) []rules.Item {
	var out []rules.Item
	for _, it := range items {
		if it.Tier == rules.Safe && it.Path != "" && it.EffectiveMethod() == rules.Remove {
			out = append(out, it)
		}
	}
	return out
}

// scanAll runs the catalog pass then the heuristic pass, de-duped.
func scanAll(goos, home string, system bool) []rules.Item {
	var items []rules.Item
	covered := map[string]bool{}
	for _, e := range rules.Catalog(goos, home) {
		if e.Method == rules.Command {
			items = append(items, rules.Item{
				Label: e.Label, Category: e.Category, Tier: e.Tier,
				Method: rules.Command, Command: e.Command, Source: rules.CatalogSource,
			})
			continue
		}
		path := e.Expand(home)
		size, _ := scan.DirSize(path)
		if size == 0 {
			continue
		}
		covered[path] = true
		items = append(items, rules.Item{
			Path: path, Label: e.Label, Bytes: size,
			Category: e.Category, Tier: e.Tier, Method: e.Method, Source: rules.CatalogSource,
		})
	}
	items = append(items, scan.TopNLargest(home, 20, covered)...)
	sort.SliceStable(items, func(i, j int) bool {
		if items[i].Tier != items[j].Tier {
			return items[i].Tier < items[j].Tier
		}
		return items[i].Bytes > items[j].Bytes
	})
	return items
}

func report(res clean.Result, dry bool) {
	verb := "Freed"
	if dry {
		verb = "Would free"
	}
	fmt.Printf("%s %s across %d items (%d skipped).\n",
		verb, humized(res.FreedBytesOrPlanned(dry)), len(res.Actions), len(res.Skipped))
	for _, a := range res.Actions {
		if a.Err != nil {
			fmt.Fprintf(os.Stderr, "  ! %s: %v\n", a.Item.Label, a.Err)
		}
	}
}

func humized(b int64) string { //nolint:revive // small local formatter
	const u = 1024
	if b < u {
		return fmt.Sprintf("%dB", b)
	}
	div, exp := int64(u), 0
	for n := b / u; n >= u; n /= u {
		div *= u
		exp++
	}
	return fmt.Sprintf("%.1f%cB", float64(b)/float64(div), "KMGTPE"[exp])
}
