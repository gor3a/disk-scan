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
