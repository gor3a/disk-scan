#!/bin/bash
# dateutil.sh — cross-platform date math (GNU coreutils vs BSD/macOS).
# Pure: no scheduling side effects. Source this file, then call du_* helpers.
#
# All epochs are integer seconds (local-time interpretation of clock strings).

# Detect GNU date once. GNU `date --version` succeeds; BSD has no --version.
if date --version >/dev/null 2>&1; then
    _DU_GNU=1
else
    _DU_GNU=0
fi

# Current epoch seconds.
du_now() { date +%s; }

# Convert epoch -> a strftime format. Usage: du_fmt EPOCH FORMAT
du_fmt() {
    local epoch="$1" fmt="$2"
    if [[ "$_DU_GNU" == 1 ]]; then
        date -d "@${epoch}" +"$fmt"
    else
        date -r "$epoch" +"$fmt"
    fi
}

# Convert epoch -> pmset datetime "MM/DD/YYYY HH:MM:SS".
du_epoch_to_pmset() { du_fmt "$1" "%m/%d/%Y %H:%M:%S"; }

# Convert epoch -> systemd OnCalendar "YYYY-MM-DD HH:MM:SS".
du_epoch_to_oncalendar() { du_fmt "$1" "%Y-%m-%d %H:%M:%S"; }

# Parse "YYYY-MM-DD HH:MM" (local time) -> epoch. Echoes nothing + returns 1 on failure.
du_parse_datetime() {
    local s="$1" out
    if [[ "$_DU_GNU" == 1 ]]; then
        out=$(date -d "$s" +%s 2>/dev/null) || return 1
    else
        out=$(date -j -f "%Y-%m-%d %H:%M" "$s" +%s 2>/dev/null) || return 1
    fi
    [[ -n "$out" ]] || return 1
    printf '%s\n' "$out"
}

# Given HH and MM, return epoch of the NEXT occurrence of that clock time
# (today if still in the future, otherwise tomorrow).
du_next_clock() {
    local hh="$1" mm="$2" today epoch now
    today=$(du_fmt "$(du_now)" "%Y-%m-%d")
    epoch=$(du_parse_datetime "${today} ${hh}:${mm}") || return 1
    now=$(du_now)
    if (( epoch <= now )); then
        epoch=$(( epoch + 86400 ))
    fi
    printf '%s\n' "$epoch"
}
