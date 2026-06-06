package main

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/gor3a/disk-scan/internal/clean"
	"github.com/gor3a/disk-scan/internal/engine"
	"github.com/gor3a/disk-scan/internal/rules"
)

// mkfile creates parent dirs and a file of the given size.
func mkfile(t *testing.T, path string, size int) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, make([]byte, size), 0o644); err != nil {
		t.Fatal(err)
	}
}

// findByPathSuffix returns the first item whose Path ends with suffix.
func findByPathSuffix(items []rules.Item, suffix string) (rules.Item, bool) {
	for _, it := range items {
		if it.Path != "" && strings.HasSuffix(it.Path, suffix) {
			return it, true
		}
	}
	return rules.Item{}, false
}

// TestEndToEndScanAndClean exercises the full pipeline against a temp HOME:
// a SAFE cache (~/.npm), a KEEP secret (~/.ssh), and a large unknown dir that
// the heuristic surfaces as REVIEW. It then cleans and verifies routing.
func TestEndToEndScanAndClean(t *testing.T) {
	home := t.TempDir()
	mkfile(t, filepath.Join(home, ".npm", "blob"), 4000)                // SAFE cache
	mkfile(t, filepath.Join(home, ".ssh", "id_rsa"), 2000)              // KEEP secret
	mkfile(t, filepath.Join(home, "BigProject", "media", "clip"), 9000) // REVIEW (heuristic)

	items := engine.ScanAll(runtime.GOOS, home, false, nil)

	// --- classification ---
	npm, ok := findByPathSuffix(items, filepath.Join(".npm"))
	if !ok || npm.Tier != rules.Safe {
		t.Fatalf("~/.npm should be a SAFE item, got %+v (ok=%v)", npm, ok)
	}
	ssh, ok := findByPathSuffix(items, filepath.Join(".ssh"))
	if !ok || ssh.Tier != rules.Keep || ssh.Selectable() {
		t.Fatalf("~/.ssh should be a non-selectable KEEP item, got %+v (ok=%v)", ssh, ok)
	}
	big, ok := findByPathSuffix(items, "BigProject")
	if !ok || big.Tier != rules.Review {
		t.Fatalf("BigProject should be surfaced as a REVIEW item, got %+v (ok=%v)", big, ok)
	}

	// Select only the path-backed, selectable items (skip Command entries with
	// empty Path so the test never runs brew/simctl).
	var sel []rules.Item
	for _, it := range items {
		if it.Path != "" && it.Selectable() {
			sel = append(sel, it)
		}
	}

	// --- dry-run deletes nothing ---
	dry := clean.Run(sel, clean.Options{DryRun: true})
	if dry.FreedBytesOrPlanned(true) <= 0 {
		t.Error("dry-run should report planned bytes > 0")
	}
	if _, err := os.Stat(npm.Path); err != nil {
		t.Error("dry-run must not remove the SAFE item")
	}
	if _, err := os.Stat(big.Path); err != nil {
		t.Error("dry-run must not remove the REVIEW item")
	}

	// --- real clean (trash redirected so we never touch the real Trash) ---
	trashDir := t.TempDir()
	t.Setenv("DSCAN_TRASH_DIR", trashDir)
	res := clean.Run(sel, clean.Options{})

	if _, err := os.Stat(npm.Path); !os.IsNotExist(err) {
		t.Error("SAFE ~/.npm should be hard-deleted")
	}
	if _, err := os.Stat(big.Path); !os.IsNotExist(err) {
		t.Error("REVIEW BigProject should be moved to trash")
	}
	if _, err := os.Stat(filepath.Join(trashDir, "BigProject")); err != nil {
		t.Error("REVIEW item should land in the (redirected) trash dir")
	}
	if _, err := os.Stat(ssh.Path); err != nil {
		t.Error("KEEP ~/.ssh must never be touched")
	}
	// KEEP item must be reported as skipped, not cleaned.
	var sshSkipped bool
	for _, s := range res.Skipped {
		if s.Path == ssh.Path {
			sshSkipped = true
		}
	}
	if !sshSkipped && ssh.Selectable() {
		t.Error("KEEP item should be in the skipped list")
	}
	if res.FreedBytes <= 0 {
		t.Error("real clean should report freed bytes")
	}
}

func TestAutoSafeSelection(t *testing.T) {
	items := []rules.Item{
		{Label: "cache", Path: "/x/.npm", Tier: rules.Safe},                                         // included (Safe + Remove + path)
		{Label: "brew cleanup", Tier: rules.Safe, Method: rules.Command, Command: []string{"brew"}}, // excluded (command)
		{Label: "userdata", Path: "/x/data", Tier: rules.Review},                                    // excluded (review)
		{Label: "ssh", Path: "/x/.ssh", Tier: rules.Keep},                                           // excluded (keep)
	}
	got := engine.AutoSafeSelection(items)
	if len(got) != 1 || got[0].Label != "cache" {
		t.Fatalf("autoSafeSelection should pick only the SAFE remove-path item, got %+v", got)
	}
}
