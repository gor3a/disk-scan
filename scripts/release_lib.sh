#!/usr/bin/env bash
# Shared helpers for the dscan release scripts. Sourcing has no side effects.
# Pure-ish functions are covered by release_lib_test.sh.

REPO_URL="https://github.com/gor3a/disk-scan"

die()  { printf 'error: %s\n' "$*" >&2; exit 1; }
info() { printf '==> %s\n' "$*"; }

# current_version: the version in desktop/package.json (run from repo root).
current_version() {
  grep -m1 '"version"' desktop/package.json | sed -E 's/.*"version": *"([^"]+)".*/\1/'
}

# next_version CURRENT SPEC -> prints resolved version, or returns 1.
next_version() {
  local current="$1" spec="$2" major minor patch
  if printf '%s' "$spec" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'; then
    printf '%s\n' "$spec"; return 0
  fi
  IFS=. read -r major minor patch <<EOF
$current
EOF
  case "$spec" in
    major) major=$((major + 1)); minor=0; patch=0 ;;
    minor) minor=$((minor + 1)); patch=0 ;;
    patch) patch=$((patch + 1)) ;;
    *) return 1 ;;
  esac
  printf '%s.%s.%s\n' "$major" "$minor" "$patch"
}

# unreleased_body FILE -> prints lines between "## [Unreleased]" and the next "## [".
unreleased_body() {
  awk '/^## \[Unreleased\]/ { cap = 1; next } cap && /^## \[/ { cap = 0 } cap { print }' "$1"
}

# is_unreleased_empty FILE -> true (0) when the Unreleased body has no non-space content.
is_unreleased_empty() {
  [ -z "$(unreleased_body "$1" | tr -d '[:space:]')" ]
}

# promote_changelog FILE VERSION DATE: move the Unreleased body into a new dated
# section and update the link refs. Assumes a non-empty Unreleased body.
promote_changelog() {
  local file="$1" version="$2" date="$3" tmp
  tmp=$(mktemp)
  awk -v ver="$version" -v date="$date" '
    BEGIN { state = 0; body = "" }
    /^## \[Unreleased\]/ && state == 0 { print; print ""; state = 1; next }
    state == 1 && /^## \[/ { printf "## [%s] - %s\n", ver, date; printf "%s", body; state = 2; print; next }
    state == 1 { body = body $0 "\n"; next }
    { print }
    END { if (state == 1) { printf "## [%s] - %s\n", ver, date; printf "%s", body } }
  ' "$file" \
  | awk -v ver="$version" -v url="$REPO_URL" '
    /^\[Unreleased\]:/ {
      print "[Unreleased]: " url "/compare/v" ver "...HEAD"
      print "[" ver "]: " url "/releases/tag/v" ver
      next
    }
    { print }
  ' > "$tmp"
  mv "$tmp" "$file"
}

# extract_notes FILE VERSION -> prints the body of the "## [VERSION]" section,
# stopping before the next heading or the link-ref block.
extract_notes() {
  awk -v ver="$2" '
    index($0, "## [" ver "]") == 1 { cap = 1; next }
    cap && (/^## / || /^\[[^]]*\]: /) { exit }
    cap { print }
  ' "$1"
}

# set_pkg_version VERSION: rewrite the first "version" field in desktop/package.json.
set_pkg_version() {
  local version="$1" tmp; tmp=$(mktemp)
  awk -v v="$version" '
    !done && /"version":/ { sub(/"version": *"[^"]*"/, "\"version\": \"" v "\""); done = 1 }
    { print }
  ' desktop/package.json > "$tmp" && mv "$tmp" desktop/package.json
}

# set_go_version VERSION: rewrite the version var in main.go, preserving gofmt alignment.
set_go_version() {
  local version="$1" tmp; tmp=$(mktemp)
  awk -v v="$version" '
    /^\tversion[ \t]*= "[^"]*"$/ { sub(/= "[^"]*"/, "= \"" v "\"") }
    { print }
  ' main.go > "$tmp" && mv "$tmp" main.go
}
