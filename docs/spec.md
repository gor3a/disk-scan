# dscan — Interactive Disk Scanner & Cleaner — Design Spec

**Date:** 2026-06-02
**Status:** Approved for planning
**Repo:** `gor3a/disk-scan` — independent git repo.
**Command:** `dscan`

## Goal

A cross-platform (macOS + Linux) interactive terminal tool that scans the disk,
categorizes space consumers (the way the manual multi-agent scan did), and lets
the user check off items to clean — hard-deleting regenerable caches and moving
real user data to the OS Trash. Built so a future GUI can reuse the engine.

## Decisions (from brainstorming)

| Decision | Choice |
|----------|--------|
| Interaction | Interactive TUI checklist (Bubble Tea): scan → live grouped list → toggle items → confirm → clean. |
| Tech | Go, single static binary. Bubble Tea for the TUI. |
| Safety | Smart: `SAFE` caches → `rm`; `REVIEW`/user data → OS Trash (recoverable); `KEEP` list never selectable; dry-run-style confirmation before any delete. |
| Layout | Its **own** self-contained git repo (docs/spec/tests/README inside). |
| Remote | `gor3a/disk-scan`; commit every step and push. |
| GUI | Deferred (YAGNI). Engine packages stay terminal-agnostic so a Wails/web GUI can reuse them. |

## Architecture

Single Go binary; four decoupled packages plus `main`:

```
dscan/
├─ docs/            spec.md
├─ internal/
│  ├─ scan/         concurrent filesystem walkers → []Item, live progress
│  ├─ rules/        OS-aware catalog + classifier (category, tier, reversibility)
│  ├─ clean/        executes a selection: rm for caches, trash for data
│  └─ tui/          Bubble Tea checklist model (the only frontend for now)
├─ main.go          wires scan → rules → tui → clean; flags --help/--version/--system
├─ go.mod
├─ README.md
└─ .git/            independent repo
```

`scan`, `rules`, `clean` are pure library code with **no terminal dependency** —
a future GUI imports the same engine and swaps only `tui/`. `internal/` keeps the
engine private to this module until a stable API is wanted.

## Core type

```go
// rules.Item — one scannable/cleanable thing.
type Item struct {
    Path     string         // absolute path (or logical id for tool-cleaned entries)
    Label    string         // human name shown in the TUI
    Bytes    int64          // measured size
    Category Category       // Caches | BuildArtifacts | PackageStores | Simulators | LargeFiles | AppData
    Tier     Tier           // Safe | Review | Keep
    Method   CleanMethod    // Remove | Trash | Command
    Command  []string       // for Method==Command (e.g. docker system prune)
    Source   Source         // Catalog | Heuristic
}
```

`Tier=Keep` items are display-only and can never be selected. `Method` is decided
by the catalog entry (or defaults: Safe→Remove, Review→Trash).

## Scan engine (`internal/scan`)

Two passes over a bounded worker pool, emitting progress events to the TUI:

1. **Catalog pass** — for each known entry from `rules` that exists on disk,
   measure its size (`du`-equivalent walk). These are the high-confidence,
   pre-classified consumers (package caches, Xcode/sim data, `~/Library/Caches`,
   `node_modules`/`.next`/`.angular`, brew, etc.).
2. **Heuristic pass** — walk `$HOME` (and, only with `--system`, a small set of
   system dirs) to a bounded depth, surfacing the top-N largest dirs/files that
   the catalog didn't already cover, classified `Review` by default.

Safety/robustness while scanning:
- Stay on a single filesystem (skip network/other mounts via dev-id check).
- Skip SIP / `/System` and unreadable paths; swallow permission errors.
- Bounded walk depth and an overall time cap; partial results still render.
- De-dup: heuristic results that fall under a catalog path are dropped so sizes
  aren't double-counted.

## Ruleset & classification (`internal/rules`)

A static, **OS-aware** catalog (selected by `runtime.GOOS`, injectable for tests):

