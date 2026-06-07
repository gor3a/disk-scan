import type { ItemDTO } from '../lib/protocol'
import { humanBytes } from '../lib/format'
import { Check } from './Check'

export function ItemRow({
  item,
  checked,
  onToggle,
  onExclude,
}: {
  item: ItemDTO
  checked: boolean
  onToggle: (id: string) => void
  onExclude: (item: ItemDTO) => void
}) {
  const locked = !item.selectable
  return (
    <div
      onClick={() => !locked && onToggle(item.id)}
      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
        locked ? 'cursor-default' : 'cursor-pointer hover:bg-paper'
      }`}
    >
      <Check
        state={locked ? 'locked' : checked ? 'on' : 'off'}
        onClick={locked ? undefined : () => onToggle(item.id)}
      />
      <span className={`truncate text-[13.5px] ${locked ? 'text-ink-soft' : 'text-ink'}`}>
        {item.label}
      </span>
      {item.path && (
        <span className="ml-auto flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onExclude(item)
            }}
            title="Exclude from scans"
            className="rounded-md px-1.5 text-ink-soft hover:text-ink"
          >
            🚫
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              window.dscan.reveal(item.path)
            }}
            title="Reveal in Finder"
            className="rounded-md px-1.5 text-ink-soft hover:text-ink"
          >
            ⤢
          </button>
        </span>
      )}
      <span
        className={`shrink-0 font-mono text-[12.5px] tnum text-ink-soft ${item.path ? '' : 'ml-auto'}`}
      >
        {humanBytes(item.bytes)}
      </span>
    </div>
  )
}
