#!/bin/bash
# parse-timespec.sh — pure parser: a time-spec string -> normalized fields.
# Requires dateutil.sh to be sourced first (for du_* helpers).
#
# Output (on stdout, key=value lines):
#   oneshot:    kind=oneshot / when=<epoch>
#   recurring:  kind=recurring / hh=HH / mm=MM / days=daily|Mon,Wed,...
# On invalid input: prints "error: <msg>" to stderr and returns 1.
#
# Accepted forms:
#   in 2h | in 90m | in 1h30m | in 30s | in 2d
#   at HH:MM | at YYYY-MM-DD HH:MM
#   every day at HH:MM
#   every weekday at HH:MM
#   every Mon,Wed at HH:MM   (any of Mon Tue Wed Thu Fri Sat Sun, case-insensitive)

_pts_err() { printf 'error: %s\n' "$1" >&2; return 1; }

# Canonicalize a weekday token -> Mon|Tue|Wed|Thu|Fri|Sat|Sun, or "" if invalid.
_pts_canon_day() {
    case "$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')" in
        mon|monday)    echo Mon ;;
        tue|tues|tuesday) echo Tue ;;
        wed|weds|wednesday) echo Wed ;;
        thu|thur|thurs|thursday) echo Thu ;;
        fri|friday)    echo Fri ;;
        sat|saturday)  echo Sat ;;
        sun|sunday)    echo Sun ;;
        *) echo "" ;;
    esac
}

# Parse "HH:MM" -> echoes "HH MM" (zero-padded), returns 1 if malformed.
_pts_hhmm() {
    local t="$1" hh mm
    [[ "$t" =~ ^([0-9]{1,2}):([0-9]{2})$ ]] || return 1
    hh="${BASH_REMATCH[1]}"; mm="${BASH_REMATCH[2]}"
    (( 10#$hh < 24 && 10#$mm < 60 )) || return 1
    printf '%02d %02d\n' "$((10#$hh))" "$((10#$mm))"
}

# Parse a duration token like "1h30m" -> total seconds, returns 1 if malformed.
_pts_duration() {
    local s="$1" total=0 n unit
    local rest="$s"
    [[ -n "$s" ]] || return 1
    while [[ -n "$rest" ]]; do
        [[ "$rest" =~ ^([0-9]+)([dhms])(.*)$ ]] || return 1
        n="${BASH_REMATCH[1]}"; unit="${BASH_REMATCH[2]}"; rest="${BASH_REMATCH[3]}"
        case "$unit" in
            d) total=$(( total + n * 86400 )) ;;
            h) total=$(( total + n * 3600 )) ;;
            m) total=$(( total + n * 60 )) ;;
            s) total=$(( total + n )) ;;
        esac
    done
    (( total > 0 )) || return 1
    printf '%s\n' "$total"
}

# Main entry. Usage: parse_timespec "in 2h"  (the whole spec as one arg).
parse_timespec() {
    local spec="$1"
    # collapse repeated whitespace
    spec="$(printf '%s' "$spec" | tr -s '[:space:]' ' ')"
    spec="${spec# }"; spec="${spec% }"
    local kw rest
    kw="$(printf '%s' "${spec%% *}" | tr '[:upper:]' '[:lower:]')"
    rest="${spec#* }"
    [[ "$rest" == "$spec" && "$kw" == "$spec" ]] && rest=""  # single word, no rest

    case "$kw" in
        in)
            local secs now when
            secs=$(_pts_duration "$rest") || { _pts_err "bad duration: '$rest' (try 2h, 90m, 1h30m)"; return 1; }
            now=$(du_now); when=$(( now + secs ))
            printf 'kind=oneshot\nwhen=%s\n' "$when"
            ;;
        at)
            local hh mm when parsed
            if parsed=$(_pts_hhmm "$rest"); then
                read -r hh mm <<<"$parsed"
                when=$(du_next_clock "$hh" "$mm") || { _pts_err "could not compute time"; return 1; }
            elif [[ "$rest" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}\ [0-9]{1,2}:[0-9]{2}$ ]]; then
                # normalize HH to 2-digit for BSD parser
                local d="${rest% *}" t="${rest#* }" p
                p=$(_pts_hhmm "$t") || { _pts_err "bad time: '$t'"; return 1; }
                read -r hh mm <<<"$p"
                when=$(du_parse_datetime "${d} ${hh}:${mm}") || { _pts_err "could not parse date: '$rest'"; return 1; }
                if (( when <= $(du_now) )); then _pts_err "time is in the past: $rest"; return 1; fi
            else
                _pts_err "bad time: '$rest' (try 23:00 or 2026-06-12 01:30)"; return 1
            fi
            printf 'kind=oneshot\nwhen=%s\n' "$when"
            ;;
        every)
            # forms: "<days> at HH:MM"  where <days> = day | weekday | Mon,Wed
            [[ "$rest" =~ ^(.+)\ at\ ([0-9]{1,2}:[0-9]{2})$ ]] || { _pts_err "bad recurring spec (try 'every day at 01:00')"; return 1; }
            local dayspec="${BASH_REMATCH[1]}" timepart="${BASH_REMATCH[2]}" hh mm days p
            p=$(_pts_hhmm "$timepart") || { _pts_err "bad time: '$timepart'"; return 1; }
            read -r hh mm <<<"$p"
            local low; low="$(printf '%s' "$dayspec" | tr '[:upper:]' '[:lower:]')"
            if [[ "$low" == "day" || "$low" == "daily" ]]; then
                days="daily"
            elif [[ "$low" == "weekday" || "$low" == "weekdays" ]]; then
                days="Mon,Tue,Wed,Thu,Fri"
            else
                local IFS=',' tok canon list=""
                for tok in $dayspec; do
                    tok="${tok// /}"
                    [[ -z "$tok" ]] && continue
                    canon=$(_pts_canon_day "$tok")
                    [[ -z "$canon" ]] && { _pts_err "unknown weekday: '$tok'"; return 1; }
                    list="${list:+$list,}$canon"
                done
                [[ -n "$list" ]] || { _pts_err "no weekdays given"; return 1; }
                days="$list"
            fi
            printf 'kind=recurring\nhh=%s\nmm=%s\ndays=%s\n' "$hh" "$mm" "$days"
            ;;
        *)
            _pts_err "unrecognized time spec: '$spec' (use in/at/every)"; return 1
            ;;
    esac
}
