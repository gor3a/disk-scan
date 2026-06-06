import type { CleanResult } from '../state'
import { humanBytes } from '../lib/format'

export function DoneScreen({
  result,
  onAgain,
}: {
  result: CleanResult
  onAgain: () => void
}) {
  return (
    <div className="p-8 text-center">
      <h2 className="text-2xl font-bold text-slate-900">
        Freed {humanBytes(result.freed + result.trashed)} 🎉
      </h2>
      {result.errors.length > 0 && (
        <ul className="text-sm text-red-600 mt-3 text-left">
          {result.errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
      <button onClick={onAgain} className="mt-6 text-indigo-600 underline">
        Scan again
      </button>
    </div>
  )
}
