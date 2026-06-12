import { useState } from 'react'
import { CalendarPlus } from 'lucide-react'
import { ACTIONS, type Action, type ScheduleRequest, type TimeSpec } from '../../lib/powersched'
import { actionIcon } from './icons'

type Mode = 'relative' | 'at' | 'recurring'
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
const FIELD =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent'

export function ScheduleForm({ onSchedule }: { onSchedule: (req: ScheduleRequest) => void }) {
  const [action, setAction] = useState<Action>('shutdown')
  const [mode, setMode] = useState<Mode>('relative')
  const [rel, setRel] = useState('2h')
  const [at, setAt] = useState('23:00')
  const [recPreset, setRecPreset] = useState<'daily' | 'weekday' | 'custom'>('daily')
  const [recDays, setRecDays] = useState<Set<string>>(new Set(['Mon']))
  const [recTime, setRecTime] = useState('01:00')
  const [force, setForce] = useState(false)
  const [wakeOn, setWakeOn] = useState(false)
  const [wakeAt, setWakeAt] = useState('07:00')
  const [powerOn, setPowerOn] = useState(false)
  const [grace, setGrace] = useState(120)

  const supportsWakeAt = action === 'shutdown' || action === 'sleep'

  function buildTime(): TimeSpec {
    if (mode === 'relative') return { kind: 'relative', value: rel.trim() }
    if (mode === 'at') return { kind: 'at', value: at.trim() }
    const days = recPreset === 'custom' ? WEEKDAYS.filter((d) => recDays.has(d)).join(',') : recPreset
    return { kind: 'recurring', days, time: recTime.trim() }
  }

  function submit() {
    const req: ScheduleRequest = { action, time: buildTime(), grace }
    if (force) req.force = true
    if (supportsWakeAt && wakeOn) req.wakeAt = wakeAt.trim()
    if (action === 'wake' && powerOn) req.powerOn = true
    onSchedule(req)
  }

  return (
    <section className="flex h-full flex-col">
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg text-ink">
        <CalendarPlus size={18} className="text-accent" /> New schedule
      </h2>

      <div className="space-y-4 overflow-y-auto pr-1">
        <Field label="Action">
          <div className="grid grid-cols-4 gap-2">
            {ACTIONS.map((a) => {
              const Icon = actionIcon(a)
              const on = action === a
              return (
                <button
                  key={a}
                  onClick={() => setAction(a)}
                  className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-xs capitalize transition-colors ${
                    on ? 'border-accent bg-accent/10 text-accent' : 'border-line text-ink-soft hover:text-ink'
                  }`}
                >
                  <Icon size={18} />
                  {a}
                </button>
              )
            })}
          </div>
        </Field>

        <Field label="When">
          <div className="mb-2 inline-flex rounded-lg border border-line p-0.5 text-xs">
            {(['relative', 'at', 'recurring'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-md px-3 py-1 capitalize ${
                  mode === m ? 'bg-accent text-white' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {mode === 'relative' && (
            <input
              className={`${FIELD} font-mono`}
              value={rel}
              onChange={(e) => setRel(e.target.value)}
              placeholder="2h · 90m · 1h30m"
            />
          )}
          {mode === 'at' && (
            <input
              className={`${FIELD} font-mono`}
              value={at}
              onChange={(e) => setAt(e.target.value)}
              placeholder="23:00 · 2026-06-12 01:30"
            />
          )}
          {mode === 'recurring' && (
            <div className="space-y-2">
              <div className="inline-flex rounded-lg border border-line p-0.5 text-xs">
                {(['daily', 'weekday', 'custom'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setRecPreset(p)}
                    className={`rounded-md px-3 py-1 capitalize ${
                      recPreset === p ? 'bg-accent text-white' : 'text-ink-soft hover:text-ink'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              {recPreset === 'custom' && (
                <div className="flex flex-wrap gap-1">
                  {WEEKDAYS.map((d) => {
                    const on = recDays.has(d)
                    return (
                      <button
                        key={d}
                        onClick={() => {
                          const next = new Set(recDays)
                          on ? next.delete(d) : next.add(d)
                          setRecDays(next)
                        }}
                        className={`rounded-md border px-2 py-1 text-xs ${
                          on ? 'border-accent bg-accent/10 text-accent' : 'border-line text-ink-soft'
                        }`}
                      >
                        {d}
                      </button>
                    )
                  })}
                </div>
              )}
              <input
                className={`${FIELD} font-mono`}
                value={recTime}
                onChange={(e) => setRecTime(e.target.value)}
                placeholder="01:00"
              />
            </div>
          )}
        </Field>

        <Field label="Options">
          <div className="space-y-2">
            <Toggle checked={force} onChange={setForce} label="Force (override blocks / unsaved work)" />
            {supportsWakeAt && (
              <div className="flex items-center gap-2">
                <Toggle checked={wakeOn} onChange={setWakeOn} label="Also wake at" />
                {wakeOn && (
                  <input
                    className={`${FIELD} !w-28 font-mono`}
                    value={wakeAt}
                    onChange={(e) => setWakeAt(e.target.value)}
                    placeholder="07:00"
                  />
                )}
              </div>
            )}
            {action === 'wake' && (
              <Toggle checked={powerOn} onChange={setPowerOn} label="Power on from off" />
            )}
            <div className="flex items-center gap-2 text-sm text-ink-soft">
              <span>Grace</span>
              <input
                type="number"
                min={0}
                className={`${FIELD} !w-24 font-mono`}
                value={grace}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10)
                  setGrace(Number.isNaN(n) ? 0 : Math.max(0, n))
                }}
              />
              <span>seconds before firing</span>
            </div>
          </div>
        </Field>
      </div>

      <button
        className="mt-4 w-full rounded-lg bg-accent px-3 py-2.5 text-sm font-semibold text-white hover:bg-accent-deep"
        onClick={submit}
      >
        Schedule
      </button>
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-soft">{label}</div>
      {children}
    </div>
  )
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[var(--accent)]"
      />
      <span>{label}</span>
    </label>
  )
}
