#!/bin/bash
# backend-macos.sh — launchd (scheduler) + pmset (wake) implementation.
# Requires common.sh + dateutil.sh sourced first. Runs privileged (root).

_LD_DIR="/Library/LaunchDaemons"
_LD_PREFIX="com.powersched"

backend_check_deps() {
    command -v launchctl >/dev/null 2>&1 || { ps_err "launchctl not found (expected on macOS)"; return 1; }
    command -v pmset     >/dev/null 2>&1 || { ps_err "pmset not found (expected on macOS)"; return 1; }
    return 0
}

# Console (logged-in GUI) user, for routing notifications/AppleScript.
_macos_console_user() { stat -f%Su /dev/console 2>/dev/null; }
_macos_console_uid()  { id -u "$(_macos_console_user)" 2>/dev/null; }

# Map canonical weekday list (Mon,Wed) -> pmset letters (MW). pmset: M T W R F S U.
_macos_pmset_days() {
    local days="$1" out="" d
    [[ "$days" == "daily" ]] && { echo "MTWRFSU"; return; }
    local IFS=','
    for d in $days; do
        case "$d" in
            Mon) out+="M" ;; Tue) out+="T" ;; Wed) out+="W" ;;
            Thu) out+="R" ;; Fri) out+="F" ;; Sat) out+="S" ;; Sun) out+="U" ;;
        esac
    done
    echo "$out"
}

# --- scheduling ---------------------------------------------------------------
# backend_schedule id action kind when force wake_at grace fire_runner
# Echoes a handle (the plist path, or "pmset" for wake jobs).
backend_schedule() {
    local id="$1" action="$2" kind="$3" when="$4" _force="$5" _wake="$6" _grace="$7" fire_runner="$8"
    ps_valid_id "$id" || { ps_err "refusing to schedule malformed job id: '$id'"; return 1; }

    # Wake jobs go straight to pmset — only firmware can power a Mac on.
    if [[ "$action" == "wake" || "$action" == "wake-poweron" ]]; then
        local evt="wake"; [[ "$action" == "wake-poweron" ]] && evt="wakeorpoweron"
        if [[ "$kind" == "oneshot" ]]; then
            pmset schedule "$evt" "$(du_epoch_to_pmset "$when")" || return 1
        else
            local hh mm days letters
            IFS=':' read -r hh mm days <<<"$when"
            letters=$(_macos_pmset_days "$days")
            [[ -n "$letters" ]] || { ps_err "no valid weekdays in '$days'"; return 1; }
            ps_warn "pmset allows only one repeating wake event; this replaces any existing one"
            pmset repeat "$evt" "$letters" "${hh}:${mm}:00" || return 1
        fi
        printf 'pmset:%s\n' "$action"
        return 0
    fi

    # shutdown/sleep/restart -> a LaunchDaemon that runs the fire-runner.
    local plist="${_LD_DIR}/${_LD_PREFIX}.${id}.plist"
    local label="${_LD_PREFIX}.${id}"
    {
        cat <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${fire_runner}</string>
    <string>${id}</string>
  </array>
  <key>StartCalendarInterval</key>
EOF
        if [[ "$kind" == "oneshot" ]]; then
            printf '  <dict>\n'
            printf '    <key>Month</key><integer>%s</integer>\n' "$(du_fmt "$when" '%-m')"
            printf '    <key>Day</key><integer>%s</integer>\n'   "$(du_fmt "$when" '%-d')"
            printf '    <key>Hour</key><integer>%s</integer>\n'  "$(du_fmt "$when" '%-H')"
            printf '    <key>Minute</key><integer>%s</integer>\n' "$(du_fmt "$when" '%-M')"
            printf '  </dict>\n'
        else
            local hh mm days
            IFS=':' read -r hh mm days <<<"$when"
            _macos_calintervals "$hh" "$mm" "$days"
        fi
        cat <<EOF
  <key>RunAtLoad</key><false/>
</dict>
</plist>
EOF
    } >"$plist" || return 1
    chmod 644 "$plist"
    launchctl bootstrap system "$plist" 2>/dev/null || launchctl load "$plist" 2>/dev/null || return 1
    printf '%s\n' "$plist"
}

