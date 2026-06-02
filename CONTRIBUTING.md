# Contributing to dscan

Thanks for your interest in improving `dscan` — an interactive, cross-platform
(macOS + Linux) disk scanner and cleaner. This guide covers everything you need
to make a change with confidence.

By participating, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to contribute

- **Add or refine catalog entries** — teach `dscan` about a new cache/build
  location or fix a misclassification. This is the most common and welcome
  contribution (see [Adding a catalog entry](#adding-a-catalog-entry)).
- **Fix bugs** — see open issues, or file one first.
- **Improve the TUI / UX.**
- **Docs** — clarify usage, fix typos, improve this guide.

For anything larger than a bug fix or a catalog tweak, please open an issue to
discuss the approach first so we don't duplicate effort.

## Development setup

Requirements:

- **Go 1.24+** (the version is pinned in `go.mod`; `go` will fetch the matching
  toolchain automatically).
- macOS or Linux. Changes must build and pass tests on **both**.

```bash
git clone https://github.com/gor3a/disk-scan.git
cd disk-scan
go build -o /tmp/dscan .   # build
/tmp/dscan --version       # smoke test
/tmp/dscan --dry-run       # scan + interactive checklist, deletes nothing
```

## Project layout

The engine packages are terminal-agnostic so a future GUI can reuse them; only
`tui`/`program.go` know about the terminal.

```
internal/rules/   Item model + OS-aware catalog & classifier  (no I/O)
internal/scan/    filesystem sizing + top-N largest           (read-only)
internal/clean/   remove / trash / command execution + dry-run
internal/tui/     headless selection Model (pure, fully tested)
main.go           CLI flags + wiring (scan → rules → tui → clean)
program.go        Bubble Tea view/update wiring
```

## The checks (these are the CI gates)

Run all of these before pushing — CI runs the same on macOS and Linux:

```bash
gofmt -l .            # must print nothing (run `gofmt -w .` to fix)
go vet ./...          # must be clean
go test ./...         # all packages must pass
go build ./...        # must build
GOOS=linux  go build ./...   # if you're on macOS, confirm Linux still builds
GOOS=darwin go build ./...   # if you're on Linux, confirm macOS still builds
```

## Test-driven development

We follow TDD. For any logic change:

1. Write a failing test that captures the desired behavior.
2. Make it pass with the minimal change.
3. Refactor if needed; keep tests green.

Tests are table-driven where it helps. The selection model (`internal/tui`),
classifier (`internal/rules`), scanner (`internal/scan`), and cleaner
(`internal/clean`) are all unit-tested without a terminal; `main_test.go` has an
end-to-end pipeline test against a temp `HOME`.

## Safety rules (non-negotiable)

`dscan` deletes files, so safety is reviewed strictly:

- **Never make a `KEEP` item selectable.** Protected data (browser profiles,
  messaging apps, SSH keys, credential stores) must stay `Tier: Keep`.
- **User data defaults to Trash, not `rm`.** Use `Tier: Review` (which resolves
  to the Trash method) for anything that isn't a regenerable cache/build output.
- **Every code path that can delete must have a test** proving it only touches
  the intended target and that `--dry-run` is side-effect-free.
- Tests must redirect the trash via `DSCAN_TRASH_DIR` — never touch the real
  Trash from a test.

## Adding a catalog entry

Most contributions are new entries in `internal/rules/catalog.go`. An entry maps
a path (or a tool command) to a category, a safety tier, and a clean method.

```go
// In sharedEntries() for cross-platform paths, or the darwin/linux case in Catalog().
entry("~/.foo/cache", "Foo cache", Caches, Safe)            // hard-deletable cache
entry("~/.config/foo", "Foo settings", AppData, Keep)       // protected user data
cmd("brew:cleanup", "Homebrew cleanup", PackageStores,      // run a tool instead of rm
    "brew", "cleanup", "-s")
```

Guidelines:

- Use `~` for the home dir; it is expanded per-user.
- Pick the tier honestly: `Safe` only if it regenerates automatically with no
  data loss. When in doubt, use `Review` (→ Trash) or `Keep`.
- For managed stores (package managers, simulators, Docker), prefer a `cmd(...)`
  entry that runs the tool's own cleanup rather than `rm`-ing its directory.
- Keep macOS-only paths in the `darwin` case and Linux-only paths (XDG, distro
  caches) in the `linux` case; truly shared ones go in `sharedEntries()`.
- Add/adjust a test in `internal/rules/rules_test.go` if you change
  classification behavior.

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(rules): add catalog entry for the Foo cache
fix(clean): guard against empty paths before removal
docs: clarify the --system flag
test(scan): cover prefix-based de-dup
chore: bump dependency
```

Common types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `perf`.

## Pull request workflow

1. Fork (or branch if you have access). Create a focused branch:
   `git checkout -b feat/foo-cache`.
2. Make your change with tests. Keep PRs small and single-purpose.
3. Run the checks above; ensure they pass on your OS and that the other OS still
   builds.
4. Open a PR against `main`. Fill in the PR template; link any related issue.
5. CI must be green and at least one maintainer review is required to merge.

Be ready to iterate on review feedback — see our approach in
[Code of Conduct](CODE_OF_CONDUCT.md). We aim to keep reviews timely and kind.

## Reporting bugs and security issues

- Bugs / features: open a GitHub issue using the templates.
- Security vulnerabilities: **do not** open a public issue — see
  [SECURITY.md](SECURITY.md).
