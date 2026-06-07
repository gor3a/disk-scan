// Command dscan scans the disk, categorizes space, and cleans selected items.
package main

import (
	"flag"
	"fmt"
	"os"
	"runtime"

	tea "github.com/charmbracelet/bubbletea"

	"github.com/gor3a/disk-scan/internal/clean"
	"github.com/gor3a/disk-scan/internal/engine"
	"github.com/gor3a/disk-scan/internal/notify"
	"github.com/gor3a/disk-scan/internal/rules"
	"github.com/gor3a/disk-scan/internal/serve"
)

var (
	flagSystem  = flag.Bool("system", false, "also scan system dirs (slow/permissioned)")
	flagDryRun  = flag.Bool("dry-run", false, "preview actions without deleting")
	flagYes     = flag.Bool("yes", false, "non-interactive: clean all SAFE items (caches/build) without the TUI; skips REVIEW/KEEP and tool-commands")
	flagVersion = flag.Bool("version", false, "print version and exit")
	version     = "0.5.1"
)

// isServeMode reports whether dscan was invoked as `dscan serve` (the headless
// JSON sidecar mode used by the desktop GUI).
func isServeMode(args []string) bool {
	return len(args) > 1 && args[1] == "serve"
}

const notifyThreshold = 500 << 20 // 500 MiB — below this, don't nag

func isNotifyMode(args []string) bool { return len(args) > 1 && args[1] == "notify" }

func hasFlag(args []string, name string) bool {
	for _, a := range args {
		if a == name {
			return true
		}
	}
	return false
}

// runNotify scans caches, optionally cleans the SAFE selection, and posts a
// desktop notification. Used by the scheduled background job (`dscan notify`).
func runNotify(autoClean bool) {
	home, _ := os.UserHomeDir()
	items := engine.ScanAll(runtime.GOOS, home, false, nil, nil, nil)
	var reclaimable int64
	for _, it := range items {
		if it.Tier == rules.Safe && it.Path != "" && it.EffectiveMethod() == rules.Remove {
			reclaimable += it.Bytes
		}
	}
	var freed int64
	if autoClean {
		freed = clean.Run(engine.AutoSafeSelection(items), clean.Options{}).FreedBytes
	}
	notify.Notify("dscan", notifyMessage(reclaimable, autoClean, freed))
}

func notifyMessage(reclaimable int64, cleaned bool, freed int64) string {
	if cleaned {
		if freed <= 0 {
			return ""
		}
		return "Freed " + humized(freed) + "."
	}
	if reclaimable < notifyThreshold {
		return ""
	}
	return humized(reclaimable) + " can be freed."
}

func main() {
	if isServeMode(os.Args) {
		home, _ := os.UserHomeDir()
		if err := serve.Run(os.Stdin, os.Stdout, runtime.GOOS, home); err != nil {
			fmt.Fprintln(os.Stderr, "serve error:", err)
			os.Exit(1)
		}
		return
	}

	if isNotifyMode(os.Args) {
		runNotify(hasFlag(os.Args, "--clean"))
		return
	}

	flag.Parse()
	if *flagVersion {
		fmt.Println("dscan", version)
		return
	}
	home, _ := os.UserHomeDir()
	items := engine.ScanAll(runtime.GOOS, home, *flagSystem, nil, nil, nil)

	// Non-interactive mode: clean the regenerable SAFE items and exit. Useful
	// for scripts/CI and any context without a TTY.
	if *flagYes {
		res := clean.Run(engine.AutoSafeSelection(items), clean.Options{DryRun: *flagDryRun})
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
