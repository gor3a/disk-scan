#!/bin/bash
# common.sh — shared config, OS detection, paths, logging. Source first.

# --- OS detection -------------------------------------------------------------
case "$(uname -s)" in
    Darwin) POWERSCHED_OS="macos" ;;
    Linux)  POWERSCHED_OS="linux" ;;
    *)      POWERSCHED_OS="unknown" ;;
esac

# --- paths (overridable for tests) --------------------------------------------
if [[ -z "${POWERSCHED_STATE_DIR:-}" ]]; then
    if [[ "$POWERSCHED_OS" == "macos" ]]; then
        POWERSCHED_STATE_DIR="/Library/Application Support/powersched"
    else
        POWERSCHED_STATE_DIR="/var/lib/powersched"
    fi
fi
POWERSCHED_REGISTRY="${POWERSCHED_STATE_DIR}/jobs.tsv"

# Runtime staging dir. The OS scheduler runs fire-runner.sh as a root daemon at
# fire time; on macOS such daemons CANNOT read scripts under TCC-protected user
# dirs (~/Documents, ~/Desktop, ~/Downloads) — they get "Operation not permitted".
# So the runtime (fire-runner + lib) is copied to this system-readable path and
# the scheduler points at the copy, not the in-repo source. Also shields Linux
# from an unreadable/unmounted $HOME at early boot.
if [[ -z "${POWERSCHED_RUNTIME_DIR:-}" ]]; then
    if [[ "$POWERSCHED_OS" == "macos" ]]; then
        POWERSCHED_RUNTIME_DIR="/Library/Application Support/powersched/runtime"
    else
        POWERSCHED_RUNTIME_DIR="/usr/local/lib/powersched"
    fi
fi

# Per-job abort flag path. A separate flag per id means `abort <id>` cancels
# exactly one job's grace countdown without affecting others.
ps_abort_flag() { printf '%s\n' "${POWERSCHED_STATE_DIR}/abort.$1"; }

# Backend selection: macos | linux | mock (mock used by tests).
POWERSCHED_BACKEND="${POWERSCHED_BACKEND:-$POWERSCHED_OS}"

# Default grace period (seconds) before a notified action fires.
POWERSCHED_GRACE_DEFAULT="${POWERSCHED_GRACE_DEFAULT:-120}"

# --- logging ------------------------------------------------------------------
ps_err()  { printf 'powersched: %s\n' "$*" >&2; }
ps_warn() { printf 'powersched: warning: %s\n' "$*" >&2; }
ps_info() { printf 'powersched: %s\n' "$*"; }
ps_die()  { ps_err "$*"; exit 1; }

# --- validation ---------------------------------------------------------------
# A job id must be plain: it becomes a root-owned file path / launchd label /
# systemd unit name, so anything outside this set is rejected (defense-in-depth
# against path traversal / unit injection if a registry row is corrupted).
ps_valid_id() { [[ "$1" =~ ^[A-Za-z0-9._-]+$ ]]; }
