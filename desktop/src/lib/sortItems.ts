import type { ItemDTO } from './protocol'

export type SortBy = 'size' | 'oldest' | 'name'

// sortItems returns a new array sorted by the given key. 'size' is largest-first,
// 'oldest' is least-recently-used first (projects), 'name' is A→Z by label.
export function sortItems(items: ItemDTO[], by: SortBy): ItemDTO[] {
  const out = [...items]
  switch (by) {
    case 'size':
      out.sort((a, b) => b.bytes - a.bytes)
      break
    case 'oldest':
      out.sort((a, b) => (a.modified ?? Infinity) - (b.modified ?? Infinity))
      break
    case 'name':
      out.sort((a, b) => a.label.localeCompare(b.label))
      break
  }
  return out
}
