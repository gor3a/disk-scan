import { humanBytes } from '../lib/format'

const PHASE: Record<string, string> = {
  caches: 'Scanning caches & build files',
  largeFiles: 'Scanning your largest files',
  projects: 'Finding node_modules projects',
}

export function ScanLine({
  scanning,
  phase,
  scanned,
  bytes,
  currentPath,
  onStop,
}: {
  scanning: boolean
  phase?: string
  scanned: number
  bytes: number
  currentPath?: string
  onStop: () => void
}) {
  if (!scanning) return null
  return (
    <div className="flex items-center gap-3 px-5 py-2.5 text-[12.5px] text-ink-soft">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" />
      <span>{phase ? (PHASE[phase] ?? 'Scanning') : 'Scanning'}…</span>
      <span className="font-semibold text-ink tnum">{scanned} found</span>
      <span className="tnum">· {humanBytes(bytes)}</span>
      {currentPath && (
        <span className="ml-2 truncate font-mono text-[11px] text-review/80">{currentPath}</span>
      )}
      <button
        onClick={onStop}
        className="ml-auto rounded-lg border border-line px-3 py-1 font-semibold text-ink-soft hover:text-ink"
      >
        Stop
      </button>
    </div>
  )
}
