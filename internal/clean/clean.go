// Package clean executes a selection of items: hard-delete caches, trash user
// data, or run a tool command. Refuses to touch Keep items.
package clean

import (
	"os"
	"os/exec"
	"path/filepath"

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

// moveInto moves src into dstDir, preserving the base name.
func moveInto(src, dstDir string) error {
	if err := os.MkdirAll(dstDir, 0o755); err != nil {
		return err
	}
	return os.Rename(src, filepath.Join(dstDir, filepath.Base(src)))
}
