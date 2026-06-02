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
- REVIEW (user data) → moved to the OS Trash, recoverable:
  - macOS: via Finder, so items get "Put Back" support.
  - Linux: via `gio trash`, or the XDG trash spec (`~/.local/share/Trash`
    with `.trashinfo` records) when `gio` is unavailable.
  - Trashing never overwrites an existing trashed item and works across
    filesystems (copy + remove fallback).
- KEEP (browser/messaging/SSH) → shown but never selectable.
- A confirm screen summarizes deletes vs trash vs tool-cleanups before anything
  is touched; `--dry-run` performs no deletion at all.
