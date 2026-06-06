import { describe, it, expect } from 'vitest'
import {
  defaultSelection,
  toggle,
  selectedTotal,
  selectedIds,
  groupState,
  toggleGroup,
} from './selection'
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

  it('never auto-selects SAFE tool-commands (brew/simctl/docker)', () => {
    const withCmd: ItemDTO[] = [
      ...items,
      { id: 'cmd:brew', path: '', label: 'brew cleanup', bytes: 0, category: 'Package stores', tier: 'SAFE', method: 'command', source: 'catalog', selectable: true },
    ]
    expect([...defaultSelection(withCmd)]).toEqual(['a'])
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

  it('groupState reflects all / some / none for a tier', () => {
    const empty = new Set<string>()
    expect(groupState(items, empty, 'SAFE')).toBe('none')
    expect(groupState(items, new Set(['a']), 'SAFE')).toBe('all')
    expect(groupState(items, empty, 'REVIEW')).toBe('none')
    // KEEP has no selectable items
    expect(groupState(items, empty, 'KEEP')).toBe('none')
  })

  it('groupState is "some" when partially selected', () => {
    const more: ItemDTO[] = [
      ...items,
      { id: 'a2', path: '/a2', label: 'a2', bytes: 1, category: 'Caches', tier: 'SAFE', method: 'remove', source: 'catalog', selectable: true },
    ]
    expect(groupState(more, new Set(['a']), 'SAFE')).toBe('some')
  })

  it('toggleGroup selects all selectable in a tier, then clears them', () => {
    let sel = new Set<string>()
    sel = toggleGroup(sel, items, 'SAFE')
    expect(sel.has('a')).toBe(true)
    sel = toggleGroup(sel, items, 'SAFE')
    expect(sel.has('a')).toBe(false)
  })

  it('toggleGroup never selects KEEP items', () => {
    const sel = toggleGroup(new Set<string>(), items, 'KEEP')
    expect(sel.has('c')).toBe(false)
    expect(sel.size).toBe(0)
  })
})
