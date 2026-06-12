#!/bin/bash
# fire-runner.sh — invoked by the OS scheduler (launchd/systemd) at fire time.
# Owns the notify -> grace/abort -> graceful-or-force flow. Runs as root.
#
# Usage: fire-runner.sh <job-id>
#
# Reads the job from the registry, optionally programs a wake, notifies the
# console user, waits the grace window (polling the abort flag), then performs
# the action via the platform backend. One-shot jobs remove their own artifacts.

set -uo pipefail

SELF="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
LIB="${SELF}/lib"

source "${LIB}/common.sh"
source "${LIB}/dateutil.sh"
source "${LIB}/registry.sh"
case "$POWERSCHED_BACKEND" in
    macos) source "${LIB}/backend-macos.sh" ;;
    linux) source "${LIB}/backend-linux.sh" ;;
    mock)  source "${LIB}/backend-mock.sh" ;;
    *)     ps_die "unsupported platform" ;;
esac

main() {
    local id="${1:?fire-runner: missing job id}"
    local row
    row=$(reg_get "$id") || { ps_warn "fire-runner: job '$id' not found (already cancelled?)"; exit 0; }

    local action force kind handle wake_at grace
    action=$(reg_field "$row" 2)
    force=$(reg_field "$row" 3)
    kind=$(reg_field "$row" 4)
    handle=$(reg_field "$row" 6)
    wake_at=$(reg_field "$row" 7)
    grace=$(reg_field "$row" 10)
    [[ "$grace" =~ ^[0-9]+$ ]] || grace=120

    local abort_flag; abort_flag=$(ps_abort_flag "$id")
    # Clear any abort flag left over from a previous run of this job.
    rm -f "$abort_flag" 2>/dev/null || true

    # Program wake before going down, if requested. A shutdown must power the
    # machine back ON (wakeorpoweron / RTC-from-off); waking from sleep does not.
    if [[ "$wake_at" != "-" && -n "$wake_at" ]]; then
        local wake_poweron="false"
        [[ "$action" == "shutdown" ]] && wake_poweron="true"
        backend_program_wake "$wake_at" "$wake_poweron" || ps_warn "could not program wake for $id"
    fi

    local human_action="$action"
    [[ "$action" == "wake-poweron" ]] && human_action="wake (power-on)"

    # Notify + grace countdown (skipped entirely for grace=0). Polls the abort
    # flag in small steps so a late abort is still caught before firing.
    if (( grace > 0 )); then
        backend_notify "powersched: $human_action in $((grace / 60)) min — run 'powersched abort' to cancel" || true
        local waited=0 poll=2 step
        while :; do
            if [[ -f "$abort_flag" ]]; then
                rm -f "$abort_flag" 2>/dev/null || true
                backend_notify "powersched: $human_action aborted" || true
                ps_info "job '$id' aborted during grace window"
                cleanup_if_oneshot "$id" "$handle" "$action" "$kind"
                exit 0
            fi
            (( waited >= grace )) && break
            step=$(( grace - waited )); (( step > poll )) && step=$poll
            sleep "$step"
            waited=$(( waited + step ))
        done
    fi

    # Perform the action. One-shot artifacts are removed first so a forced
    # power-off doesn't leave a stale daemon that re-fires next boot.
    cleanup_if_oneshot "$id" "$handle" "$action" "$kind"
    ps_info "firing '$id': $human_action (force=$force)"
    # A successful power action never returns here; a return means it failed
    # (e.g. an inhibitor blocked a graceful shutdown) — tell the user.
    if ! backend_perform "$action" "$force"; then
        backend_notify "powersched: $human_action FAILED — it may be blocked (try --force)" || true
        ps_err "job '$id' action failed"
        exit 1
    fi
}

# Disarm one-shot jobs: remove the on-disk artifact + registry row so the job
# cannot re-fire across a reboot. Uses backend_disarm (NOT backend_cancel) because
# the fire-runner IS the launchd job on macOS — booting out its own label would
# SIGTERM it mid-action, leaving the machine never powered down and the plist
# lingering. backend_disarm only removes files; it never unloads the running label.
cleanup_if_oneshot() {
    local id="$1" handle="$2" action="$3" kind="$4"
    [[ "$kind" == "oneshot" ]] || return 0
    backend_disarm "$id" "$handle" "$action" "$kind" || true
    reg_remove "$id" || true
}

main "$@"
