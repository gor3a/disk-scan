import { describe, it, expect } from 'vitest'
import { defaultSelection, toggle, selectedTotal, selectedIds } from './selection'
import type { ItemDTO } from './protocol'

const items: ItemDTO[] = [
  { id: 'a', path: '/a', label: 'a', bytes: 100, category: 'Caches', tier: 'SAFE', method: 'remove', source: 'catalog', selectable: true },
  { id: 'b', path: '/b', label: 'b', bytes: 50, category: 'Caches', tier: 'REVIEW', method: 'trash', source: 'heuristic', selectable: true },
  { id: 'c', path: '/c', label: 'c', bytes: 999, category: 'AppData', tier: 'KEEP', method: 'remove', source: 'catalog', selectable: false },
]

describe('selection', () => {
  it('pre-selects only SAFE items by default', () => {
    expect([...defaultSelection(items)]).toEqual(['a'])
  })
  it('total sums only selected', () => {
    expect(selectedTotal(items, defaultSelection(items))).toBe(100)
  })
  it('toggle adds/removes a REVIEW item', () => {
    let sel = defaultSelection(items)
    sel = toggle(sel, 'b', items)
    expect(selectedTotal(items, sel)).toBe(150)
    sel = toggle(sel, 'b', items)
    expect(selectedTotal(items, sel)).toBe(100)
  })
  it('never selects a KEEP item', () => {
    const sel = toggle(defaultSelection(items), 'c', items)
    expect(sel.has('c')).toBe(false)
  })
  it('selectedIds returns a stable sorted array', () => {
    expect(selectedIds(defaultSelection(items))).toEqual(['a'])
  })
})
