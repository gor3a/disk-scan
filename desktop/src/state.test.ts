import { describe, it, expect } from 'vitest'
import { initialState, reduce } from './state'

describe('state reducer', () => {
  it('moves scanning → list and collects items, seeding SAFE selection', () => {
    let s = initialState()
    expect(s.phase).toBe('idle')
    s = reduce(s, { type: 'startScan' })
    expect(s.phase).toBe('scanning')
    s = reduce(s, { type: 'event', event: { event: 'disk', disk: { used: 1, free: 2, total: 3 } } })
    s = reduce(s, {
      type: 'event',
      event: {
        event: 'item',
        item: { id: 'a', path: '/a', label: 'a', bytes: 10, category: 'Caches', tier: 'SAFE', method: 'remove', source: 'catalog', selectable: true },
      },
    })
    s = reduce(s, { type: 'event', event: { event: 'scanDone', reclaimable: 10 } })
    expect(s.phase).toBe('list')
    expect(s.items).toHaveLength(1)
    expect([...s.selection]).toEqual(['a'])
    expect(s.disk?.total).toBe(3)
  })

  it('upserts items by id — duplicate item events never double rows', () => {
    let s = reduce(initialState(), { type: 'startScan' })
    const item = { id: 'a', path: '/a', label: 'a', bytes: 10, category: 'Caches', tier: 'SAFE' as const, method: 'remove' as const, source: 'catalog' as const, selectable: true }
    s = reduce(s, { type: 'event', event: { event: 'item', item } })
    s = reduce(s, { type: 'event', event: { event: 'item', item: { ...item, bytes: 20 } } })
    expect(s.items).toHaveLength(1)
    expect(s.items[0].bytes).toBe(20)
  })

  it('cleanResult moves to done', () => {
    let s = reduce(initialState(), { type: 'startScan' })
    s = reduce(s, { type: 'event', event: { event: 'cleanResult', freed: 5, trashed: 1 } })
    expect(s.phase).toBe('done')
    expect(s.result).toEqual({ freed: 5, trashed: 1, errors: [] })
  })
})
