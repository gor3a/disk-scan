//go:build linux

package clean

import (
	"os"
	"os/exec"
	"path/filepath"
)

func trash(path string) error {
	if dir := trashDirOverride(); dir != "" {
		return moveInto(path, dir)
	}
	// Prefer gio: it writes a spec-compliant record and handles per-mount trash
	// directories (external volumes) correctly.
	if _, err := exec.LookPath("gio"); err == nil {
		if err := exec.Command("gio", "trash", "--", path).Run(); err == nil {
			return nil
		}
		// gio failed (e.g. no session bus) — fall through to the manual spec.
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	return freedesktopTrash(path, filepath.Join(home, ".local", "share", "Trash"))
}
