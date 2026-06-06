import type { ItemDTO, Tier } from './protocol'

export type Selection = Set<string>
export type GroupState = 'all' | 'some' | 'none'

// defaultSelection pre-checks only regenerable SAFE caches — never tool-commands
// (brew/simctl/docker), which can be slow or destructive and must be opt-in.
// Mirrors the CLI's autoSafeSelection.
export function defaultSelection(items: ItemDTO[]): Selection {
  return new Set(
    items
      .filter((i) => i.selectable && i.tier === 'SAFE' && i.method !== 'command')
      .map((i) => i.id),
  )
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

// selectableInTier returns the items in a tier the user is allowed to select.
export function selectableInTier(items: ItemDTO[], tier: Tier): ItemDTO[] {
  return items.filter((i) => i.tier === tier && i.selectable)
}

// groupState reports whether all / some / none of a tier's selectable items are
// selected — drives the parent checkbox (checked / indeterminate / unchecked).
export function groupState(items: ItemDTO[], sel: Selection, tier: Tier): GroupState {
  const g = selectableInTier(items, tier)
  if (g.length === 0) return 'none'
  const n = g.filter((i) => sel.has(i.id)).length
  if (n === 0) return 'none'
  return n === g.length ? 'all' : 'some'
}

// toggleGroup selects every selectable item in a tier, or clears them all if
// they are already fully selected.
export function toggleGroup(sel: Selection, items: ItemDTO[], tier: Tier): Selection {
  const g = selectableInTier(items, tier)
  const allSelected = g.length > 0 && g.every((i) => sel.has(i.id))
  const next = new Set(sel)
  for (const i of g) {
    if (allSelected) next.delete(i.id)
    else next.add(i.id)
  }
  return next
}
