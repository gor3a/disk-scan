import { useState } from 'react'
import type { ItemDTO, Tier } from '../lib/protocol'
import { ItemRow } from './ItemRow'
import { Check, type CheckState } from './Check'
import { TIER } from '../lib/tiers'
import { groupState } from '../lib/selection'
import { sortItems } from '../lib/sortItems'
import { humanBytes } from '../lib/format'

export function Group({
  tier,
  items,
  selection,
  onToggle,
  onToggleGroup,
  onExclude,
}: {
  tier: Tier
  items: ItemDTO[]
  selection: Set<string>
  onToggle: (id: string) => void
  onToggleGroup: (tier: Tier) => void
  onExclude: (item: ItemDTO) => void
}) {
  const rows = sortItems(
    items.filter((i) => i.tier === tier),
    'size',
  )
  const [open, setOpen] = useState(tier !== 'KEEP')
  if (rows.length === 0) return null

  const t = TIER[tier]
  const total = rows.reduce((n, i) => n + i.bytes, 0)
  const gs = groupState(items, selection, tier)
  const selectable = tier !== 'KEEP'
  const state: CheckState = !selectable
    ? 'locked'
    : gs === 'all'
      ? 'on'
      : gs === 'some'
        ? 'mixed'
        : 'off'

  return (
    <section className="rise mx-5 mb-3 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <div className="flex items-center gap-3 px-4 py-3">
        <Check state={state} onClick={selectable ? () => onToggleGroup(tier) : undefined} />
        <button onClick={() => setOpen((o) => !o)} className="flex min-w-0 items-center gap-3 text-left">
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider ${t.pill}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
            {tier}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold leading-tight text-ink">
              {t.title}
            </span>
            <span className="block truncate text-[11.5px] leading-tight text-ink-soft">{t.sub}</span>
          </span>
        </button>
        <span className="ml-auto flex shrink-0 items-center gap-3 text-ink-soft">
          <span className="font-mono text-[12.5px] tnum">{humanBytes(total)}</span>
          <span className={`text-lg leading-none transition-transform ${open ? 'rotate-90' : ''}`}>
            ›
          </span>
        </span>
      </div>
      {open && (
        <div className="px-2 pb-2">
          {rows.map((i) => (
            <ItemRow
              key={i.id}
              item={i}
              checked={selection.has(i.id)}
              onToggle={onToggle}
              onExclude={onExclude}
            />
          ))}
        </div>
      )}
    </section>
  )
}
