import type { ItemDTO } from './protocol'

export type Selection = Set<string>

export function defaultSelection(items: ItemDTO[]): Selection {
  return new Set(items.filter((i) => i.selectable && i.tier === 'SAFE').map((i) => i.id))
}

export function toggle(sel: Selection, id: string, items?: ItemDTO[]): Selection {
  // Guard: never select an unselectable item when items are provided.
  if (items) {
    const it = items.find((i) => i.id === id)
    if (it && !it.selectable) return sel
  }
  const next = new Set(sel)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

export function selectedTotal(items: ItemDTO[], sel: Selection): number {
  return items.reduce((sum, i) => (sel.has(i.id) ? sum + i.bytes : sum), 0)
}

export function selectedIds(sel: Selection): string[] {
  return [...sel].sort()
}
