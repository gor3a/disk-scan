#!/bin/bash
# backend-mock.sh — test backend. Records calls to $POWERSCHED_MOCK_LOG and
# returns deterministic handles, so dispatch logic can be tested without
# touching launchd/systemd/pmset. Implements the backend interface.

_mock_log() { printf '%s\n' "$*" >>"${POWERSCHED_MOCK_LOG:-/dev/null}"; }

# backend_schedule id action kind when force wake_at grace fire_runner
# Echoes a handle string.
backend_schedule() {
    _mock_log "schedule id=$1 action=$2 kind=$3 when=$4 force=$5 wake_at=$6 grace=$7"
    printf 'mock-%s\n' "$1"
}

# backend_cancel id handle action kind
backend_cancel() {
    _mock_log "cancel id=$1 handle=$2 action=$3 kind=$4"
    return 0
}

# backend_disarm id handle action kind
backend_disarm() {
    _mock_log "disarm id=$1 handle=$2 action=$3 kind=$4"
    return 0
}

# backend_check_deps -> always ok for mock.
backend_check_deps() { return 0; }

# --- fire-runner interface ----------------------------------------------------
backend_notify()       { _mock_log "notify $*"; }
backend_program_wake() { _mock_log "program_wake at=$1 poweron=$2"; }
backend_perform()      { _mock_log "perform action=$1 force=$2"; }
