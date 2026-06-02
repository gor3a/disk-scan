# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/gor3a/disk-scan/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/gor3a/disk-scan/releases/tag/v0.1.0
