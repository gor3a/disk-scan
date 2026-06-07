#!/usr/bin/env bash
# Build the Go dscan binary as the Electron sidecar into desktop/resources/.
# On macOS, produce a universal (arm64 + x86_64) binary so a single universal
# app runs on both Apple Silicon and Intel.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$(cd "$(dirname "$0")/.." && pwd)/resources"
mkdir -p "$OUT"

if [ "$(uname -s)" = "Darwin" ]; then
  (cd "$ROOT" && CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -o "$OUT/dscan.arm64" .)
  (cd "$ROOT" && CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 go build -o "$OUT/dscan.amd64" .)
  lipo -create -output "$OUT/dscan" "$OUT/dscan.arm64" "$OUT/dscan.amd64"
  rm -f "$OUT/dscan.arm64" "$OUT/dscan.amd64"
  echo "built universal sidecar -> $OUT/dscan ($(lipo -archs "$OUT/dscan"))"
else
  (cd "$ROOT" && go build -o "$OUT/dscan" .)
  echo "built sidecar -> $OUT/dscan"
fi
