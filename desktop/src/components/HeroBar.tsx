import type { Disk } from '../lib/protocol'
import { humanBytes } from '../lib/format'

export function HeroBar({
  reclaimable,
  disk,
  onClean,
}: {
  reclaimable: number
  disk?: Disk
  onClean: () => void
}) {
  const pct = disk ? Math.round((disk.used / disk.total) * 100) : 0
  return (
    <div className="flex items-center gap-4 p-5 border-b border-slate-100">
      <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
        {pct}% full
      </div>
      <div>
        <h2 className="text-lg font-bold text-slate-900">
          {humanBytes(reclaimable)} can be freed safely
        </h2>
        {disk && (
          <p className="text-sm text-slate-500">
            {humanBytes(disk.free)} free of {humanBytes(disk.total)}
          </p>
        )}
      </div>
      <button
        onClick={onClean}
        className="ml-auto bg-indigo-600 text-white font-bold px-5 py-3 rounded-xl"
      >
        Free up {humanBytes(reclaimable)}
      </button>
    </div>
  )
}
