import { humanBytes } from '../lib/format'

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
    <div className="p-8">
      <h2 className="text-lg font-bold text-slate-900">Ready to clean</h2>
      <p className="text-slate-600 mt-2">
        Delete {humanBytes(deleteBytes)} · move {humanBytes(trashBytes)} to Trash · {count} items.
      </p>
      <div className="flex gap-3 mt-6">
        <button
          onClick={onConfirm}
          className="bg-indigo-600 text-white font-bold px-5 py-3 rounded-xl"
        >
          Clean now
        </button>
        <button onClick={onBack} className="px-5 py-3 rounded-xl border border-slate-300">
          Back
        </button>
      </div>
    </div>
  )
}
