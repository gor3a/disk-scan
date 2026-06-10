#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
# shellcheck source=scripts/release_lib.sh
. ./release_lib.sh

fail=0
check() { if [ "$2" = "$3" ]; then printf 'ok   %s\n' "$1"; else printf 'FAIL %s\n  exp: %s\n  got: %s\n' "$1" "$2" "$3"; fail=1; fi; }

# --- next_version ---
check "patch"    "0.6.1" "$(next_version 0.6.0 patch)"
check "minor"    "0.7.0" "$(next_version 0.6.0 minor)"
check "major"    "1.0.0" "$(next_version 0.6.0 major)"
check "explicit" "1.2.3" "$(next_version 0.6.0 1.2.3)"
if next_version 0.6.0 bogus >/dev/null 2>&1; then echo "FAIL bogus accepted"; fail=1; else echo "ok   rejects bogus"; fi

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
if is_unreleased_empty "$cl"; then echo "FAIL unreleased seen as empty"; fail=1; else echo "ok   unreleased non-empty detected"; fi
promote_changelog "$cl" 0.7.0 2026-06-11
grep -q "^## \[0.7.0\] - 2026-06-11$" "$cl" && echo "ok   dated section" || { echo "FAIL dated section"; fail=1; }
grep -q "A new thing." "$cl" && echo "ok   notes moved" || { echo "FAIL notes moved"; fail=1; }
grep -q "compare/v0.7.0\.\.\.HEAD" "$cl" && echo "ok   compare ref" || { echo "FAIL compare ref"; fail=1; }
grep -q "^\[0.7.0\]: https://github.com/gor3a/disk-scan/releases/tag/v0.7.0$" "$cl" && echo "ok   tag ref" || { echo "FAIL tag ref"; fail=1; }
is_unreleased_empty "$cl" && echo "ok   unreleased emptied" || { echo "FAIL unreleased not emptied"; fail=1; }

# --- extract_notes (stops before link refs) ---
notes=$(extract_notes "$cl" 0.6.0)
printf '%s' "$notes" | grep -q "Old thing." && echo "ok   extract content" || { echo "FAIL extract content"; fail=1; }
if printf '%s' "$notes" | grep -q "Unreleased\]:"; then echo "FAIL extract leaked link refs"; fail=1; else echo "ok   extract no refs"; fi
rm -f "$cl"

[ "$fail" = 0 ] && echo "ALL PASS" || { echo "FAILURES"; exit 1; }
