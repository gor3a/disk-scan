import { RotateCw, Square } from 'lucide-react'

// A single per-tab toggle: Stop while a scan runs, Reload (rescan) when idle.
// Placed consistently at the right of the tab row across all tabs.
export function RescanButton({
  scanning,
  onReload,
  onStop,
}: {
  scanning: boolean
  onReload: () => void
  onStop: () => void
}) {
  return scanning ? (
    <button
      onClick={onStop}
      title="Stop scanning (Esc)"
      className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-semibold text-[#b91c1c] transition-colors hover:bg-surface"
    >
      <Square size={13} strokeWidth={2} /> Stop
    </button>
  ) : (
    <button
      onClick={onReload}
      title="Rescan (⌘R)"
      className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-soft transition-colors hover:bg-surface hover:text-ink"
    >
      <RotateCw size={13} strokeWidth={2} /> Reload
    </button>
  )
}
