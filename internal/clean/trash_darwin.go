//go:build darwin

package clean

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

func trash(path string) error {
	if dir := trashDirOverride(); dir != "" {
		return moveInto(path, dir)
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		return err
	}
	// Finder's "delete" moves to Trash and records "Put Back" metadata.
	script := fmt.Sprintf("tell application \"Finder\" to delete (POSIX file %q)", abs)
	if out, err := exec.Command("osascript", "-e", script).CombinedOutput(); err != nil {
		// No Finder/GUI session (e.g. ssh/cron): fall back to a plain move into
		// ~/.Trash — recoverable, just without "Put Back".
		home, herr := os.UserHomeDir()
		if herr != nil {
			return fmt.Errorf("osascript trash failed (%w): %s", err, out)
		}
		return moveInto(path, filepath.Join(home, ".Trash"))
	}
	return nil
}
