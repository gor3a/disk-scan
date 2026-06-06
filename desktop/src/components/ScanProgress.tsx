export function ScanProgress({
  scanned,
  onCancel,
}: {
  scanned: number
  onCancel: () => void
}) {
  return (
    <div className="p-8 text-center">
      <p className="text-slate-600">Scanning… {scanned} items found</p>
      <div className="h-2 bg-indigo-100 rounded mt-4 overflow-hidden">
        <div className="h-full bg-indigo-600 animate-pulse w-2/3" />
      </div>
      <button onClick={onCancel} className="mt-4 text-sm text-slate-500 underline">
        Cancel
      </button>
    </div>
  )
}
