import { describe, it, expect } from 'vitest'
import { sortItems } from './sortItems'
import type { ItemDTO } from './protocol'

const it1 = (id: string, bytes: number, modified?: number): ItemDTO => ({
  id,
  path: id,
  label: id,
  bytes,
  category: 'Projects',
  tier: 'SAFE',
  method: 'remove',
  source: 'heuristic',
  selectable: true,
  modified,
})

describe('sortItems', () => {
  const items = [it1('b', 100, 30), it1('a', 300, 10), it1('c', 200, 20)]

  it('sorts largest-first by size', () => {
    expect(sortItems(items, 'size').map((i) => i.id)).toEqual(['a', 'c', 'b'])
  })
  it('sorts least-recently-used first by oldest', () => {
    expect(sortItems(items, 'oldest').map((i) => i.id)).toEqual(['a', 'c', 'b'])
  })
  it('sorts A→Z by name', () => {
    expect(sortItems(items, 'name').map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })
  it('does not mutate the input', () => {
    const copy = [...items]
    sortItems(items, 'size')
    expect(items).toEqual(copy)
  })
})
