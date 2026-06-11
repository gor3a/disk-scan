#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
# shellcheck source=scripts/release_lib.sh
. ./release_lib.sh

fail=0
ok()  { printf 'ok   %s\n' "$1"; }
bad() { printf 'FAIL %s\n' "$1"; fail=1; }
check() { if [ "$2" = "$3" ]; then ok "$1"; else printf 'FAIL %s\n  exp: %s\n  got: %s\n' "$1" "$2" "$3"; fail=1; fi; }
has()   { if grep -q "$3" "$2"; then ok "$1"; else bad "$1"; fi; }   # has DESC FILE PATTERN
notin() { if grep -q "$3" "$2"; then bad "$1"; else ok "$1"; fi; }   # notin DESC FILE PATTERN

# --- next_version ---
check "patch"    "0.6.1" "$(next_version 0.6.0 patch)"
check "minor"    "0.7.0" "$(next_version 0.6.0 minor)"
check "major"    "1.0.0" "$(next_version 0.6.0 major)"
check "explicit" "1.2.3" "$(next_version 0.6.0 1.2.3)"
if next_version 0.6.0 bogus >/dev/null 2>&1; then bad "rejects bogus"; else ok "rejects bogus"; fi

# --- promote_changelog + is_unreleased_empty ---
cl=$(mktemp)
cat > "$cl" <<'EOF'
# Changelog

## [Unreleased]

### Added
- A new thing.

## [0.6.0] - 2026-06-10

### Added
- Old thing.

[Unreleased]: https://github.com/gor3a/disk-scan/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/gor3a/disk-scan/releases/tag/v0.6.0
EOF
if is_unreleased_empty "$cl"; then bad "unreleased non-empty detected"; else ok "unreleased non-empty detected"; fi
promote_changelog "$cl" 0.7.0 2026-06-11
has   "dated section"     "$cl" "^## \[0.7.0\] - 2026-06-11$"
has   "notes moved"       "$cl" "A new thing."
has   "compare ref"       "$cl" "compare/v0.7.0\.\.\.HEAD"
has   "tag ref"           "$cl" "^\[0.7.0\]: https://github.com/gor3a/disk-scan/releases/tag/v0.7.0$"
if is_unreleased_empty "$cl"; then ok "unreleased emptied"; else bad "unreleased emptied"; fi

# --- extract_notes (stops before link refs) ---
notes=$(mktemp)
extract_notes "$cl" 0.6.0 > "$notes"
has   "extract content"   "$notes" "Old thing."
notin "extract no refs"   "$notes" "Unreleased\]:"
rm -f "$cl" "$notes"

if [ "$fail" = 0 ]; then echo "ALL PASS"; else echo "FAILURES"; exit 1; fi
