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

describe('stopScan', () => {
  // stopScan acts on the VISIBLE tab (the RescanButton only stops the tab you're
  // viewing), so each case navigates to its tab first — mirroring real usage.
  it('clears scanning on the visible tab (cleanup/map/apps)', () => {
    let s = reduce(initialState(), { type: 'startScan', tab: 'cleanup' })
    expect(activeTab(s).scanning).toBe(true)
    s = reduce(s, { type: 'stopScan' })
    expect(activeTab(s).scanning).toBe(false)

    s = reduce(s, { type: 'setTab', tab: 'map' })
    s = reduce(s, { type: 'startScan', tab: 'map' })
    expect(s.map.scanning).toBe(true)
    s = reduce(s, { type: 'stopScan' })
    expect(s.map.scanning).toBe(false)

    s = reduce(s, { type: 'setTab', tab: 'apps' })
    s = reduce(s, { type: 'startScan', tab: 'apps' })
    expect(s.apps.scanning).toBe(true)
    s = reduce(s, { type: 'stopScan' })
    expect(s.apps.scanning).toBe(false)
  })
})

describe('state reducer', () => {
  it('renders items while scanning (no scanDone gate)', () => {
    let s = reduce(initialState(), { type: 'startScan', tab: 'cleanup' })
    expect(activeTab(s).scanning).toBe(true)
    s = reduce(s, { type: 'event', event: { event: 'item', tab: 'cleanup', item: item('a') } })
    expect(activeTab(s).items).toHaveLength(1)
    s = reduce(s, {
      type: 'event',
      event: { event: 'progress', tab: 'cleanup', scanned: 1, phase: 'caches', bytes: 10 },
    })
    expect(activeTab(s).phase).toBe('caches')
    s = reduce(s, { type: 'event', event: { event: 'scanDone', tab: 'cleanup', reclaimable: 10 } })
    expect(activeTab(s).scanning).toBe(false)
  })

  it('routes events by event.tab, not the visible tab', () => {
    // Visible tab is cleanup; a projects event must still land in projects.
    let s = reduce(initialState(), { type: 'startScan', tab: 'projects' })
    expect(s.tab).toBe('cleanup') // startScan must NOT change the visible tab
    s = reduce(s, { type: 'event', event: { event: 'item', tab: 'projects', item: item('p') } })
    expect(s.projects.items).toHaveLength(1)
    expect(s.cleanup.items).toHaveLength(0)
  })

  it('runs two scans concurrently without cross-contamination or focus stealing', () => {
    // Reproduces the startup race: cleanup scan in progress, then the mount apps
    // probe starts. Apps must NOT steal the visible tab, and interleaved events
    // must land in their own slices — cleanup keeps populating.
    let s = reduce(initialState(), { type: 'startScan', tab: 'cleanup' })
    s = reduce(s, { type: 'startScan', tab: 'apps' })
    expect(s.tab).toBe('cleanup') // apps scan did not switch focus
    expect(s.cleanup.scanning).toBe(true)
    expect(s.apps.scanning).toBe(true)

    // Interleave events from both scans.
    s = reduce(s, { type: 'event', event: { event: 'item', tab: 'cleanup', item: item('c1') } })
    s = reduce(s, {
      type: 'event',
      event: {
        event: 'app',
        tab: 'apps',
        app: { id: '/A.app', name: 'A', bundleId: 'com.a', path: '/A.app', bytes: 10, arch: 'intel' },
      },
    })
    s = reduce(s, { type: 'event', event: { event: 'item', tab: 'cleanup', item: item('c2') } })

    expect(s.cleanup.items.map((i) => i.id)).toEqual(['c1', 'c2'])
    expect(s.apps.apps.map((a) => a.name)).toEqual(['A'])

    // Apps finishing must not clear cleanup's scanning flag.
    s = reduce(s, { type: 'event', event: { event: 'scanDone', tab: 'apps' } })
    expect(s.apps.scanning).toBe(false)
    expect(s.cleanup.scanning).toBe(true)
    s = reduce(s, { type: 'event', event: { event: 'scanDone', tab: 'cleanup', reclaimable: 20 } })
    expect(s.cleanup.scanning).toBe(false)
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
    s = reduce(s, { type: 'event', event: { event: 'item', tab: 'cleanup', item: item('a') } })
    s = reduce(s, { type: 'event', event: { event: 'item', tab: 'cleanup', item: item('b') } })
    s = reduce(s, { type: 'startClean', ids: ['a'] })
    s = reduce(s, { type: 'event', event: { event: 'cleanResult', tab: 'cleanup', freed: 10, trashed: 0 } })
    expect(activeTab(s).items.map((i) => i.id)).toEqual(['b'])
    expect(activeTab(s).scanning).toBe(true)
    expect(s.result).toEqual({ freed: 10, trashed: 0, errors: [] })
  })
})

describe('apps tab', () => {
  it('records host arch and accumulates app events', () => {
    let s = initialState()
    s = reduce(s, { type: 'startScan', tab: 'apps' })
    s = reduce(s, { type: 'event', event: { event: 'host', tab: 'apps', host: { arch: 'appleSilicon' } } })
    expect(s.apps.hostAppleSilicon).toBe(true)
    s = reduce(s, {
      type: 'event',
      event: {
        event: 'app',
        tab: 'apps',
        app: { id: '/A.app', name: 'A', bundleId: 'com.a', path: '/A.app', bytes: 10, arch: 'intel' },
      },
    })
    s = reduce(s, {
      type: 'event',
      event: {
        event: 'app',
        tab: 'apps',
        app: { id: '/B.app', name: 'B', bundleId: 'com.b', path: '/B.app', bytes: 20, arch: 'universal' },
      },
    })
    expect(s.apps.apps.map((a) => a.name)).toEqual(['A', 'B'])
    s = reduce(s, { type: 'event', event: { event: 'scanDone', tab: 'apps' } })
    expect(s.apps.scanning).toBe(false)
  })

  it('stores leftovers keyed for the uninstall modal', () => {
    let s = initialState()
    s = reduce(s, { type: 'startScan', tab: 'apps' })
    s = reduce(s, {
      type: 'event',
      event: { event: 'leftovers', tab: 'apps', path: '/A.app', leftovers: [{ path: '/l', label: 'l', bytes: 5 }] },
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
    s = reduce(s, { type: 'event', event: { event: 'cleanResult', tab: 'apps', trashed: 10, errors: [] } })
    expect(s.apps.apps.length).toBe(0)
  })
})
