#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/release_lib.sh
. "$(dirname "$0")/release_lib.sh"

usage() { echo "usage: scripts/release.sh <version|major|minor|patch> [--dry-run] [--skip-tests]" >&2; exit 2; }

DRY_RUN=0; SKIP_TESTS=0; SPEC=""
for arg in "$@"; do
  case "$arg" in
    --dry-run)    DRY_RUN=1 ;;
    --skip-tests) SKIP_TESTS=1 ;;
    -h|--help)    usage ;;
    -*)           die "unknown flag: $arg" ;;
    *)            if [ -z "$SPEC" ]; then SPEC="$arg"; else die "unexpected argument: $arg"; fi ;;
  esac
done
[ -n "$SPEC" ] || usage

# --- preflight ---
for t in git go node npm gh; do command -v "$t" >/dev/null 2>&1 || die "missing tool: $t"; done
gh auth status >/dev/null 2>&1 || die "gh is not authenticated (run: gh auth login)"
[ "$(git branch --show-current)" = main ] || die "not on the main branch"
[ -z "$(git status --porcelain)" ] || die "working tree is not clean"
git fetch -q origin
[ "$(git rev-parse @)" = "$(git rev-parse '@{u}')" ] || die "main is out of sync with origin/main"
is_unreleased_empty CHANGELOG.md && die "## [Unreleased] is empty — add release notes first"

CURRENT=$(current_version)
VERSION=$(next_version "$CURRENT" "$SPEC") || die "invalid version or bump: $SPEC"
printf '%s' "$VERSION" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || die "resolved version is not semver: $VERSION"
TAG="v$VERSION"
git rev-parse -q --verify "refs/tags/$TAG" >/dev/null && die "tag $TAG already exists locally"
git ls-remote --exit-code --tags origin "$TAG" >/dev/null 2>&1 && die "tag $TAG already exists on origin"

info "releasing $CURRENT -> $VERSION ($TAG)"

if [ "$DRY_RUN" = 1 ]; then
  tmp=$(mktemp); cp CHANGELOG.md "$tmp"
  promote_changelog "$tmp" "$VERSION" "$(date +%F)"
  info "dry run — CHANGELOG changes that would be made:"
  diff -u CHANGELOG.md "$tmp" || true
  info "dry run — would also bump versions, sync lockfile, commit, tag $TAG, push main + tag"
  rm -f "$tmp"
  exit 0
fi

if [ "$SKIP_TESTS" = 0 ]; then
  info "go test ./..."; go test ./...
  info "desktop test + build"; ( cd desktop && npm test && npm run build )
fi

info "bumping version to $VERSION"; set_pkg_version "$VERSION"; set_go_version "$VERSION"
info "syncing lockfile"; ( cd desktop && npm install --package-lock-only >/dev/null )
info "promoting CHANGELOG"; promote_changelog CHANGELOG.md "$VERSION" "$(date +%F)"

git add desktop/package.json main.go desktop/package-lock.json CHANGELOG.md
git commit -q -m "chore(release): $TAG"
git tag -a "$TAG" -m "dscan $TAG"
git push -q origin main
git push -q origin "$TAG"

info "pushed $TAG — CI is building"
echo "  watch CI: gh run watch \$(gh run list --workflow=desktop.yml -L1 --json databaseId --jq '.[0].databaseId')"
echo "  publish:  scripts/publish.sh $TAG   (after CI is green)"
