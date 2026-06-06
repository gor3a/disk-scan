import type { ItemDTO } from '../lib/protocol'
import { humanBytes } from '../lib/format'

export function ItemRow({
  item,
  checked,
  onToggle,
}: {
  item: ItemDTO
  checked: boolean
  onToggle: (id: string) => void
}) {
  return (
    <label className="flex items-center gap-3 py-2 text-sm text-slate-700 border-b border-slate-50">
      <input
        type="checkbox"
        disabled={!item.selectable}
        checked={checked}
        onChange={() => onToggle(item.id)}
      />
      <span>{item.label}</span>
      <span className="ml-auto font-semibold text-slate-900">{humanBytes(item.bytes)}</span>
    </label>
  )
}
