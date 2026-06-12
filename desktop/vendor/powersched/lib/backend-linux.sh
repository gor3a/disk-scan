#!/bin/bash
# backend-linux.sh — systemd (scheduler) + rtcwake (wake) implementation.
# Requires common.sh + dateutil.sh sourced first. Runs privileged (root).

_SD_DIR="/etc/systemd/system"
_SD_PREFIX="powersched"
_RTC_WAKEALARM="/sys/class/rtc/rtc0/wakealarm"

backend_check_deps() {
    command -v systemctl >/dev/null 2>&1 || { ps_err "systemctl not found (this backend needs systemd)"; return 1; }
    return 0
}

# --- scheduling ---------------------------------------------------------------
# backend_schedule id action kind when force wake_at grace fire_runner
backend_schedule() {
    local id="$1" action="$2" kind="$3" when="$4" _force="$5" _wake="$6" _grace="$7" fire_runner="$8"
    ps_valid_id "$id" || { ps_err "refusing to schedule malformed job id: '$id'"; return 1; }

    if [[ "$action" == "wake" || "$action" == "wake-poweron" ]]; then
        command -v rtcwake >/dev/null 2>&1 || { ps_err "rtcwake not found (install util-linux)"; return 1; }
        if [[ "$kind" == "recurring" ]]; then
            ps_err "recurring wake is not supported on Linux (RTC has a single alarm slot); use a one-shot wake, or --wake-at on a sleep job"
            return 1
        fi
        [[ "$action" == "wake-poweron" ]] && \
            ps_warn "power-on-from-off depends on BIOS/UEFI RTC wake support and may not work on all hardware"
        rtcwake -m no -t "$when" >/dev/null 2>&1 || { ps_err "rtcwake failed to set the RTC alarm"; return 1; }
        printf 'rtcwake\n'
        return 0
    fi

    local svc="${_SD_PREFIX}-${id}.service"
    local tmr="${_SD_PREFIX}-${id}.timer"
    local oncal persistent="false"
    if [[ "$kind" == "oneshot" ]]; then
        oncal=$(du_epoch_to_oncalendar "$when")
    else
        local hh mm days dow=""
        IFS=':' read -r hh mm days <<<"$when"
        [[ "$days" != "daily" ]] && dow="$days "
        oncal="${dow}*-*-* ${hh}:${mm}:00"
        persistent="true"
    fi

    cat >"${_SD_DIR}/${svc}" <<EOF || return 1
[Unit]
Description=powersched ${action} (${id})

[Service]
Type=oneshot
ExecStart=/bin/bash ${fire_runner} ${id}
EOF

    {
        printf '[Unit]\nDescription=powersched %s timer (%s)\n\n[Timer]\n' "$action" "$id"
        printf 'OnCalendar=%s\n' "$oncal"
        printf 'AccuracySec=1s\n'
        [[ "$persistent" == "true" ]] && printf 'Persistent=true\n'
        printf '\n[Install]\nWantedBy=timers.target\n'
    } >"${_SD_DIR}/${tmr}" || return 1

    systemctl daemon-reload || return 1
    systemctl enable --now "$tmr" >/dev/null 2>&1 || { systemctl start "$tmr" || return 1; }
    printf '%s\n' "$tmr"
}

# --- cancel -------------------------------------------------------------------
# backend_cancel id handle action kind
backend_cancel() {
    local id="$1" _handle="$2" action="$3" _kind="$4"
    ps_valid_id "$id" || { ps_err "refusing to cancel malformed job id: '$id'"; return 1; }
    if [[ "$action" == "wake" || "$action" == "wake-poweron" ]]; then
        [[ -w "$_RTC_WAKEALARM" ]] && echo 0 >"$_RTC_WAKEALARM" 2>/dev/null || true
        return 0
    fi
    local svc="${_SD_PREFIX}-${id}.service" tmr="${_SD_PREFIX}-${id}.timer"
    systemctl disable --now "$tmr" >/dev/null 2>&1 || true
    rm -f "${_SD_DIR}/${tmr}" "${_SD_DIR}/${svc}"
    systemctl daemon-reload >/dev/null 2>&1 || true
    return 0
}

# backend_disarm id handle action kind
# Remove the on-disk units so the job cannot re-fire across a reboot. Safe to call
# from the running service: disabling/removing the TIMER does not stop the SERVICE
# that is currently executing the fire-runner.
backend_disarm() {
    local id="$1" _handle="$2" action="$3" _kind="$4"
    ps_valid_id "$id" || return 1
    [[ "$action" == "wake" || "$action" == "wake-poweron" ]] && return 0
    local svc="${_SD_PREFIX}-${id}.service" tmr="${_SD_PREFIX}-${id}.timer"
    systemctl disable "$tmr" >/dev/null 2>&1 || true
    rm -f "${_SD_DIR}/${tmr}" "${_SD_DIR}/${svc}"
    systemctl daemon-reload >/dev/null 2>&1 || true
    return 0
}

# --- fire-runner primitives ---------------------------------------------------
# Resolve the active graphical session user; echoes "user uid" or nothing.
_linux_gui_session() {
    local sid typ state name
    for sid in $(loginctl list-sessions --no-legend 2>/dev/null | awk '{print $1}'); do
        typ=$(loginctl show-session "$sid" -p Type --value 2>/dev/null)
        state=$(loginctl show-session "$sid" -p State --value 2>/dev/null)
        if [[ ("$typ" == "x11" || "$typ" == "wayland") && "$state" == "active" ]]; then
            name=$(loginctl show-session "$sid" -p Name --value 2>/dev/null)
            printf '%s %s\n' "$name" "$(id -u "$name" 2>/dev/null)"
            return 0
        fi
    done
    return 1
}

backend_notify() {
    local msg="$1" user uid info
    command -v notify-send >/dev/null 2>&1 || return 0
    info=$(_linux_gui_session) || return 0
    read -r user uid <<<"$info"
    [[ -n "$user" && -n "$uid" ]] || return 0
    sudo -u "$user" \
        DISPLAY="${DISPLAY:-:0}" \
        DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/${uid}/bus" \
        notify-send "powersched" "$msg" 2>/dev/null || true
}

# backend_program_wake epoch poweron_bool
backend_program_wake() {
    local epoch="$1" _poweron="$2"
    command -v rtcwake >/dev/null 2>&1 || { ps_warn "rtcwake unavailable; cannot program wake"; return 1; }
    rtcwake -m no -t "$epoch" >/dev/null 2>&1
}

# backend_perform action force
backend_perform() {
    local action="$1" force="$2"
    case "$action" in
        sleep)    systemctl suspend ;;
        shutdown) if [[ "$force" == "true" ]]; then systemctl poweroff -i; else systemctl poweroff; fi ;;
        restart)  if [[ "$force" == "true" ]]; then systemctl reboot -i;   else systemctl reboot;   fi ;;
        *) ps_err "backend_perform: unknown action '$action'"; return 1 ;;
    esac
}
