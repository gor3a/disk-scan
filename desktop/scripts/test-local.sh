#!/usr/bin/env bash
# Launch the dscan desktop app in dev against a seeded demo home, so you can
# exercise scanning AND cleaning safely — nothing touches your real files.
#
#   ./scripts/test-local.sh           # demo home (safe to click "Free up")
#   ./scripts/test-local.sh --real    # your REAL home (deletions are real!)
set -euo pipefail

DESKTOP="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$DESKTOP/.." && pwd)"
DEMO="$DESKTOP/.demo-home"

USE_REAL=0
[ "${1:-}" = "--real" ] && USE_REAL=1

# sparse <path> <megabytes> — a file with the given logical size but ~0 on disk.
sparse() {
  mkdir -p "$(dirname "$1")"
  if command -v mkfile >/dev/null 2>&1; then
    mkfile -n "${2}m" "$1"
  elif command -v truncate >/dev/null 2>&1; then
    truncate -s "${2}M" "$1"
  else
    dd if=/dev/zero of="$1" bs=1 count=0 seek=$(("$2" * 1024 * 1024)) 2>/dev/null
  fi
}

# set_old <path> <days> — set mtime to N days ago (GNU and BSD/macOS).
set_old() {
  if ! touch -d "${2} days ago" "$1" 2>/dev/null; then
    touch -t "$(date -v-"${2}"d +%Y%m%d0000)" "$1"
  fi
}

seed_demo() {
  rm -rf "$DEMO"
  mkdir -p "$DEMO"

  # SAFE catalog caches (sizes are realistic; bytes are sparse/cheap).
  sparse "$DEMO/.npm/_cacache/blob" 3100
  sparse "$DEMO/.pnpm-store/v3/blob" 1200
  sparse "$DEMO/.cargo/registry/cache/blob" 820
  sparse "$DEMO/.cache/blob" 600
  sparse "$DEMO/Library/Caches/blob" 2400                                   # macOS
  sparse "$DEMO/Library/Developer/Xcode/DerivedData/App/blob" 3900          # macOS

  # KEEP (protected, never selectable).
  mkdir -p "$DEMO/.ssh"
  echo demo >"$DEMO/.ssh/id_ed25519"

  # REVIEW (heuristic large item).
  sparse "$DEMO/Downloads/big.zip" 1600

  # node_modules projects for the Projects tab — name:sizeMB:ageDays.
  for spec in old-portfolio:512:300 hackathon:340:150 work-app:880:1 learn-rust:210:420; do
    name="${spec%%:*}"
    rest="${spec#*:}"
    mb="${rest%%:*}"
    age="${rest##*:}"
    sparse "$DEMO/dev/$name/node_modules/pkg/blob" "$mb"
    mkdir -p "$DEMO/dev/$name/src"
    echo code >"$DEMO/dev/$name/src/index.js"
    set_old "$DEMO/dev/$name/src" "$age" # the project's "last used" age
  done

  # Other artifact kinds so the Projects tab shows grouping.
  sparse "$DEMO/dev/web-app/.next/blob" 320 # Next.js
  sparse "$DEMO/dev/rust-cli/target/blob" 540
  echo '[package]' >"$DEMO/dev/rust-cli/Cargo.toml" # gates the Rust target match
  mkdir -p "$DEMO/dev/rust-cli/src" && set_old "$DEMO/dev/rust-cli/src" 200
  sparse "$DEMO/dev/py-tool/__pycache__/blob" 90 # Python
  mkdir -p "$DEMO/dev/py-tool/app" && set_old "$DEMO/dev/py-tool/app" 120
  echo "seeded demo home → $DEMO"
}

# Replace any running dev instance.
pkill -f "dscan/desktop/node_modules/electron" 2>/dev/null || true
pkill -f "dscan-dev serve" 2>/dev/null || true

echo "building sidecar…"
(cd "$ROOT" && go build -o "$DESKTOP/dscan-dev" .)

cd "$DESKTOP"
if [ "$USE_REAL" = 1 ]; then
  echo "launching against your REAL home — deletions are real."
  exec npm run dev
fi

seed_demo
echo "launching against demo home — safe to click 'Free up'."
HOME="$DEMO" exec npm run dev
