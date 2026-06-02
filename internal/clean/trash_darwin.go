//go:build darwin

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
	return moveInto(path, filepath.Join(home, ".Trash"))
}
