# dscan Implementation Plan

> **For implementers:** Implement this plan task-by-task using a test-driven workflow. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A cross-platform Go TUI that scans the disk, categorizes space consumers, and cleans selected items (hard-delete caches, trash user data).

**Architecture:** Single Go binary, four terminal-agnostic engine packages (`scan`, `rules`, `clean`) + a Bubble Tea `tui`, wired by `main.go`. Engine is pure library code so a future GUI can reuse it.

**Tech Stack:** Go 1.21, Bubble Tea + Bubbles + Lipgloss, stdlib for scanning/trashing.

**Repo:** `gor3a/disk-scan` — independent git repo at `dotai/dscan/`. Commit AND push after every task.

**Spec:** `dscan/docs/spec.md`

---

## Conventions for every task

- Work from the repo root: `cd ~/Documents/work/dotai/dscan`.
- Module path is `github.com/gor3a/disk-scan` (set in Task 1).
- After each task's tests pass: `git add -A && git commit -m "<msg>" && git push`.
- Run tests with `go test ./...` unless a narrower command is given.
- Go is 1.21.4 (`darwin/amd64` on the dev machine); all code must also build for `linux`.

## File structure

```
dscan/
├─ go.mod                         module + deps                        (Task 1)
├─ main.go                        CLI flags, wire scan→rules→tui→clean  (Task 7)
├─ README.md                      usage                                 (Task 8)
├─ internal/
│  ├─ rules/
│  │  ├─ types.go                 Item, Category, Tier, CleanMethod     (Task 2)
│  │  ├─ catalog.go               OS-aware catalog + classifier         (Task 3)
│  │  └─ rules_test.go            classification tests                  (Tasks 2,3)
│  ├─ scan/
│  │  ├─ scan.go                  dirSize, walk, top-N, de-dup          (Task 4)
│  │  └─ scan_test.go             scan tests                            (Task 4)
│  ├─ clean/
│  │  ├─ clean.go                 Remove / Trash / Command + dry-run    (Task 5)
│  │  ├─ trash_darwin.go          macOS trash backend                   (Task 5)
│  │  ├─ trash_linux.go           freedesktop trash backend             (Task 5)
│  │  └─ clean_test.go            cleaner tests                         (Task 5)
│  └─ tui/
│     ├─ model.go                 pure selection model + freed total    (Task 6)
│     └─ model_test.go            selection math tests                  (Task 6)
└─ docs/{spec.md,plan.md}
```

The Bubble Tea view/update wiring lives in `main.go`'s program setup plus a small
`tui.Model`; the *logic* (selection, totals) is in `tui.Model` and is tested
headless. (No separate huge view file — YAGNI.)

---

## Task 1: Module bootstrap + dependencies

**Files:**
- Create: `dscan/go.mod`
- Create: `dscan/doc_smoke_test.go` (temporary smoke test, removed in Task 7)

- [ ] **Step 1: Initialize the module**

Run:
```bash
cd ~/Documents/work/dotai/dscan
go mod init github.com/gor3a/disk-scan
```
Expected: creates `go.mod` with `module github.com/gor3a/disk-scan` and `go 1.21`.

- [ ] **Step 2: Add the TUI dependencies**

Run:
```bash
go get github.com/charmbracelet/bubbletea@latest
go get github.com/charmbracelet/bubbles@latest
go get github.com/charmbracelet/lipgloss@latest
```
Expected: `go.mod`/`go.sum` updated with the three Charm packages.

- [ ] **Step 3: Write a smoke test that proves the toolchain works**

Create `dscan/doc_smoke_test.go`:
```go
package main

import "testing"

func TestToolchainSmoke(t *testing.T) {
	if 1+1 != 2 {
		t.Fatal("math is broken")
	}
}
```

- [ ] **Step 4: Verify build + test**

Run: `go build ./... && go test ./...`
Expected: builds clean; `ok` for the smoke test.

- [ ] **Step 5: Commit + push**

```bash
git add -A && git commit -m "chore: bootstrap go module + bubbletea deps" && git push
```

---

## Task 2: Core types (`rules.Item`)

**Files:**
- Create: `dscan/internal/rules/types.go`
- Create: `dscan/internal/rules/rules_test.go`

- [ ] **Step 1: Write failing tests for the type helpers**

