# Contributing to dscan

Thanks for your interest in contributing! dscan is a cross-platform disk scanner and cleaner: a Go CLI/TUI at the repo root and an Electron + React desktop GUI under `desktop/`.

By participating you agree to our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## Project layout

```
.
├── main.go            # CLI entry point
├── program.go         # Bubble Tea TUI wiring
├── internal/
│   ├── scan/          # directory traversal & sizing
│   ├── engine/        # scan orchestration
│   ├── clean/         # deletion / trash routing
│   ├── rules/         # built-in and user-defined clean rules + catalog
│   ├── apps/          # app-bundle detection (macOS)
│   ├── serve/         # JSON-over-stdio sidecar protocol (desktop ↔ Go)
│   ├── tui/           # Bubble Tea components
│   └── notify/        # desktop notifications
└── desktop/
    ├── electron/      # main process (main.ts, sidecar.ts, …)
    ├── src/           # React renderer (components, lib, hooks)
    └── package.json
```

---

## Dev setup

### Prerequisites

- **Go 1.24+** — `go version`
- **Node.js 20+** and **npm** — for the desktop app only

### Go CLI / TUI

```sh
# build
go build ./...

# run all tests; -race catches data races
go test -race ./...

# cross-check both target OSes before opening a PR
GOOS=linux  go build ./...
GOOS=darwin go build ./...
```

### Desktop app (Electron + React)

In dev mode the Electron main process looks for the Go binary at `desktop/dscan-dev` (see `resolveSidecar()` in `desktop/electron/main.ts`). Build it once from the repo root before starting the desktop dev server:

```sh
# from repo root — produces desktop/dscan-dev
go build -o desktop/dscan-dev .
```

Then inside `desktop/`:

```sh
npm install

# start the Vite + Electron dev server
npm run dev

# run unit / component tests (vitest)
npm test

# typecheck + production build
npm run build
```

---

## Coding standards

- **Cross-platform first.** All code and scripts must work on both macOS and Linux. No OS-specific shell syntax or hardcoded platform paths.
- **No hardcoded secrets or credentials** of any kind.
- **Validate at system boundaries** (user input, external APIs, IPC messages). No defensive validation inside pure internal helpers.
- **Go:** code must be `gofmt`-clean and `go vet ./...`-clean before a PR.
- **Desktop (TypeScript):** strict TypeScript — no `any` shortcuts. Add vitest tests for non-trivial logic.
- **Deletion safety:** anything that removes user data must route through the OS Trash (never a bare `rm`), a `KEEP` item must never become selectable, and the path must be covered by a test.

---

## Commit messages

This repo uses **[Conventional Commits](https://www.conventionalcommits.org/)**:

```
feat:             new user-facing feature
fix:              bug fix
docs:             documentation only
test:             adding or fixing tests
refactor:         code change with no behavior change
chore:            tooling, deps, CI, release plumbing
```

Optional scopes mirror the project layout: `feat(desktop):`, `fix(scan):`, `fix(rules):`, `chore(ci):`, etc.

---

## PR policy

- **Squash-only merges, linear history on `main`.** Each PR is squashed into one commit using the PR title — write the PR title as a Conventional Commit (`feat(desktop): add schedule picker`).
- **Keep PRs focused and single-purpose.** One feature or fix per PR makes the squashed history easy to read and bisect.
- Fill in the [PR template](.github/PULL_REQUEST_TEMPLATE.md) — especially the checklist items for `gofmt`, `go vet`, tests, and cross-OS builds.
- Link related issues with `Closes #N` in the PR description.

---

## Tests

TDD is encouraged. The bar before opening a PR:

- `go test -race ./...` passes with no failures or races.
- `npm test` (vitest) passes inside `desktop/`.
- New behaviour has new tests; existing tests are not left broken.

---

## Reporting bugs and requesting features

Use the GitHub issue templates:

- **Bug report** — `.github/ISSUE_TEMPLATE/bug_report.md`
- **Feature request** — `.github/ISSUE_TEMPLATE/feature_request.md`

Search open issues before filing a duplicate. For security vulnerabilities, see [SECURITY.md](SECURITY.md) — do **not** open a public issue.

---

## Releases

Releases are tag-driven (`v*` tags) and built entirely by CI. Tagging and publishing is maintainer-only (@gor3a). If you want a fix shipped sooner, say so in the issue or PR.
