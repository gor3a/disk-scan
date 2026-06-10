#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/release_lib.sh
. "$(dirname "$0")/release_lib.sh"

TAG="${1:-}"
if [ -z "$TAG" ]; then
  TAG=$(git tag --sort=-v:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -1)
fi
[ -n "$TAG" ] || die "no version tag found; pass one explicitly (e.g. scripts/publish.sh v0.7.0)"
case "$TAG" in v*) ;; *) TAG="v$TAG" ;; esac
VERSION="${TAG#v}"

command -v gh >/dev/null 2>&1 || die "missing tool: gh"
gh auth status >/dev/null 2>&1 || die "gh is not authenticated"

draft=$(gh release view "$TAG" --json isDraft --jq .isDraft 2>/dev/null) \
  || die "no GitHub release for $TAG yet (has CI finished building?)"
if [ "$draft" != true ]; then
  info "$TAG is already published"
  gh release view "$TAG" --json url --jq .url
  exit 0
fi

# Asset presence is the authoritative signal that CI built and uploaded everything.
assets=$(gh release view "$TAG" --json assets --jq '.assets[].name')
need="dscan-$VERSION-arm64.dmg dscan-$VERSION-x64.dmg dscan-$VERSION-arm64-mac.zip dscan-$VERSION-mac.zip dscan-$VERSION.AppImage dscan-desktop_${VERSION}_amd64.deb latest-linux.yml latest-mac.yml"
missing=""
for a in $need; do printf '%s\n' "$assets" | grep -qx "$a" || missing="$missing $a"; done
[ -z "$missing" ] || die "draft $TAG is missing assets (CI still running or failed?):$missing"

notes=$(extract_notes CHANGELOG.md "$VERSION")
[ -n "$(printf '%s' "$notes" | tr -d '[:space:]')" ] || notes="See the CHANGELOG for details."

info "publishing $TAG"
gh release edit "$TAG" --draft=false --latest --title "dscan $TAG" --notes "$notes"
info "published:"
gh release view "$TAG" --json url --jq .url