# Emit StartCalendarInterval body for recurring jobs (array of dicts per day).
_macos_calintervals() {
    local hh="$1" mm="$2" days="$3"
    if [[ "$days" == "daily" ]]; then
        printf '  <dict><key>Hour</key><integer>%s</integer><key>Minute</key><integer>%s</integer></dict>\n' \
            "$((10#$hh))" "$((10#$mm))"
        return
    fi
    # map weekdays -> launchd Weekday (Sun=0..Sat=6)
    printf '  <array>\n'
    local IFS=',' d num
    for d in $days; do
        case "$d" in
            Sun) num=0 ;; Mon) num=1 ;; Tue) num=2 ;; Wed) num=3 ;;
            Thu) num=4 ;; Fri) num=5 ;; Sat) num=6 ;;
        esac
        printf '    <dict><key>Weekday</key><integer>%s</integer><key>Hour</key><integer>%s</integer><key>Minute</key><integer>%s</integer></dict>\n' \
            "$num" "$((10#$hh))" "$((10#$mm))"
    done
    printf '  </array>\n'
}

# --- cancel -------------------------------------------------------------------
# backend_cancel id handle action kind
backend_cancel() {
    local id="$1" handle="$2" action="$3" _kind="$4"
    ps_valid_id "$id" || { ps_err "refusing to cancel malformed job id: '$id'"; return 1; }
    if [[ "$action" == "wake" || "$action" == "wake-poweron" ]]; then
        # Best effort: cancel matching scheduled wake(s); repeats cleared wholesale.
        pmset repeat cancel 2>/dev/null || true
        return 0
    fi
    local label="${_LD_PREFIX}.${id}"
    launchctl bootout "system/${label}" 2>/dev/null || launchctl unload "$handle" 2>/dev/null || true
    # Only ever remove a plist we own, under the expected directory.
    if [[ "$handle" == "${_LD_DIR}/${_LD_PREFIX}."*.plist && -f "$handle" ]]; then
        rm -f "$handle"
    fi
    return 0
}

# backend_disarm id handle action kind
# Remove the on-disk artifact so the job cannot re-fire across a reboot, WITHOUT
# booting out the currently-running label. The fire-runner IS the launchd job, so
# `launchctl bootout` on its own label would SIGTERM it mid-action — disarm must
# never do that. The in-memory one-shot lingers harmlessly until the next reboot
# (plist gone) or, for sleep, until wake; it will not re-fire the same day.
backend_disarm() {
    local id="$1" handle="$2" action="$3" _kind="$4"
    ps_valid_id "$id" || return 1
    [[ "$action" == "wake" || "$action" == "wake-poweron" ]] && return 0
    if [[ "$handle" == "${_LD_DIR}/${_LD_PREFIX}."*.plist && -f "$handle" ]]; then
        rm -f "$handle"
    fi
    return 0
}

# --- fire-runner primitives ---------------------------------------------------
backend_notify() {
    local msg="$1" uid user esc
    user=$(_macos_console_user); uid=$(_macos_console_uid)
    [[ -z "$uid" || "$user" == "root" ]] && return 0   # no GUI session
    # Escape for an AppleScript string literal: backslash first, then quote.
    esc="${msg//\\/\\\\}"; esc="${esc//\"/\\\"}"
    launchctl asuser "$uid" sudo -u "$user" \
        osascript -e "display notification \"${esc}\" with title \"powersched\"" 2>/dev/null || true
}

# backend_program_wake epoch poweron_bool
backend_program_wake() {
    local epoch="$1" poweron="$2" evt="wake"
    [[ "$poweron" == "true" ]] && evt="wakeorpoweron"
    pmset schedule "$evt" "$(du_epoch_to_pmset "$epoch")" 2>/dev/null
}

# backend_perform action force
backend_perform() {
    local action="$1" force="$2" user
    user=$(_macos_console_user)
    case "$action" in
        sleep)   pmset sleepnow ;;
        shutdown)
            if [[ "$force" == "true" ]]; then shutdown -h now
            else osascript -e 'tell application "System Events" to shut down' 2>/dev/null \
                 || shutdown -h now; fi ;;
        restart)
            if [[ "$force" == "true" ]]; then shutdown -r now
            else osascript -e 'tell application "System Events" to restart' 2>/dev/null \
                 || shutdown -r now; fi ;;
        *) ps_err "backend_perform: unknown action '$action'"; return 1 ;;
    esac
}
