#!/usr/bin/env bash
# Lint the project's shell scripts with shellcheck. Run locally or in CI.
set -euo pipefail
cd "$(dirname "$0")/.."

command -v shellcheck >/dev/null 2>&1 || {
  echo "error: shellcheck not found (macOS: brew install shellcheck, Debian/Ubuntu: apt-get install shellcheck)" >&2
  exit 1
}

shellcheck scripts/*.sh
echo "shellcheck: clean"
