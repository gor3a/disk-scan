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

  it('startClean shows the cleaning phase, cleanResult moves to done', () => {
    let s = reduce(initialState(), { type: 'startClean' })
    expect(s.phase).toBe('cleaning')
    s = reduce(s, { type: 'event', event: { event: 'cleanResult', freed: 5, trashed: 1 } })
    expect(s.phase).toBe('done')
    expect(s.result).toEqual({ freed: 5, trashed: 1, errors: [] })
  })

  it('coerces omitted (zero) numeric fields to 0 — no NaN', () => {
    // cleanResult with only freed present (trashed omitted by Go omitempty)
    const s = reduce(initialState(), { type: 'event', event: { event: 'cleanResult', freed: 7 } })
    expect(s.result).toEqual({ freed: 7, trashed: 0, errors: [] })
    expect(Number.isNaN(s.result!.freed + s.result!.trashed)).toBe(false)
  })
})