Create `dscan/internal/rules/rules_test.go`:
```go
package rules

import "testing"

func TestTierString(t *testing.T) {
	cases := map[Tier]string{Safe: "SAFE", Review: "REVIEW", Keep: "KEEP"}
	for tier, want := range cases {
		if got := tier.String(); got != want {
			t.Errorf("Tier(%d).String() = %q, want %q", tier, got, want)
		}
	}
}

func TestSelectable(t *testing.T) {
	if (Item{Tier: Keep}).Selectable() {
		t.Error("Keep items must not be selectable")
	}
	if !(Item{Tier: Safe}).Selectable() {
		t.Error("Safe items must be selectable")
	}
	if !(Item{Tier: Review}).Selectable() {
		t.Error("Review items must be selectable")
	}
}

func TestDefaultMethod(t *testing.T) {
	// Safe with no explicit method -> Remove; Review -> Trash.
	if m := (Item{Tier: Safe}).EffectiveMethod(); m != Remove {
		t.Errorf("Safe default method = %v, want Remove", m)
	}
	if m := (Item{Tier: Review}).EffectiveMethod(); m != Trash {
		t.Errorf("Review default method = %v, want Trash", m)
	}
	// Explicit method wins.
	if m := (Item{Tier: Safe, Method: Command}).EffectiveMethod(); m != Command {
		t.Errorf("explicit method = %v, want Command", m)
	}
}
```

- [ ] **Step 2: Run to verify failure**

Run: `go test ./internal/rules/`
Expected: FAIL — `undefined: Tier`, `Item`, etc.

- [ ] **Step 3: Implement the types**

Create `dscan/internal/rules/types.go`:
```go
// Package rules defines the data model for scannable/cleanable disk items and
// the OS-aware catalog that classifies them. It has no terminal dependency so a
// GUI can reuse it.
package rules

// Category groups items for display.
type Category int

const (
	Caches Category = iota
	BuildArtifacts
	PackageStores
	Simulators
	LargeFiles
	AppData
)

func (c Category) String() string {
	switch c {
	case Caches:
		return "Caches"
	case BuildArtifacts:
		return "Build artifacts"
	case PackageStores:
		return "Package stores"
	case Simulators:
		return "Simulators & emulators"
	case LargeFiles:
		return "Large files"
	case AppData:
		return "App data"
	default:
		return "Other"
	}
}

// Tier expresses cleanup safety.
type Tier int

const (
	Safe   Tier = iota // regenerates automatically; hard-delete is fine
	Review             // real user data; needs judgment; trash by default
	Keep               // protected; never selectable
)

func (t Tier) String() string {
	switch t {
	case Safe:
		return "SAFE"
	case Review:
		return "REVIEW"
	case Keep:
		return "KEEP"
	default:
		return "?"
	}
}

// CleanMethod is how an item is reclaimed.
type CleanMethod int

const (
	methodDefault CleanMethod = iota // unset -> derive from Tier
	Remove                           // rm -rf
	Trash                            // move to OS trash
	Command                          // run Item.Command instead of deleting a path
)

// Source records how an item was discovered.
type Source int

const (
	Catalog Source = iota
	Heuristic
)

// Item is one scannable/cleanable thing.
type Item struct {
	Path     string
	Label    string
	Bytes    int64
	Category Category
	Tier     Tier
	Method   CleanMethod
	Command  []string
	Source   Source
}

// Selectable reports whether the user may select this item for cleaning.
func (i Item) Selectable() bool { return i.Tier != Keep }

// EffectiveMethod resolves the method, deriving from Tier when unset.
func (i Item) EffectiveMethod() CleanMethod {
	if i.Method != methodDefault {
		return i.Method
	}
	if i.Tier == Review {
		return Trash
	}
	return Remove
}
```

- [ ] **Step 4: Run to verify pass**

Run: `go test ./internal/rules/`
Expected: PASS.

- [ ] **Step 5: Commit + push**

```bash
git add -A && git commit -m "feat(rules): core Item/Tier/Category types" && git push
```

---

## Task 3: OS-aware catalog + classifier

**Files:**
- Create: `dscan/internal/rules/catalog.go`
- Modify: `dscan/internal/rules/rules_test.go` (append)

- [ ] **Step 1: Append failing tests**

