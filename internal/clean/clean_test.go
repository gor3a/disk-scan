package clean

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/gor3a/disk-scan/internal/rules"
)

func TestDryRunRemovesNothing(t *testing.T) {
	dir := t.TempDir()
	target := filepath.Join(dir, "cache")
	if err := os.MkdirAll(target, 0o755); err != nil {
		t.Fatal(err)
	}
	r := Run([]rules.Item{{Path: target, Tier: rules.Safe}}, Options{DryRun: true})
	if _, err := os.Stat(target); err != nil {
		t.Error("dry-run must not delete the target")
	}
	if len(r.Actions) != 1 || r.Actions[0].Method != rules.Remove {
		t.Errorf("dry-run should report 1 Remove action, got %+v", r.Actions)
	}
}

func TestRemoveDeletesSafe(t *testing.T) {
	dir := t.TempDir()
	target := filepath.Join(dir, "cache")
	if err := os.MkdirAll(target, 0o755); err != nil {
		t.Fatal(err)
	}
	Run([]rules.Item{{Path: target, Tier: rules.Safe}}, Options{})
	if _, err := os.Stat(target); !os.IsNotExist(err) {
		t.Error("Safe item should be hard-deleted")
	}
}

func TestBestEffortRemoveDeletesEverythingWhenAllowed(t *testing.T) {
	box := filepath.Join(t.TempDir(), "box")
	if err := os.MkdirAll(filepath.Join(box, "a"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(box, "a", "f"), []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	skipped, err := bestEffortRemove(box)
	if err != nil {
		t.Fatal(err)
	}
	if skipped != 0 {
		t.Errorf("skipped = %d, want 0", skipped)
	}
	if _, e := os.Stat(box); !os.IsNotExist(e) {
		t.Error("box should be fully removed")
	}
}

func TestBestEffortRemoveSkipsProtectedWithoutError(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("root ignores permission bits")
	}
	box := filepath.Join(t.TempDir(), "box")
	open := filepath.Join(box, "open")
	prot := filepath.Join(box, "prot")
	for _, d := range []string{open, prot} {
		if err := os.MkdirAll(d, 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(d, "f"), []byte("x"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	// Make prot unreadable/unremovable, like a TCC-protected macOS cache.
	if err := os.Chmod(prot, 0); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chmod(prot, 0o755) }) // let TempDir cleanup succeed

	skipped, err := bestEffortRemove(box)
	if err != nil {
		t.Fatalf("permission skips must not be fatal, got %v", err)
	}
	if skipped == 0 {
		t.Error("expected the protected dir to be skipped")
	}
	if _, e := os.Stat(open); !os.IsNotExist(e) {
		t.Error("the unprotected subtree should have been removed")
	}
	if _, e := os.Stat(prot); e != nil {
		t.Error("protected dir (and its container) should be kept")
	}
}

func TestKeepIsRejected(t *testing.T) {
	dir := t.TempDir()
	target := filepath.Join(dir, "important")
	if err := os.MkdirAll(target, 0o755); err != nil {
		t.Fatal(err)
	}
	r := Run([]rules.Item{{Path: target, Tier: rules.Keep}}, Options{})
	if _, err := os.Stat(target); err != nil {
		t.Error("Keep item must never be deleted")
	}
	if len(r.Skipped) != 1 {
		t.Errorf("Keep item should be skipped, got skipped=%d", len(r.Skipped))
	}
}

func TestTrashMovesReview(t *testing.T) {
	// Use an overridable trash dir so the test never touches the real Trash.
	trashDir := t.TempDir()
	t.Setenv("DSCAN_TRASH_DIR", trashDir)

	dir := t.TempDir()
	target := filepath.Join(dir, "userdata")
	if err := os.MkdirAll(target, 0o755); err != nil {
		t.Fatal(err)
	}
	Run([]rules.Item{{Path: target, Tier: rules.Review}}, Options{})
	if _, err := os.Stat(target); !os.IsNotExist(err) {
		t.Error("Review item should be moved out of its original location")
	}
	if _, err := os.Stat(filepath.Join(trashDir, "userdata")); err != nil {
		t.Error("Review item should land in the trash dir")
	}
}

func TestEmptyPathRefused(t *testing.T) {
	r := Run([]rules.Item{{Path: "", Tier: rules.Safe}}, Options{})
	if len(r.Actions) != 1 || r.Actions[0].Err == nil {
		t.Error("empty-path item must produce an error, not a silent rm")
	}
	if r.FreedBytes != 0 {
		t.Error("nothing should be freed for an empty path")
	}
}

func TestTrashCollisionKeepsBoth(t *testing.T) {
	trashDir := t.TempDir()
	t.Setenv("DSCAN_TRASH_DIR", trashDir)
	mk := func(parent string) string {
		p := filepath.Join(parent, "dup")
		if err := os.MkdirAll(p, 0o755); err != nil {
			t.Fatal(err)
		}
		return p
	}
	a := mk(t.TempDir())
	b := mk(t.TempDir())
	Run([]rules.Item{{Path: a, Tier: rules.Review}}, Options{})
	Run([]rules.Item{{Path: b, Tier: rules.Review}}, Options{})
	entries, _ := os.ReadDir(trashDir)
	if len(entries) != 2 {
		t.Errorf("collision should keep both items, got %d entries in trash", len(entries))
	}
}
