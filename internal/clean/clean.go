// Package clean executes a selection of items: hard-delete caches, trash user
// data, or run a tool command. Refuses to touch Keep items.
package clean

import (
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"

	"github.com/gor3a/disk-scan/internal/rules"
)

// Options control a clean run.
type Options struct {
	DryRun bool
}

// Action records what was (or would be) done to one item.
type Action struct {
	Item   rules.Item
	Method rules.CleanMethod
	Err    error
}

// Result summarizes a run.
type Result struct {
	Actions    []Action
	Skipped    []rules.Item
	FreedBytes int64
}

// Run cleans the given items per their effective method.
func Run(items []rules.Item, opt Options) Result {
	var res Result
	for _, it := range items {
		if !it.Selectable() {
			res.Skipped = append(res.Skipped, it)
			continue
		}
		method := it.EffectiveMethod()
		act := Action{Item: it, Method: method}
		if !opt.DryRun {
			act.Err = perform(it, method)
			if act.Err == nil {
				res.FreedBytes += it.Bytes
			}
		}
		res.Actions = append(res.Actions, act)
	}
	return res
}

func perform(it rules.Item, method rules.CleanMethod) error {
	if it.Path == "" && method != rules.Command {
		return fmt.Errorf("refusing to clean %q: empty path", it.Label)
	}
	switch method {
	case rules.Remove:
		return os.RemoveAll(it.Path)
	case rules.Trash:
		return trash(it.Path)
	case rules.Command:
		return runCommand(it.Command)
	default:
		return os.RemoveAll(it.Path)
	}
}

func runCommand(argv []string) error {
	if len(argv) == 0 {
		return nil
	}
	cmd := exec.Command(argv[0], argv[1:]...)
	return cmd.Run()
}

// trashDirOverride lets tests redirect the trash destination.
func trashDirOverride() string { return os.Getenv("DSCAN_TRASH_DIR") }

func moveInto(src, dstDir string) error {
	if err := os.MkdirAll(dstDir, 0o755); err != nil {
		return err
	}
	return moveTo(src, uniqueDest(filepath.Join(dstDir, filepath.Base(src))))
}

// moveTo moves src to the exact path dst, falling back to copy+remove across
// filesystems (os.Rename fails with EXDEV between mounts).
func moveTo(src, dst string) error {
	if err := os.Rename(src, dst); err != nil {
		if errors.Is(err, syscall.EXDEV) {
			if cerr := copyTree(src, dst); cerr != nil {
				return cerr
			}
			return os.RemoveAll(src)
		}
		return err
	}
	return nil
}

// uniqueDest returns path, or path.1/path.2/... if it already exists, so
// trashing never overwrites an existing trashed item.
func uniqueDest(path string) string {
	if _, err := os.Lstat(path); os.IsNotExist(err) {
		return path
	}
	for i := 1; ; i++ {
		cand := fmt.Sprintf("%s.%d", path, i)
		if _, err := os.Lstat(cand); os.IsNotExist(err) {
			return cand
		}
	}
}

// copyTree recursively copies src to dst (used as cross-filesystem fallback).
func copyTree(src, dst string) error {
	info, err := os.Lstat(src)
	if err != nil {
		return err
	}
	if info.Mode()&os.ModeSymlink != 0 {
		target, lerr := os.Readlink(src)
		if lerr != nil {
			return lerr
		}
		return os.Symlink(target, dst)
	}
	if info.IsDir() {
		if err := os.MkdirAll(dst, info.Mode().Perm()); err != nil {
			return err
		}
		entries, rerr := os.ReadDir(src)
		if rerr != nil {
			return rerr
		}
		for _, e := range entries {
			if err := copyTree(filepath.Join(src, e.Name()), filepath.Join(dst, e.Name())); err != nil {
				return err
			}
		}
		return nil
	}
	in, oerr := os.Open(src)
	if oerr != nil {
		return oerr
	}
	defer in.Close()
	out, cerr := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, info.Mode().Perm())
	if cerr != nil {
		return cerr
	}
	defer out.Close()
	_, err = io.Copy(out, in)
	return err
}

// FreedBytesOrPlanned returns FreedBytes, or for a dry run the bytes that would
// be freed by the recorded actions.
func (r Result) FreedBytesOrPlanned(dry bool) int64 {
	if !dry {
		return r.FreedBytes
	}
	var total int64
	for _, a := range r.Actions {
		total += a.Item.Bytes
	}
	return total
}
