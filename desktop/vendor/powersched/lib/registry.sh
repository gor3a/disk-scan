#!/bin/bash
# registry.sh — CRUD on a line-based TSV job registry. Requires common.sh.
#
# Row format (tab-separated, 10 fields):
#   id  action  force  kind  when  handle  wake_at  created  spec  grace
# where:
#   kind     = oneshot | recurring
#   when     = <epoch>            (oneshot)
#            | HH:MM:days         (recurring, e.g. 01:00:daily or 22:15:Mon,Wed)
#   handle   = backend artifact id (plist path / unit base / pmset signature)
#   wake_at  = <epoch> | -
#   spec     = original human time spec (for display)
#   grace    = grace seconds before the action fires

reg_init() {
    mkdir -p "$POWERSCHED_STATE_DIR" 2>/dev/null || return 1
    [[ -f "$POWERSCHED_REGISTRY" ]] || : >"$POWERSCHED_REGISTRY"
}

# reg_add id action force kind when handle wake_at created spec grace
reg_add() {
    reg_init || return 1
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
        "$1" "$2" "$3" "$4" "$5" "$6" "${7:--}" "$8" "$9" "${10:-120}" >>"$POWERSCHED_REGISTRY"
}

# reg_get id -> echoes the matching row, returns 1 if absent.
reg_get() {
    [[ -f "$POWERSCHED_REGISTRY" ]] || return 1
    local row
    row=$(awk -F'\t' -v id="$1" '$1==id {print; exit}' "$POWERSCHED_REGISTRY")
    [[ -n "$row" ]] || return 1
    printf '%s\n' "$row"
}

# reg_all -> echoes every row (may be empty). Always returns 0.
reg_all() {
    [[ -f "$POWERSCHED_REGISTRY" ]] || return 0
    cat "$POWERSCHED_REGISTRY"
}

# reg_exists id -> returns 0 if a job with that id exists.
reg_exists() { reg_get "$1" >/dev/null 2>&1; }

# reg_remove id -> deletes the row, returns 0 if something was removed.
reg_remove() {
    [[ -f "$POWERSCHED_REGISTRY" ]] || return 1
    local tmp
    tmp="${POWERSCHED_REGISTRY}.tmp.$$"
    awk -F'\t' -v id="$1" '$1!=id' "$POWERSCHED_REGISTRY" >"$tmp" || { rm -f "$tmp"; return 1; }
    # detect whether a row actually went away
    local before after
    before=$(wc -l <"$POWERSCHED_REGISTRY")
    after=$(wc -l <"$tmp")
    mv "$tmp" "$POWERSCHED_REGISTRY"
    [[ "$before" != "$after" ]]
}

# reg_field "<row>" N -> echoes the Nth tab field (1-based).
reg_field() { printf '%s\n' "$1" | cut -f"$2"; }

# reg_ids -> echoes all job ids, one per line.
reg_ids() {
    [[ -f "$POWERSCHED_REGISTRY" ]] || return 0
    cut -f1 "$POWERSCHED_REGISTRY"
}