Append to `dscan/internal/rules/rules_test.go`:
```go
func TestCatalogIsOSAware(t *testing.T) {
	mac := Catalog("darwin", "/home/u")
	lin := Catalog("linux", "/home/u")
	if len(mac) == 0 || len(lin) == 0 {
		t.Fatal("catalog must be non-empty for both OSes")
	}
	hasPath := func(entries []Entry, substr string) bool {
		for _, e := range entries {
			if contains(e.PathTemplate, substr) {
				return true
			}
		}
		return false
	}
	if !hasPath(mac, "Library/Caches") {
		t.Error("macOS catalog should include ~/Library/Caches")
	}
	if !hasPath(lin, ".cache") {
		t.Error("linux catalog should include ~/.cache")
	}
}

func TestCatalogExpandsHome(t *testing.T) {
	entries := Catalog("linux", "/home/u")
	for _, e := range entries {
		if got := e.Expand("/home/u"); len(got) > 0 && got[0] != '/' {
			t.Errorf("Expand should yield absolute path, got %q", got)
		}
	}
}

func TestCatalogHasProtectedKeep(t *testing.T) {
	// At least one KEEP entry must exist so protected data is represented.
	for _, e := range Catalog("darwin", "/home/u") {
		if e.Tier == Keep {
			return
		}
	}
	t.Error("catalog should contain at least one KEEP entry")
}

func TestClassifyHeuristic(t *testing.T) {
	// A path matching a catalog dir name is classified from the catalog;
	// an unknown big dir falls back to Review/LargeFiles.
	got := ClassifyHeuristic("/home/u/SomeBigUnknownDir")
	if got.Tier != Review || got.Category != LargeFiles {
		t.Errorf("unknown path => %v/%v, want Review/LargeFiles", got.Tier, got.Category)
	}
}

// small local helper for the test
func contains(s, sub string) bool {
	return len(sub) == 0 || (len(s) >= len(sub) && indexOf(s, sub) >= 0)
}
func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}
```

- [ ] **Step 2: Run to verify failure**

Run: `go test ./internal/rules/`
Expected: FAIL — `undefined: Catalog`, `Entry`, `ClassifyHeuristic`.

- [ ] **Step 3: Implement the catalog**

Create `dscan/internal/rules/catalog.go`:
```go
package rules

import (
	"path/filepath"
	"strings"
)

// Entry is a catalog rule. PathTemplate uses "~" for the home dir and may end
// with "/*" to mean "each child is its own item".
type Entry struct {
	PathTemplate string
	Label        string
	Category     Category
	Tier         Tier
	Method       CleanMethod
	Command      []string
	GlobChildren bool // PathTemplate ended with /*
}

// Expand resolves "~" to home and strips a trailing "/*".
func (e Entry) Expand(home string) string {
	p := strings.TrimSuffix(e.PathTemplate, "/*")
	if strings.HasPrefix(p, "~") {
		p = filepath.Join(home, strings.TrimPrefix(p, "~"))
	}
	return p
}

func entry(tmpl, label string, cat Category, tier Tier) Entry {
	e := Entry{PathTemplate: tmpl, Label: label, Category: cat, Tier: tier}
	if strings.HasSuffix(tmpl, "/*") {
		e.GlobChildren = true
	}
	return e
}

func cmd(tmpl, label string, cat Category, c ...string) Entry {
	return Entry{PathTemplate: tmpl, Label: label, Category: cat, Tier: Safe, Method: Command, Command: c}
}

// shared cross-platform dependency/build caches (home-relative).
func sharedEntries() []Entry {
	return []Entry{
		entry("~/.npm", "npm cache", PackageStores, Safe),
		entry("~/.yarn/berry/cache", "Yarn berry cache", PackageStores, Safe),
		entry("~/.pnpm-store", "pnpm store", PackageStores, Safe),
		entry("~/.gradle/caches", "Gradle caches", PackageStores, Safe),
		entry("~/.m2/repository", "Maven repo", PackageStores, Safe),
		entry("~/.cargo/registry", "Cargo registry", PackageStores, Safe),
		entry("~/.cache/go-build", "Go build cache", Caches, Safe),
		entry("~/.cache", "Generic ~/.cache", Caches, Safe),
		entry("~/.bun/install/cache", "Bun cache", PackageStores, Safe),
		entry("~/.ssh", "SSH keys", AppData, Keep),
	}
}

// Catalog returns the classification rules for the given GOOS and home dir.
func Catalog(goos, home string) []Entry {
	out := sharedEntries()
	switch goos {
	case "darwin":
		out = append(out,
			entry("~/Library/Caches/*", "~/Library/Caches", Caches, Safe),
			entry("~/Library/Logs", "~/Library/Logs", Caches, Safe),
			entry("~/Library/Developer/Xcode/DerivedData", "Xcode DerivedData", BuildArtifacts, Safe),
			entry("~/Library/Developer/Xcode/iOS DeviceSupport", "iOS DeviceSupport", BuildArtifacts, Safe),
			entry("~/Library/Developer/CoreSimulator/Caches", "Simulator caches", Simulators, Safe),
			cmd("simctl:unavailable", "Delete unavailable simulators", Simulators, "xcrun", "simctl", "delete", "unavailable"),
			cmd("brew:cleanup", "Homebrew cleanup", PackageStores, "brew", "cleanup", "-s"),
			entry("~/Library/Application Support/Postman", "Postman collections", AppData, Keep),
			entry("~/Library/Group Containers/group.net.whatsapp.WhatsApp.shared", "WhatsApp data", AppData, Keep),
		)
	case "linux":
		out = append(out,
			entry("~/.config/google-chrome/Default/Cache", "Chrome cache", Caches, Safe),
			cmd("brew:cleanup", "Homebrew cleanup", PackageStores, "brew", "cleanup", "-s"),
			entry("~/.local/share/keyrings", "Keyrings", AppData, Keep),
		)
	}
	// home is accepted for symmetry/future use; entries are home-relative via Expand.
	_ = home
	return out
}

// ClassifyHeuristic classifies a path discovered by the heuristic walk that the
// catalog did not already cover. Default: user data, treated as a large file.
func ClassifyHeuristic(path string) Item {
	return Item{
		Path:     path,
		Label:    path,
		Category: LargeFiles,
		Tier:     Review,
		Source:   Heuristic,
	}
}
```

