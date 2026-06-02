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
