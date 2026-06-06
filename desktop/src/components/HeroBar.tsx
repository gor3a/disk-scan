import type { Disk } from '../lib/protocol'
import { humanBytes } from '../lib/format'

// Gauge: a thin ring showing how full the disk is, with the reclaimable slice
// highlighted in the accent color.
function Gauge({ usedPct, reclaimPct }: { usedPct: number; reclaimPct: number }) {
  const r = 30
  const c = 2 * Math.PI * r
  const used = (usedPct / 100) * c
  const reclaim = (reclaimPct / 100) * c
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" className="shrink-0 -rotate-90">
      <circle cx="38" cy="38" r={r} fill="none" stroke="var(--line)" strokeWidth="7" />
      <circle
        cx="38"
        cy="38"
        r={r}
        fill="none"
        stroke="var(--ink-soft)"
        strokeWidth="7"
        strokeDasharray={`${used} ${c}`}
        strokeLinecap="round"
        opacity="0.45"
      />
      <circle
        cx="38"
        cy="38"
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="7"
        strokeDasharray={`${reclaim} ${c}`}
        strokeLinecap="round"
      />
    </svg>
  )
}

export function HeroBar({
  reclaimable,
  disk,
  onClean,
}: {
  reclaimable: number
  disk?: Disk
  onClean: () => void
}) {
  const usedPct = disk ? (disk.used / disk.total) * 100 : 0
  const reclaimPct = disk && disk.total ? (reclaimable / disk.total) * 100 : 0
  const empty = reclaimable === 0

  return (
    <header className="rise flex items-center gap-5 px-7 py-6">
      <div className="relative">
        <Gauge usedPct={usedPct} reclaimPct={reclaimPct} />
        <span className="absolute inset-0 grid place-items-center text-[11px] font-semibold text-ink-soft tnum">
          {Math.round(usedPct)}%
        </span>
      </div>

      <div className="min-w-0">
        <h1 className="font-display text-[34px] leading-none text-ink tracking-tight">
          <span className="tnum">{humanBytes(reclaimable)}</span>
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          can be freed safely
          {disk && (
            <span className="text-ink-soft/70">
              {' · '}
              <span className="tnum">{humanBytes(disk.free)}</span> free of{' '}
              <span className="tnum">{humanBytes(disk.total)}</span>
            </span>
          )}
        </p>
      </div>

      <button
        onClick={onClean}
        disabled={empty}
        className="group ml-auto shrink-0 rounded-2xl bg-accent px-6 py-3.5 font-semibold text-white shadow-[0_10px_24px_-10px_rgba(31,122,92,0.8)] transition-all hover:bg-accent-deep hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 disabled:shadow-none disabled:hover:translate-y-0"
      >
        Free up <span className="tnum">{humanBytes(reclaimable)}</span>
        <span className="ml-1 inline-block transition-transform group-hover:translate-x-0.5">→</span>
      </button>
    </header>
  )
}