- [ ] **Step 4: Run to verify pass**

Run: `go test ./internal/rules/`
Expected: PASS (all rules tests).

- [ ] **Step 5: Commit + push**

```bash
git add -A && git commit -m "feat(rules): OS-aware catalog + heuristic classifier" && git push
```

---

## Task 4: Scan engine

**Files:**
- Create: `dscan/internal/scan/scan.go`
- Create: `dscan/internal/scan/scan_test.go`

- [ ] **Step 1: Write failing tests**

Create `dscan/internal/scan/scan_test.go`:
```go
package scan

import (
	"os"
	"path/filepath"
	"testing"
)

func writeFile(t *testing.T, path string, size int) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, make([]byte, size), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestDirSize(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, filepath.Join(dir, "a.bin"), 1000)
	writeFile(t, filepath.Join(dir, "sub", "b.bin"), 2000)
	got, err := DirSize(dir)
	if err != nil {
		t.Fatal(err)
	}
	if got < 3000 {
		t.Errorf("DirSize = %d, want >= 3000", got)
	}
}

func TestDirSizeMissingPath(t *testing.T) {
	// Missing path returns 0, no error (catalog entries may not exist).
	got, err := DirSize(filepath.Join(t.TempDir(), "nope"))
	if err != nil || got != 0 {
		t.Errorf("missing path => (%d,%v), want (0,nil)", got, err)
	}
}

func TestTopNLargest(t *testing.T) {
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "big", "x.bin"), 5000)
	writeFile(t, filepath.Join(root, "small", "y.bin"), 100)
	writeFile(t, filepath.Join(root, "mid", "z.bin"), 1000)
	got := TopNLargest(root, 2, nil)
	if len(got) != 2 {
		t.Fatalf("want 2 results, got %d", len(got))
	}
	if filepath.Base(got[0].Path) != "big" {
		t.Errorf("largest should be 'big', got %q", got[0].Path)
	}
}

func TestTopNSkipsCovered(t *testing.T) {
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "covered", "x.bin"), 5000)
	writeFile(t, filepath.Join(root, "fresh", "y.bin"), 4000)
	covered := map[string]bool{filepath.Join(root, "covered"): true}
	got := TopNLargest(root, 5, covered)
	for _, it := range got {
		if it.Path == filepath.Join(root, "covered") {
			t.Error("covered path must be skipped")
		}
	}
}
```

- [ ] **Step 2: Run to verify failure**

Run: `go test ./internal/scan/`
Expected: FAIL — `undefined: DirSize`, `TopNLargest`.

- [ ] **Step 3: Implement the scanner**

