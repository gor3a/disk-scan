# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Release scripts (`scripts/release.sh`, `scripts/publish.sh`) that automate the
  version bump, CHANGELOG promotion, tagging, and release publishing.
- Repository governance — `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`,
  and GitHub pull-request / issue templates.
- A `shellcheck` lint workflow and `scripts/lint.sh`.

## [0.6.0] - 2026-06-10

### Added

- **App architecture audit (macOS)** — a new **Apps** tab on Apple Silicon Macs
  that lists installed apps with an **Intel / Universal / Apple Silicon** badge,
  flags Intel-only apps that run under Rosetta, and offers Reveal, **Find Apple
  Silicon version** (Mac App Store, falling back to a web search), and
  **Uninstall** (the app bundle plus its matching support files, all moved to the
  Trash so they're recoverable). Hidden on Intel Macs and Linux.
- **Per-tab Reload / Stop** — every tab now has a single toggle that rescans when
  idle and stops an in-progress scan.
- **Keyboard shortcuts** — ⌘/Ctrl+R rescans the current tab, ⌘/Ctrl+1–4 switch
  tabs, Esc stops a scan, and ⌘/Ctrl+, opens Settings.

### Changed

- Disabled the browser's built-in shortcuts (reload / zoom / view-source); a
  custom application menu keeps copy/paste and adds a Dev menu with DevTools in
  development builds only.
- Removed the Ko-fi button from the footer.

## [0.5.1] - 2026-06-07

### Changed

- **Custom title bar** — replaced the native window chrome with an in-app title
  bar carrying its own minimize / maximize / close controls (drag to move,
  double-click to maximize), consistent across macOS and Linux in light and dark.

## [0.5.0] - 2026-06-07

### Added

- **Disk map** — a visual **Map** tab: pick a folder and see its contents as a
  drill-down treemap sized by bytes, with Reveal / Exclude / Move-to-Trash on a
  tile.
- **Exclude folders** — mark folders dscan should never scan or clean, from a
  result row or a managed list in Settings.
- **Scheduled scans** — an optional background scan (Off / Daily / Weekly) that
  notifies you when there's space to reclaim, with an opt-in auto-clean of SAFE
  caches. Uses a LaunchAgent (macOS) / systemd user timer (Linux).
- **Self-update** — the app checks GitHub for new releases: Linux downloads and
  installs in the background; macOS notifies and links to the download (full
  auto-install arrives with code signing).

### Changed

- Replaced all emoji icons with the **lucide** icon set for a cleaner, consistent
  look in both light and dark themes.

## [0.4.0] - 2026-06-07

### Added

- **Dark mode** — a **System / Light / Dark** theme (default follows the OS),
  chosen in Settings. Neutral-slate dark palette that recolors the whole app and
  tracks OS changes live.

## [0.3.1] - 2026-06-07

### Added

- **Intel macOS build** — releases now include both Apple Silicon
  (`-arm64.dmg`) and Intel (`-x64.dmg`) builds; each bundles a universal Go
  sidecar.
- **Sort** — cleanup lists show biggest-first; the Projects tab has a
  Size / Oldest / Name sort control.

### Fixed

- The Projects tab's disk gauge now reflects real usage (the projects scan emits
  a disk-usage event).

## [0.3.0] - 2026-06-06

### Added

- **Top menu** — a logo header with a `⋯` dropdown: Contact us, Support (Ko-fi),
  Settings, About, and **Uninstall**. Uninstall self-removes the app and its data
  to the Trash (OS-aware; dev/package-managed installs show a notice instead).
- **More project types** — the Projects tab now finds `.next`, `.nuxt`,
  `.svelte-kit`, `.turbo`, `__pycache__`, `.gradle`, and (gated by a sibling
  manifest) `target`/`dist`/`build`/`out`, grouped by kind.
- **Settings** — adjustable staleness threshold and a remembered project folder,
  persisted across launches.
- **Reclaim history & stats** — every clean is logged; About shows your all-time
  reclaimed total.
- **Reveal in Finder** — a per-row action to inspect an item before cleaning.
- **Safer project cleaning** — processes holding a project folder are signalled to
  stop (`lsof`-based, best-effort) before its artifacts are removed.

