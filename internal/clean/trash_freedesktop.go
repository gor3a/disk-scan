package clean

import (
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// freedesktopTrash implements the XDG trash spec under trashRoot: the item is
// moved to trashRoot/files/<name> and a trashRoot/info/<name>.trashinfo record
// is written so desktop environments can restore it ("Put Back"). The name is
// de-duplicated on collision and the files name matches the info name.
func freedesktopTrash(path, trashRoot string) error {
	abs, err := filepath.Abs(path)
	if err != nil {
		return err
	}
	filesDir := filepath.Join(trashRoot, "files")
	infoDir := filepath.Join(trashRoot, "info")
	if err := os.MkdirAll(filesDir, 0o700); err != nil {
		return err
	}
	if err := os.MkdirAll(infoDir, 0o700); err != nil {
		return err
	}

	dst := uniqueDest(filepath.Join(filesDir, filepath.Base(abs)))
	name := filepath.Base(dst)

	// Write the .trashinfo record before moving (spec recommends info-first so a
	// crash never leaves a trashed file without a restore record).
	info := fmt.Sprintf("[Trash Info]\nPath=%s\nDeletionDate=%s\n",
		abs, time.Now().Format("2006-01-02T15:04:05"))
	infoPath := filepath.Join(infoDir, name+".trashinfo")
	if err := os.WriteFile(infoPath, []byte(info), 0o600); err != nil {
		return err
	}
	if err := moveTo(abs, dst); err != nil {
		os.Remove(infoPath) // roll back the orphaned record
		return err
	}
	return nil
}