Create `dscan/internal/scan/scan.go`:
```go
// Package scan walks the filesystem to measure sizes and surface large items.
// Terminal-agnostic; safe against permission errors and missing paths.
package scan

import (
	"io/fs"
	"os"
	"path/filepath"
	"sort"

	"github.com/gor3a/disk-scan/internal/rules"
)

// DirSize returns the total bytes under path (recursively). A missing path
// returns (0, nil). Permission errors on individual entries are ignored.
func DirSize(path string) (int64, error) {
	info, err := os.Lstat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return 0, nil
		}
		return 0, err
	}
	if !info.IsDir() {
		return info.Size(), nil
	}
	var total int64
	_ = filepath.WalkDir(path, func(_ string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil // skip unreadable entries
		}
		if d.IsDir() {
			return nil
		}
		if fi, e := d.Info(); e == nil {
			total += fi.Size()
		}
		return nil
	})
	return total, nil
}

// Found is a heuristic result.
type Found = rules.Item

// TopNLargest measures each immediate child dir/file of root and returns the n
// largest, skipping any path present in covered. Sorted largest-first.
func TopNLargest(root string, n int, covered map[string]bool) []Found {
	entries, err := os.ReadDir(root)
	if err != nil {
		return nil
	}
	var items []Found
	for _, de := range entries {
		p := filepath.Join(root, de.Name())
		if covered[p] {
			continue
		}
		size, _ := DirSize(p)
		if size == 0 {
			continue
		}
		it := rules.ClassifyHeuristic(p)
		it.Bytes = size
		items = append(items, it)
	}
	sort.Slice(items, func(i, j int) bool { return items[i].Bytes > items[j].Bytes })
	if n >= 0 && len(items) > n {
		items = items[:n]
	}
	return items
}
```

- [ ] **Step 4: Run to verify pass**

Run: `go test ./internal/scan/`
Expected: PASS.

- [ ] **Step 5: Commit + push**

```bash
git add -A && git commit -m "feat(scan): dir sizing + top-N largest with de-dup" && git push
```

---

## Task 5: Cleaner (Remove / Trash / Command) + dry-run

**Files:**
- Create: `dscan/internal/clean/clean.go`
- Create: `dscan/internal/clean/trash_darwin.go`
- Create: `dscan/internal/clean/trash_linux.go`
- Create: `dscan/internal/clean/clean_test.go`

- [ ] **Step 1: Write failing tests**

Create `dscan/internal/clean/clean_test.go`:
```go
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
```

- [ ] **Step 2: Run to verify failure**

Run: `go test ./internal/clean/`
Expected: FAIL — `undefined: Run`, `Options`.

- [ ] **Step 3: Implement the cleaner core**

Create `dscan/internal/clean/clean.go`:
```go
// Package clean executes a selection of items: hard-delete caches, trash user
// data, or run a tool command. Refuses to touch Keep items.
package clean

import (
	"os"

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
```

- [ ] **Step 4: Implement command runner + shared trash entrypoint**

Append to `dscan/internal/clean/clean.go`:
```go
import (
	"os"
	"os/exec"
	"path/filepath"
)

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
```
(Merge the two `import` blocks into one — `os`, `os/exec`, `path/filepath`.)

- [ ] **Step 5: Implement OS trash backends**

Create `dscan/internal/clean/trash_darwin.go`:
```go
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
```

Create `dscan/internal/clean/trash_linux.go`:
```go
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
```

- [ ] **Step 6: Run to verify pass**

Run: `go test ./internal/clean/`
Expected: PASS. (On the dev machine GOOS=darwin compiles `trash_darwin.go`.)

- [ ] **Step 7: Verify the Linux build compiles too**

Run: `GOOS=linux GOARCH=amd64 go build ./...`
Expected: builds clean (exercises `trash_linux.go`).

- [ ] **Step 8: Commit + push**

```bash
git add -A && git commit -m "feat(clean): remove/trash/command cleaner with dry-run + OS trash" && git push
```

---

## Task 6: TUI selection model (headless logic)

**Files:**
- Create: `dscan/internal/tui/model.go`
- Create: `dscan/internal/tui/model_test.go`

- [ ] **Step 1: Write failing tests**

Create `dscan/internal/tui/model_test.go`:
```go
package tui

import (
	"testing"

	"github.com/gor3a/disk-scan/internal/rules"
)

func sample() []rules.Item {
	return []rules.Item{
		{Label: "DerivedData", Bytes: 100, Tier: rules.Safe},
		{Label: "userdata", Bytes: 200, Tier: rules.Review},
		{Label: "whatsapp", Bytes: 300, Tier: rules.Keep},
	}
}

func TestToggleAndTotal(t *testing.T) {
	m := New(sample())
	m.Toggle(0) // select DerivedData
	if got := m.SelectedBytes(); got != 100 {
		t.Errorf("SelectedBytes = %d, want 100", got)
	}
	m.Toggle(1) // select userdata
	if got := m.SelectedBytes(); got != 300 {
		t.Errorf("SelectedBytes = %d, want 300", got)
	}
	m.Toggle(0) // deselect DerivedData
	if got := m.SelectedBytes(); got != 200 {
		t.Errorf("SelectedBytes = %d, want 200", got)
	}
}

func TestToggleKeepIsNoop(t *testing.T) {
	m := New(sample())
	m.Toggle(2) // whatsapp is Keep
	if got := m.SelectedBytes(); got != 0 {
		t.Errorf("Keep toggle must be a no-op, SelectedBytes = %d", got)
	}
	if len(m.Selected()) != 0 {
		t.Error("Keep item must not appear in Selected()")
	}
}

func TestSelectedReturnsItems(t *testing.T) {
	m := New(sample())
	m.Toggle(1)
	sel := m.Selected()
	if len(sel) != 1 || sel[0].Label != "userdata" {
		t.Errorf("Selected() = %+v, want [userdata]", sel)
	}
}
```

