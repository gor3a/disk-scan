import { describe, it, expect } from 'vitest'
import { initialState, reduce, activeTab } from './state'
import type { ItemDTO } from './lib/protocol'

const item = (id: string): ItemDTO => ({
  id,
  path: id,
  label: id,
  bytes: 10,
  category: 'Caches',
  tier: 'SAFE',
  method: 'remove',
  source: 'catalog',
  selectable: true,
})

describe('state reducer', () => {
  it('renders items while scanning (no scanDone gate)', () => {
    let s = reduce(initialState(), { type: 'startScan', tab: 'cleanup' })
    expect(activeTab(s).scanning).toBe(true)
    s = reduce(s, { type: 'event', event: { event: 'item', item: item('a') } })
    expect(activeTab(s).items).toHaveLength(1)
    s = reduce(s, { type: 'event', event: { event: 'progress', scanned: 1, phase: 'caches', bytes: 10 } })
    expect(activeTab(s).phase).toBe('caches')
    s = reduce(s, { type: 'event', event: { event: 'scanDone', reclaimable: 10 } })
    expect(activeTab(s).scanning).toBe(false)
  })

  it('routes events to the tab that started the scan', () => {
    let s = reduce(initialState(), { type: 'setTab', tab: 'projects' })
    s = reduce(s, { type: 'startScan', tab: 'projects' })
    s = reduce(s, { type: 'event', event: { event: 'item', item: item('p') } })
    expect(s.projects.items).toHaveLength(1)
    expect(s.cleanup.items).toHaveLength(0)
  })

  it('stores settings and opens/closes modals', () => {
    let s = reduce(initialState(), { type: 'setSettings', settings: { staleDays: 90 } })
    expect(s.settings.staleDays).toBe(90)
    s = reduce(s, { type: 'openModal', modal: 'about' })
    expect(s.modal).toBe('about')
    s = reduce(s, { type: 'openModal', modal: null })
    expect(s.modal).toBeNull()
  })

  it('mid-scan clean removes cleaned ids and keeps results visible', () => {
    let s = reduce(initialState(), { type: 'startScan', tab: 'cleanup' })
    s = reduce(s, { type: 'event', event: { event: 'item', item: item('a') } })
    s = reduce(s, { type: 'event', event: { event: 'item', item: item('b') } })
    s = reduce(s, { type: 'startClean', ids: ['a'] })
    s = reduce(s, { type: 'event', event: { event: 'cleanResult', freed: 10, trashed: 0 } })
    expect(activeTab(s).items.map((i) => i.id)).toEqual(['b'])
    expect(activeTab(s).scanning).toBe(true)
    expect(s.result).toEqual({ freed: 10, trashed: 0, errors: [] })
  })
})

describe('apps tab', () => {
  it('records host arch and accumulates app events', () => {
    let s = initialState()
    s = reduce(s, { type: 'startScan', tab: 'apps' })
    s = reduce(s, { type: 'event', event: { event: 'host', host: { arch: 'appleSilicon' } } })
    expect(s.apps.hostAppleSilicon).toBe(true)
    s = reduce(s, {
      type: 'event',
      event: {
        event: 'app',
        app: { id: '/A.app', name: 'A', bundleId: 'com.a', path: '/A.app', bytes: 10, arch: 'intel' },
      },
    })
    s = reduce(s, {
      type: 'event',
      event: {
        event: 'app',
        app: { id: '/B.app', name: 'B', bundleId: 'com.b', path: '/B.app', bytes: 20, arch: 'universal' },
      },
    })
    expect(s.apps.apps.map((a) => a.name)).toEqual(['A', 'B'])
    s = reduce(s, { type: 'event', event: { event: 'scanDone' } })
    expect(s.apps.scanning).toBe(false)
  })

  it('stores leftovers keyed for the uninstall modal', () => {
    let s = initialState()
    s = reduce(s, { type: 'startScan', tab: 'apps' })
    s = reduce(s, {
      type: 'event',
      event: { event: 'leftovers', path: '/A.app', leftovers: [{ path: '/l', label: 'l', bytes: 5 }] },
    })
    expect(s.apps.leftovers).toEqual([{ path: '/l', label: 'l', bytes: 5 }])
  })

  it('removes the uninstalled app on cleanResult', () => {
    let s = initialState()
    s = reduce(s, { type: 'setTab', tab: 'apps' })
    s.apps.apps = [
      { id: '/A.app', name: 'A', bundleId: 'com.a', path: '/A.app', bytes: 10, arch: 'intel' },
    ]
    s = reduce(s, { type: 'startClean', ids: ['/A.app'] })
    s = reduce(s, { type: 'event', event: { event: 'cleanResult', trashed: 10, errors: [] } })
    expect(s.apps.apps.length).toBe(0)
  })
})
