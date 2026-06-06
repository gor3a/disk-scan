export function ScanProgress({
  scanned,
  onCancel,
}: {
  scanned: number
  onCancel: () => void
}) {
  return (
    <div className="grid min-h-screen place-items-center px-10 text-center">
      <div className="rise">
        <div className="mx-auto mb-7 h-12 w-12 animate-spin rounded-full border-[3px] border-line border-t-accent" />
        <p className="font-display text-[26px] leading-tight text-ink">Scanning your disk…</p>
        <p className="mt-2 text-sm text-ink-soft">
          <span className="tnum">{scanned}</span> items found so far
        </p>
        <button
          onClick={onCancel}
          className="mt-7 text-[13px] text-ink-soft underline underline-offset-4 transition-colors hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
