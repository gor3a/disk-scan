import { Ban, ExternalLink } from 'lucide-react'
import type { ItemDTO } from '../lib/protocol'
import { humanBytes } from '../lib/format'
import { projectDisplay, STALE_DAYS } from '../lib/projects'
import { Check } from './Check'

function ago(modified: number, nowSecs: number): { text: string; stale: boolean } {
  const days = Math.max(0, Math.floor((nowSecs - modified) / 86400))
  const stale = days > STALE_DAYS
  if (days >= 365) return { text: `${Math.floor(days / 365)}y ago`, stale }
  if (days >= 30) return { text: `${Math.floor(days / 30)}mo ago`, stale }
  if (days >= 1) return { text: `${days}d ago`, stale }
  return { text: 'today', stale }
}

export function ProjectRow({
  item,
  checked,
  nowSecs,
  onToggle,
  onExclude,
}: {
  item: ItemDTO
  checked: boolean
  nowSecs: number
  onToggle: (id: string) => void
  onExclude: (item: ItemDTO) => void
}) {
  const { name, parent } = projectDisplay(item.path)
  const used = ago(item.modified ?? nowSecs, nowSecs)
  return (
    <div
      onClick={() => onToggle(item.id)}
      className="group flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-paper"
    >
      <Check state={checked ? 'on' : 'off'} onClick={() => onToggle(item.id)} />
      <span className="min-w-0">
        <span className="text-[13.5px] font-semibold text-ink">{name}</span>{' '}
        <span className="font-mono text-[11px] text-ink-soft">{parent}</span>
      </span>
      <span
        className={`ml-auto shrink-0 rounded-md px-2 py-0.5 text-[11px] ${
          used.stale ? 'bg-review-bg text-review' : 'bg-safe-bg text-safe'
        }`}
      >
        {used.text}
      </span>
      <span className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onExclude(item)
          }}
          title="Exclude from scans"
          aria-label="Exclude from scans"
          className="rounded-md px-1 text-ink-soft hover:text-ink"
        >
          <Ban size={15} strokeWidth={1.75} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            window.dscan.reveal(item.path)
          }}
          title="Reveal in Finder"
          aria-label="Reveal in Finder"
          className="rounded-md px-1 text-ink-soft hover:text-ink"
        >
          <ExternalLink size={15} strokeWidth={1.75} />
        </button>
      </span>
      <span className="w-16 shrink-0 text-right font-mono text-[12.5px] tnum text-ink-soft">
        {humanBytes(item.bytes)}
      </span>
    </div>
  )
}
