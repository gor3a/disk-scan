import { humanBytes } from '../lib/format'

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex-1 rounded-xl border border-line bg-paper px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">{label}</div>
      <div className={`mt-1 font-mono text-lg tnum ${accent ? 'text-accent' : 'text-ink'}`}>{value}</div>
    </div>
  )
}

export function ConfirmScreen({
  deleteBytes,
  trashBytes,
  count,
  onConfirm,
  onBack,
}: {
  deleteBytes: number
  trashBytes: number
  count: number
  onConfirm: () => void
  onBack: () => void
}) {
  return (
    <div className="grid min-h-screen place-items-center px-10">
      <div className="rise w-full max-w-md">
        <h2 className="font-display text-[28px] leading-tight text-ink">Ready to clean up?</h2>
        <p className="mt-2 text-sm text-ink-soft">
          {count} item{count === 1 ? '' : 's'} selected. Nothing happens until you confirm.
        </p>

        <div className="mt-5 flex gap-3">
          <Stat label="Delete" value={humanBytes(deleteBytes)} accent />
          <Stat label="To Trash" value={humanBytes(trashBytes)} />
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 rounded-2xl bg-accent px-6 py-3.5 font-semibold text-white shadow-[0_10px_24px_-10px_rgba(31,122,92,0.8)] transition-all hover:-translate-y-0.5 hover:bg-accent-deep"
          >
            Clean now
          </button>
          <button
            onClick={onBack}
            className="rounded-2xl border border-line bg-surface px-6 py-3.5 font-semibold text-ink-soft transition-colors hover:text-ink"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  )
}
