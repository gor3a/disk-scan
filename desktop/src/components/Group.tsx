import type { ItemDTO, Tier } from '../lib/protocol'
import { ItemRow } from './ItemRow'

const LABEL: Record<Tier, string> = {
  SAFE: 'Caches & build files — deleted, regenerates',
  REVIEW: 'Your files — moved to Trash, recoverable',
  KEEP: 'Protected — never deleted',
}

export function Group({
  tier,
  items,
  selection,
  onToggle,
}: {
  tier: Tier
  items: ItemDTO[]
  selection: Set<string>
  onToggle: (id: string) => void
}) {
  const rows = items.filter((i) => i.tier === tier)
  if (rows.length === 0) return null
  return (
    <section className="px-5">
      <h3 className="text-xs font-bold tracking-wide text-slate-500 mt-3 mb-1">
        {tier} · {LABEL[tier]}
      </h3>
      {rows.map((i) => (
        <ItemRow key={i.id} item={i} checked={selection.has(i.id)} onToggle={onToggle} />
      ))}
    </section>
  )
}
