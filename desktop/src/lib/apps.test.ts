import { describe, it, expect } from 'vitest'
import { archBadge, sortApps, uninstallTotal, matchesAppName } from './apps'
import type { AppDTO, Leftover } from './protocol'

const app = (over: Partial<AppDTO>): AppDTO => ({
  id: over.path ?? over.name ?? 'x',
  name: 'X',
  bundleId: 'com.x',
  path: '/Applications/X.app',
  bytes: 0,
  arch: 'universal',
  ...over,
})

describe('archBadge', () => {
  it('flags intel and labels each arch', () => {
    expect(archBadge('intel').flagged).toBe(true)
    expect(archBadge('intel').label).toBe('Intel')
    expect(archBadge('appleSilicon').label).toBe('Apple Silicon')
    expect(archBadge('universal').flagged).toBe(false)
    expect(archBadge('unknown').label).toBe('Unknown')
  })
})

describe('sortApps', () => {
  it('puts Intel-only first, then by size desc', () => {
    const apps = [
      app({ name: 'Native', arch: 'appleSilicon', bytes: 900 }),
      app({ name: 'SmallIntel', arch: 'intel', bytes: 100 }),
      app({ name: 'BigIntel', arch: 'intel', bytes: 500 }),
      app({ name: 'Uni', arch: 'universal', bytes: 800 }),
    ]
    const out = sortApps(apps).map((a) => a.name)
    expect(out).toEqual(['BigIntel', 'SmallIntel', 'Native', 'Uni'])
  })
})

describe('uninstallTotal', () => {
  it('sums the app size plus selected leftovers', () => {
    const a = app({ bytes: 1000 })
    const left: Leftover[] = [
      { path: '/l1', label: 'l1', bytes: 200 },
      { path: '/l2', label: 'l2', bytes: 50 },
    ]
    const selected = new Set(['/l1'])
    expect(uninstallTotal(a, left, selected)).toBe(1200)
  })
})

describe('matchesAppName', () => {
  it('is case-insensitive and tolerant of suffixes', () => {
    expect(matchesAppName('slack', 'Slack')).toBe(true)
    expect(matchesAppName('Microsoft Word', 'Microsoft Word')).toBe(true)
    expect(matchesAppName('Foo', 'Totally Unrelated')).toBe(false)
  })
})
