#!/usr/bin/env bash
# sync-powersched.sh — refresh the vendored powersched CLI from its source repo.
#
# The Schedule tab drives the powersched CLI, which is bundled at build time from
# desktop/vendor/powersched. That vendored copy must be kept in sync with the
# canonical source in the dotai monorepo (../../../scripts/powersched). Run this
# whenever the CLI changes upstream.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
dest="${here}/../vendor/powersched"
src="${POWERSCHED_SRC:-${here}/../../../scripts/powersched}"

if [[ ! -f "${src}/powersched" ]]; then
  echo "error: powersched source not found at ${src}" >&2
  echo "set POWERSCHED_SRC=/path/to/scripts/powersched and retry" >&2
  exit 1
fi

rm -rf "${dest}"
mkdir -p "${dest}/lib"
cp "${src}/powersched" "${dest}/powersched"
cp "${src}/fire-runner.sh" "${dest}/fire-runner.sh"
cp "${src}"/lib/*.sh "${dest}/lib/"
chmod +x "${dest}/powersched" "${dest}/fire-runner.sh"
echo "synced powersched CLI -> ${dest}"