- [ ] **Step 2: Run to verify failure**

Run: `go test ./internal/tui/`
Expected: FAIL — `undefined: New`.

- [ ] **Step 3: Implement the model**

Create `dscan/internal/tui/model.go`:
```go
// Package tui holds the interactive checklist. The selection logic lives in
// Model and is tested headless; Bubble Tea view/update wiring is thin.
package tui

import "github.com/gor3a/disk-scan/internal/rules"

// Model is the pure, testable selection state.
type Model struct {
	items    []rules.Item
	selected map[int]bool
	cursor   int
}

// New builds a Model over the scanned items.
func New(items []rules.Item) *Model {
	return &Model{items: items, selected: map[int]bool{}}
}

// Toggle flips selection for the item at index i. No-op for Keep items.
func (m *Model) Toggle(i int) {
	if i < 0 || i >= len(m.items) {
		return
	}
	if !m.items[i].Selectable() {
		return
	}
	if m.selected[i] {
		delete(m.selected, i)
	} else {
		m.selected[i] = true
	}
}

// SelectedBytes is the running freed-space total of selected items.
func (m *Model) SelectedBytes() int64 {
	var total int64
	for i := range m.selected {
		total += m.items[i].Bytes
	}
	return total
}

// Selected returns the chosen items.
func (m *Model) Selected() []rules.Item {
	var out []rules.Item
	for i := range m.selected {
		out = append(out, m.items[i])
	}
	return out
}

// Items exposes all items (for rendering).
func (m *Model) Items() []rules.Item { return m.items }
```

- [ ] **Step 4: Run to verify pass**

Run: `go test ./internal/tui/`
Expected: PASS.

- [ ] **Step 5: Commit + push**

```bash
git add -A && git commit -m "feat(tui): headless selection model + freed-space total" && git push
```

---

## Task 7: Wire it together — `main.go` + Bubble Tea view

**Files:**
- Create: `dscan/main.go`
- Create: `dscan/program.go`
- Modify: `dscan/internal/clean/clean.go` (append `FreedBytesOrPlanned`)
- Delete: `dscan/doc_smoke_test.go`

- [ ] **Step 1: Remove the smoke test**

Run: `rm dscan/doc_smoke_test.go` (from repo root: `rm doc_smoke_test.go`)

- [ ] **Step 2: Implement main + Bubble Tea wiring**

Create `dscan/main.go`:
```go
// Command dscan scans the disk, categorizes space, and cleans selected items.
package main

import (
	"flag"
	"fmt"
	"os"
	"runtime"
	"sort"

	tea "github.com/charmbracelet/bubbletea"

	"github.com/gor3a/disk-scan/internal/clean"
	"github.com/gor3a/disk-scan/internal/rules"
	"github.com/gor3a/disk-scan/internal/scan"
)

var (
	flagSystem  = flag.Bool("system", false, "also scan system dirs (slow/permissioned)")
	flagDryRun  = flag.Bool("dry-run", false, "preview actions without deleting")
	flagVersion = flag.Bool("version", false, "print version and exit")
	version     = "0.1.0"
)

func main() {
	flag.Parse()
	if *flagVersion {
		fmt.Println("dscan", version)
		return
	}
	home, _ := os.UserHomeDir()
	items := scanAll(runtime.GOOS, home, *flagSystem)

	m := newProgram(items)
	prog := tea.NewProgram(m)
	final, err := prog.Run()
	if err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
	pm := final.(*programModel)
	if !pm.confirmed {
		return
	}
	res := clean.Run(pm.model.Selected(), clean.Options{DryRun: *flagDryRun})
	report(res, *flagDryRun)
}

// scanAll runs the catalog pass then the heuristic pass, de-duped.
func scanAll(goos, home string, system bool) []rules.Item {
	var items []rules.Item
	covered := map[string]bool{}
	for _, e := range rules.Catalog(goos, home) {
		if e.Method == rules.Command {
			items = append(items, rules.Item{
				Label: e.Label, Category: e.Category, Tier: e.Tier,
				Method: rules.Command, Command: e.Command, Source: rules.CatalogSource,
			})
			continue
		}
		path := e.Expand(home)
		size, _ := scan.DirSize(path)
		if size == 0 {
			continue
		}
		covered[path] = true
		items = append(items, rules.Item{
			Path: path, Label: e.Label, Bytes: size,
			Category: e.Category, Tier: e.Tier, Method: e.Method, Source: rules.CatalogSource,
		})
	}
	items = append(items, scan.TopNLargest(home, 20, covered)...)
	sort.SliceStable(items, func(i, j int) bool {
		if items[i].Tier != items[j].Tier {
			return items[i].Tier < items[j].Tier
		}
		return items[i].Bytes > items[j].Bytes
	})
	return items
}

func report(res clean.Result, dry bool) {
	verb := "Freed"
	if dry {
		verb = "Would free"
	}
	fmt.Printf("%s %s across %d items (%d skipped).\n",
		verb, humized(res.FreedBytesOrPlanned(dry)), len(res.Actions), len(res.Skipped))
	for _, a := range res.Actions {
		if a.Err != nil {
			fmt.Fprintf(os.Stderr, "  ! %s: %v\n", a.Item.Label, a.Err)
		}
	}
}

func humized(b int64) string { //nolint:revive // small local formatter
	const u = 1024
	if b < u {
		return fmt.Sprintf("%dB", b)
	}
	div, exp := int64(u), 0
	for n := b / u; n >= u; n /= u {
		div *= u
		exp++
	}
	return fmt.Sprintf("%.1f%cB", float64(b)/float64(div), "KMGTPE"[exp])
}
```