- **macOS:** `~/Library/Caches`, `~/Library/Logs`, `~/Library/Developer/Xcode/{DerivedData,iOS DeviceSupport}`, `~/Library/Developer/CoreSimulator/Caches`, `/Library/Developer/CoreSimulator` (system, `--system`), Homebrew (`brew --cache`), etc.
- **Linux:** XDG dirs — `~/.cache`, `/var/cache` (`--system`), `~/.local/share/Trash`, distro package caches where detectable.
- **Shared:** `~/.npm ~/.yarn ~/.pnpm-store ~/.gradle ~/.m2 ~/.cargo ~/.cache/go-build ~/go`, project `node_modules`/`.next`/`dist`/`.angular/cache`/`build`, Playwright/Puppeteer browser caches.

Each entry encodes `Category`, `Tier`, and `Method`. **Protected KEEP** examples
(never selectable): browser profiles, WhatsApp/Signal/Telegram data, Postman
collections, `~/.ssh`, keychains/credential stores, password-manager vaults.

A few entries use `Method=Command` so we don't corrupt managed stores:
`docker system prune`, `xcrun simctl delete unavailable`, `pnpm store prune`,
`brew cleanup -s`.

## TUI (`internal/tui`, Bubble Tea)

- **Header:** live disk used/free for the scanned volume + scan progress bar.
- **Body:** items grouped `Tier → Category`; `↑/↓` move, `space` toggle item,
  `a` toggle whole group, `KEEP` rows greyed and unselectable. Running
  **SELECTED reclaim total** updates as you toggle.
- **Confirm screen:** lists exactly what will be `rm`'d vs moved to Trash vs
  tool-cleaned; requires explicit confirm.
- **Execute:** per-item progress, error-tolerant (one failure doesn't abort the
  rest), final reclaimed-space summary.
- `q`/`ctrl-c` exits without modifying anything at any pre-execute stage.

The selection/total logic lives in a pure model struct, testable headless.

## Cleaner & safety (`internal/clean`)

- `Method=Remove` → delete directory/file directly (regenerable caches).
- `Method=Trash` → OS Trash:
  - **macOS:** move to `~/.Trash` following Finder "Put Back" metadata, or invoke
    Finder via `osascript` for correctness.
  - **Linux:** freedesktop trash spec — `gio trash` if available, else move into
    `~/.local/share/Trash/{files,info}` with a `.trashinfo` record.
- `Method=Command` → run the encoded command, surfacing its output.
- Never touches `Tier=Keep`. Confirmation required. A `--dry-run` mode logs the
  exact actions without performing them.

## Cross-platform & distribution

- `runtime.GOOS` switches the catalog and the trash backend; all other code shared.
- Install via `go install github.com/gor3a/disk-scan@latest`, or build from a
  checkout: `go build -o "$HOME/.local/bin/dscan" .` (ensure `~/.local/bin` is on
  `PATH`). Requires a Go toolchain.

## Testing (Go, table-driven)

- **rules:** path → (Category, Tier, Method) for both `GOOS` values via injected OS; KEEP paths classified non-selectable.
- **scan:** aggregation + top-N selection on a synthetic temp tree; de-dup of heuristic-under-catalog; single-filesystem guard; permission-error tolerance.
- **clean:** `--dry-run` against a temp dir asserts nothing is removed; `Trash` resolver picks the right backend/path per OS; `Remove` deletes only targeted paths; `Keep` items rejected.
- **tui:** selection math and SELECTED-total computed by the pure model, headless.

## Out of scope (YAGNI)

GUI, scheduled/auto-on-pressure runs, remote/SSH scanning, user-editable rule
config files, prebuilt-binary release pipeline. The engine split keeps each cheap
to add later.

## Defaults

- Command name: `dscan`; install path `~/.local/bin/dscan` (no sudo).
- System dirs (`/Library/Developer/CoreSimulator`, `/usr/local`, `/var/cache`)
  scanned only with `--system` (slow / permissioned).
