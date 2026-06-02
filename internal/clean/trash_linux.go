//go:build linux

package clean

import (
	"os"
	"path/filepath"
)

func trash(path string) error {
	if dir := trashDirOverride(); dir != "" {
		return moveInto(path, dir)
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	// freedesktop spec: files live under ~/.local/share/Trash/files
	return moveInto(path, filepath.Join(home, ".local", "share", "Trash", "files"))
}