- [ ] **Step 3: Add the planned-bytes helper to the clean package**

Append to `dscan/internal/clean/clean.go`:
```go
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
```

- [ ] **Step 4: Implement the Bubble Tea program model**

Create `dscan/program.go`:
```go
package main

import (
	"fmt"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"github.com/gor3a/disk-scan/internal/rules"
	"github.com/gor3a/disk-scan/internal/tui"
)

type programModel struct {
	model     *tui.Model
	cursor    int
	confirmed bool
}

func newProgram(items []rules.Item) *programModel {
	return &programModel{model: tui.New(items)}
}

func (m *programModel) Init() tea.Cmd { return nil }

func (m *programModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	if key, ok := msg.(tea.KeyMsg); ok {
		switch key.String() {
		case "q", "ctrl+c":
			return m, tea.Quit
		case "up", "k":
			if m.cursor > 0 {
				m.cursor--
			}
		case "down", "j":
			if m.cursor < len(m.model.Items())-1 {
				m.cursor++
			}
		case " ":
			m.model.Toggle(m.cursor)
		case "enter":
			m.confirmed = true
			return m, tea.Quit
		}
	}
	return m, nil
}

func (m *programModel) View() string {
	var b lipgloss.Style
	_ = b
	out := fmt.Sprintf("dscan — space to toggle, enter to clean, q to quit\nSELECTED: %s\n\n", humized(m.model.SelectedBytes()))
	for i, it := range m.model.Items() {
		cursor := "  "
		if i == m.cursor {
			cursor = "> "
		}
		check := "[ ]"
		if !it.Selectable() {
			check = "[-]"
		}
		out += fmt.Sprintf("%s%s %-32s %10s  %s\n", cursor, check, it.Label, humized(it.Bytes), it.Tier)
	}
	return out
}

// cursor lives on programModel to keep tui.Model free of view concerns.
```

- [ ] **Step 5: Build + run smoke test of the binary**

Run:
```bash
go build -o /tmp/dscan . && echo '--- version ---' && /tmp/dscan --version && echo '--- dry-run, no TTY: should scan and exit without crashing ---' && /tmp/dscan --dry-run </dev/null || true
```
Expected: `dscan 0.1.0` prints. The TUI may exit immediately without a TTY — that is fine; no panic. Then verify the whole suite:
```bash
go vet ./... && go test ./...
```
Expected: vet clean; all packages `ok`.

- [ ] **Step 6: Verify Linux build**

Run: `GOOS=linux GOARCH=amd64 go build -o /dev/null .`
Expected: builds clean.

- [ ] **Step 7: Commit + push**

```bash
git add -A && git commit -m "feat: wire scan->rules->tui->clean in main + bubbletea program" && git push
```

---

## Task 8: README + install.sh integration

**Files:**
- Create: `dscan/README.md`
- Modify: `~/Documents/work/dotai/install.sh` (this is the DOTAI repo, not dscan)

- [ ] **Step 1: Write the README**

