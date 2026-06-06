#!/usr/bin/env bash
# Build the Go dscan binary as the Electron sidecar into desktop/resources/.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$(cd "$(dirname "$0")/.." && pwd)/resources"
mkdir -p "$OUT"
( cd "$ROOT" && go build -o "$OUT/dscan" . )
echo "built sidecar -> $OUT/dscan"
