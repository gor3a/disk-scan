import type { CleanResult } from '../state'
import { humanBytes } from '../lib/format'

export function DoneScreen({
  result,
  onAgain,
}: {
  result: CleanResult
  onAgain: () => void
}) {
  const total = result.freed + result.trashed
  return (
    <div className="grid min-h-screen place-items-center px-10 text-center">
      <div className="rise">
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-safe-bg text-safe">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
            <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-sm font-semibold uppercase tracking-wider text-ink-soft">You reclaimed</p>
        <h2 className="font-display text-[46px] leading-none text-ink tnum">{humanBytes(total)}</h2>

        {result.errors.length > 0 && (
          <ul className="mx-auto mt-5 max-w-sm space-y-1 text-left text-[12.5px] text-review">
            {result.errors.map((e, i) => (
              <li key={i}>• {e}</li>
            ))}
          </ul>
        )}

        <button
          onClick={onAgain}
          className="mt-8 rounded-2xl border border-line bg-surface px-6 py-3 font-semibold text-ink transition-all hover:-translate-y-0.5 hover:shadow-card"
        >
          Scan again
        </button>
      </div>
    </div>
  )
}