Create `dscan/README.md`:
```markdown
# dscan

Interactive terminal disk scanner & cleaner for macOS and Linux.

`dscan` scans known cache/build/package locations plus the largest items in your
home dir, groups them by category and safety tier, and lets you check off what to
clean. Regenerable caches are hard-deleted; real user data is moved to the OS
Trash; protected data (browser profiles, messaging apps, SSH keys) is never
selectable.

## Usage

```
dscan              # scan + interactive checklist
dscan --system     # also scan system dirs (slow, may need permissions)
dscan --dry-run    # preview what would be cleaned, delete nothing
dscan --version
```

Keys: `↑/↓` move · `space` toggle · `enter` clean selected · `q` quit.

## Install

Built from the dotai repo by `install.sh` (`go build` → `~/.local/bin/dscan`),
or manually:

```
go build -o ~/.local/bin/dscan .
```

## Safety

- SAFE (caches, build output) → hard-deleted (regenerates on next use).
- REVIEW (user data) → moved to OS Trash (recoverable).
- KEEP (browser/messaging/SSH) → shown but never selectable.
- `--dry-run` performs no deletion.
```

- [ ] **Step 2: Commit the README (dscan repo)**

```bash
cd ~/Documents/work/dotai/dscan
git add README.md && git commit -m "docs: README" && git push
```

- [ ] **Step 3: Add the build step to dotai's install.sh**

In `~/Documents/work/dotai/install.sh`, after the smart-resume block (the section that links `smart-resume/`), insert:
```bash
# dscan (disk scanner/cleaner — separate repo at dotai/dscan)
DSCAN_SRC="$DOTAI_DIR/dscan"
if [ -d "$DSCAN_SRC" ] && [ -f "$DSCAN_SRC/go.mod" ]; then
  echo "dscan:"
  if command -v go >/dev/null 2>&1; then
    if [ "$MODE" = "--dry" ]; then
      dry "dscan → would 'go build' to ~/.local/bin/dscan"
    else
      mkdir -p "$HOME/.local/bin"
      if (cd "$DSCAN_SRC" && go build -o "$HOME/.local/bin/dscan" . 2>/dev/null); then
        ok "dscan → ~/.local/bin/dscan"
      else
        warn "dscan build failed — run 'cd $DSCAN_SRC && go build' to see why"
      fi
    fi
  else
    warn "go not installed — skipping dscan build (install Go, then re-run)"
  fi
  echo ""
fi
```

- [ ] **Step 4: Verify install.sh dry-run mentions dscan**

Run: `cd ~/Documents/work/dotai && ./install.sh --dry 2>&1 | grep -i dscan`
Expected: a line like `dscan → would 'go build' to ~/.local/bin/dscan`.

- [ ] **Step 5: Commit install.sh (DOTAI repo)**

```bash
cd ~/Documents/work/dotai
git add install.sh && git commit -m "feat: build dscan during install" && git push origin main
```

---

## Task 9: Real install + end-to-end dry-run verification

**Files:** none (verification only)

- [ ] **Step 1: Build via install.sh and confirm the binary**

Run:
```bash
cd ~/Documents/work/dotai && ./install.sh 2>&1 | grep -i dscan
ls -l ~/.local/bin/dscan && ~/.local/bin/dscan --version
```
Expected: install reports building dscan; binary exists; prints `dscan 0.1.0`.

- [ ] **Step 2: End-to-end dry-run against the real home dir**

Run: `~/.local/bin/dscan --dry-run </dev/null`
Expected: no panic, exits cleanly (TUI without a TTY exits immediately; with a TTY it shows the checklist). This confirms a real scan runs without crashing.

- [ ] **Step 3: Full suite + vet one last time**

Run: `cd ~/Documents/work/dotai/dscan && go vet ./... && go test ./...`
Expected: vet clean; all `ok`.

- [ ] **Step 4: Final confirmation the two repos are independent**

Run:
```bash
cd ~/Documents/work/dotai/dscan && git log --oneline | head
cd ~/Documents/work/dotai && git status --short   # should NOT list dscan/
```
Expected: dscan has its own commit history; dotai shows a clean tree with `dscan/` ignored.

---

## Done criteria

- `go test ./...` green; `go vet ./...` clean; `GOOS=linux go build` clean.
- `dscan --version`, `dscan --dry-run`, and the interactive TUI all run without panic.
- `~/.local/bin/dscan` built by `install.sh` when Go is present.
- `gor3a/disk-scan` has a commit+push per task; dotai tracks only the `.gitignore` + `install.sh` edits and ignores `/dscan/`.
- KEEP items never deletable; SAFE → rm, REVIEW → trash, verified by `internal/clean` tests.
```