### Fixed

- Auto-selection now re-derives as items stream in and when the staleness
  threshold changes, until you manually toggle.

## [0.2.1] - 2026-06-06

### Added

- **Projects (node_modules) cleaner** — a new Projects tab finds `node_modules`
  directories under a chosen folder (default `~`, via a native folder picker),
  shows each project's size and last-used date, auto-selects stale ones
  (untouched > 30 days), and reclaims their space. Nested `node_modules` are
  skipped; the walk is single-filesystem and permission-tolerant.
- **Progressive scanning** — both tabs now render results as they stream, with a
  live phase/count/size line, the current path being walked, and a **Stop**
  button. Cleaning works **mid-scan**: cleaned rows disappear with a "Reclaimed"
  summary while the scan keeps running.

## [0.2.0] - 2026-06-06

### Added

- **Desktop GUI** (`desktop/`) — an Electron + React app aimed at non-technical
  users. Auto-scans on launch with a branded splash screen, shows the items
  grouped by safety tier with `SAFE` caches pre-selected, a one-click "Free up
  X" button, per-tier select-all (checked / indeterminate / locked), a confirm
  step, and a "You reclaimed X" summary.
- Headless `dscan serve` mode: the engine speaks newline-delimited JSON over
  stdio (scan streams `disk`/`item`/`progress`/`scanDone`; `clean` reports
  freed/trashed/errors), used by the GUI sidecar. CLI/TUI unchanged.
- App icon and branding (gauge + check mark); macOS `.dmg` and Linux
  `AppImage`/`.deb` packaging via electron-builder, built and published from CI.

### Changed

- `internal/engine` extracted from `main.go` (shared scan orchestration with a
  streaming callback, cancellation, and disk-usage reporting).

### Fixed

- Cleaning now tolerates macOS TCC/SIP-protected paths (e.g.
  `~/Library/Caches/com.apple.HomeKit`): protected entries are skipped instead of
  aborting the whole clean with a permission error.

## [0.1.0] - 2026-06-02

Initial release.

### Added

- Interactive TUI (Bubble Tea) that scans the disk, groups items by category and
  safety tier (`SAFE` / `REVIEW` / `KEEP`), and lets you check off what to clean,
  with a running freed-space total and a confirm screen before any deletion.
- OS-aware catalog of common cache/build/package locations plus a heuristic pass
  that surfaces the largest otherwise-unknown items in `$HOME`.
- Cleaner with three methods: hard-delete (`SAFE` caches/build), OS Trash
  (`REVIEW` user data — Finder "Put Back" on macOS, `gio trash`/freedesktop
  `.trashinfo` on Linux), and tool-commands (e.g. `brew cleanup`,
  `simctl delete unavailable`). `KEEP` items are never selectable.
- Safety hardening: empty-path guard, collision-safe and cross-filesystem-safe
  trashing, prefix-based scan de-duplication, and a side-effect-free `--dry-run`.
- `--yes` non-interactive mode that cleans only regenerable `SAFE` items (no TTY
  required) for scripts/CI; `--system` to include system dirs; `--version`.
- Cross-platform: macOS and Linux. Builds and tests run on both in CI.

[Unreleased]: https://github.com/gor3a/disk-scan/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/gor3a/disk-scan/releases/tag/v0.6.0
[0.5.1]: https://github.com/gor3a/disk-scan/releases/tag/v0.5.1
[0.5.0]: https://github.com/gor3a/disk-scan/releases/tag/v0.5.0
[0.4.0]: https://github.com/gor3a/disk-scan/releases/tag/v0.4.0
[0.3.1]: https://github.com/gor3a/disk-scan/releases/tag/v0.3.1
[0.3.0]: https://github.com/gor3a/disk-scan/releases/tag/v0.3.0
[0.2.1]: https://github.com/gor3a/disk-scan/releases/tag/v0.2.1
[0.2.0]: https://github.com/gor3a/disk-scan/releases/tag/v0.2.0
[0.1.0]: https://github.com/gor3a/disk-scan/releases/tag/v0.1.0
