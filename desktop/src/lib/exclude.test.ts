import { describe, it, expect } from 'vitest'
import { isExcluded, excludeTargetFor } from './exclude'
import type { ItemDTO } from './protocol'

const base: ItemDTO = {
  id: '',
  path: '',
  label: 'x',
  bytes: 1,
  category: 'Caches',
  tier: 'SAFE',
  method: 'remove',
  source: 'catalog',
  selectable: true,
}

describe('isExcluded', () => {
  it('matches exact and descendants, not sibling prefixes', () => {
    const ex = ['/a/b']
    expect(isExcluded('/a/b', ex)).toBe(true)
    expect(isExcluded('/a/b/c', ex)).toBe(true)
    expect(isExcluded('/a/bc', ex)).toBe(false)
    expect(isExcluded('/a', [])).toBe(false)
  })
})

describe('excludeTargetFor', () => {
  it('uses the project dir for project items, the path otherwise', () => {
    expect(
      excludeTargetFor({ ...base, path: '/u/dev/app/node_modules', kind: 'node_modules' }),
    ).toBe('/u/dev/app')
    expect(excludeTargetFor({ ...base, path: '/u/.npm' })).toBe('/u/.npm')
  })
})
