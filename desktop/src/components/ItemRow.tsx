import type { ItemDTO } from '../lib/protocol'
import { humanBytes } from '../lib/format'
import { Check } from './Check'

export function ItemRow({
  item,
  checked,
  onToggle,
}: {
  item: ItemDTO
  checked: boolean
  onToggle: (id: string) => void
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
        <button
          onClick={(e) => {
            e.stopPropagation()
            window.dscan.reveal(item.path)
          }}
          title="Reveal in Finder"
          className="ml-auto shrink-0 rounded-md px-1.5 text-ink-soft opacity-0 transition-opacity hover:text-ink group-hover:opacity-100"
        >
          ⤢
        </button>
      )}
      <span
        className={`shrink-0 font-mono text-[12.5px] tnum text-ink-soft ${item.path ? '' : 'ml-auto'}`}
      >
        {humanBytes(item.bytes)}
      </span>
    </div>
  )
}
