// powersched — shared types + pure logic for the Schedule tab. No Electron/Node
// deps, so it is unit-testable and usable from both main and renderer.

export type Action = 'shutdown' | 'sleep' | 'restart' | 'wake'

export type TimeSpec =
  | { kind: 'relative'; value: string } // "2h" | "90m" | "1h30m" | "2d" | "30s"
  | { kind: 'at'; value: string } // "23:00" | "2026-06-12 01:30"
  | { kind: 'recurring'; days: string; time: string } // days: "daily"|"weekday"|"Mon,Wed"

export interface ScheduleRequest {
  action: Action
  time: TimeSpec
  force?: boolean
  wakeAt?: string
  powerOn?: boolean
  grace?: number
}

export interface Job {
  id: string
  action: string
  force: boolean
  kind: 'oneshot' | 'recurring'
  when: string // epoch seconds (oneshot) | "HH:MM:days" (recurring)
  wakeAt: number | null
  grace: number
  spec: string
}

export interface Result {
  ok: boolean
  message: string
}

export const ACTIONS: Action[] = ['shutdown', 'sleep', 'restart', 'wake']
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

const RE_RELATIVE = /^(\d+[dhms])+$/
const RE_HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/
const RE_DATETIME = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]) ([01]?\d|2[0-3]):[0-5]\d$/
const RE_DAYLIST = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)(,(Mon|Tue|Wed|Thu|Fri|Sat|Sun))*$/

const UNIT_SECONDS: Record<string, number> = { d: 86400, h: 3600, m: 60, s: 1 }

function durationSeconds(value: string): number {
  let total = 0
  for (const m of value.matchAll(/(\d+)([dhms])/g)) total += Number(m[1]) * UNIT_SECONDS[m[2]]
  return total
}

function assertTime(spec: TimeSpec): void {
  if (spec.kind === 'relative') {
    if (!RE_RELATIVE.test(spec.value) || durationSeconds(spec.value) <= 0)
      throw new Error(`Invalid duration "${spec.value}" (try 2h, 90m, 1h30m)`)
  } else if (spec.kind === 'at') {
    if (!RE_HHMM.test(spec.value) && !RE_DATETIME.test(spec.value))
      throw new Error(`Invalid time "${spec.value}" (try 23:00 or 2026-06-12 01:30)`)
  } else {
    if (!RE_HHMM.test(spec.time)) throw new Error(`Invalid time "${spec.time}" (try 01:00)`)
    if (spec.days !== 'daily' && spec.days !== 'weekday' && !RE_DAYLIST.test(spec.days))
      throw new Error(`Invalid days "${spec.days}"`)
  }
}

/**
 * Translate a ScheduleRequest into powersched CLI argv (without the binary).
 * Single audited place that turns structured input into command tokens — the
 * renderer never builds these. Throws on invalid input.
 */
export function toArgv(req: ScheduleRequest): string[] {
  if (!ACTIONS.includes(req.action)) throw new Error(`Unknown action "${req.action}"`)
  assertTime(req.time)

  const argv: string[] = [req.action]
  if (req.time.kind === 'relative') argv.push('in', req.time.value)
  else if (req.time.kind === 'at') argv.push('at', ...req.time.value.split(' '))
  else {
    const dayWord =
      req.time.days === 'daily' ? 'day' : req.time.days === 'weekday' ? 'weekday' : req.time.days
    argv.push('every', dayWord, 'at', req.time.time)
  }

  if (req.force) argv.push('--force')
  if (req.powerOn && req.action === 'wake') argv.push('--power-on')
  if (req.wakeAt) {
    if (!RE_HHMM.test(req.wakeAt) && !RE_DATETIME.test(req.wakeAt))
      throw new Error(`Invalid wake-at time "${req.wakeAt}"`)
    argv.push('--wake-at', req.wakeAt)
  }
  if (req.grace !== undefined) {
    if (!Number.isInteger(req.grace) || req.grace < 0)
      throw new Error('Grace must be a whole number of seconds')
    argv.push('--grace', String(req.grace))
  }
  return argv
}

/** Compute the next fire time (epoch seconds) for a job, or null if unknown. */
export function nextFire(job: Job, now: number = Math.floor(Date.now() / 1000)): number | null {
  if (job.kind === 'oneshot') {
    const e = Number(job.when)
    return Number.isFinite(e) ? e : null
  }
  const [hh, mm, days] = splitRecurring(job.when)
  if (hh === null) return null
  const allowed = recurringDayset(days)
  // Calendar arithmetic (not now+86400) so DST doesn't shift weekday/wall-clock.
  const base = new Date(now * 1000)
  for (let d = 0; d < 8; d++) {
    const cand = new Date(base.getFullYear(), base.getMonth(), base.getDate() + d, hh, mm, 0, 0)
    const epoch = Math.floor(cand.getTime() / 1000)
    if (epoch <= now) continue
    if (allowed === 'daily' || allowed.has(DAY_NAMES[cand.getDay()])) return epoch
  }
  return null
}

function splitRecurring(when: string): [number | null, number, string] {
  const m = when.match(/^(\d{1,2}):(\d{2}):(.+)$/)
  if (!m) return [null, 0, '']
  return [Number(m[1]), Number(m[2]), m[3]]
}

function recurringDayset(days: string): 'daily' | Set<string> {
  if (days === 'daily') return 'daily'
  return new Set(days.split(','))
}

/** Human countdown like "in 1h 12m", "in 45s", or "now". */
export function formatCountdown(
  target: number | null,
  now: number = Math.floor(Date.now() / 1000),
): string {
  if (target === null) return '—'
  let s = target - now
  if (s <= 0) return 'now'
  const d = Math.floor(s / 86400)
  s -= d * 86400
  const h = Math.floor(s / 3600)
  s -= h * 3600
  const m = Math.floor(s / 60)
  const sec = s - m * 60
  const parts: string[] = []
  if (d) parts.push(`${d}d`)
  if (h) parts.push(`${h}h`)
  if (m) parts.push(`${m}m`)
  if (!d && !h && !m) parts.push(`${sec}s`)
  return `in ${parts.slice(0, 2).join(' ')}`
}

/** Short human label for a job's schedule (for lists). */
export function describeWhen(job: Job): string {
  if (job.kind === 'recurring') return job.spec
  const e = Number(job.when)
  if (!Number.isFinite(e)) return job.spec
  const dt = new Date(e * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

// --- renderer-side helpers ----------------------------------------------------

/** Jobs sorted by next fire time (soonest first); unknown/last. */
export function sortedJobs(jobs: Job[], now?: number): Job[] {
  return [...jobs].sort((a, b) => (nextFire(a, now) ?? Infinity) - (nextFire(b, now) ?? Infinity))
}

/** Hide one-shots whose fire+grace window already passed (CLI reaps them on the
 *  next privileged action; the read-only poll can still surface them). */
export function visibleJobs(jobs: Job[], now: number = Math.floor(Date.now() / 1000)): Job[] {
  return jobs.filter((j) => {
    if (j.kind === 'recurring') return true
    const f = nextFire(j, now)
    return f === null || now <= f + j.grace + 30
  })
}

export interface Toast {
  id: number
  kind: 'ok' | 'err'
  message: string
}

let toastSeq = 0
export function makeToast(kind: 'ok' | 'err', message: string): Toast {
  return { id: ++toastSeq, kind, message }
}
