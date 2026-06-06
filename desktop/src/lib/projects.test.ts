import { describe, it, expect } from 'vitest'
import { staleSelection, projectDisplay, STALE_DAYS } from './projects'
import type { ItemDTO } from './protocol'

const DAY = 86400
function proj(id: string, agoDays: number, nowSecs: number): ItemDTO {
  return {
    id,
    path: id,
    label: id,
    bytes: 100,
    category: 'Projects',
    tier: 'SAFE',
    method: 'remove',
    source: 'heuristic',
    selectable: true,
    modified: nowSecs - agoDays * DAY,
  }
}

describe('staleSelection', () => {
  it('selects projects older than STALE_DAYS, leaves recent', () => {
    const now = 1_700_000_000
    const items = [proj('old', 200, now), proj('recent', 2, now), proj('edge', STALE_DAYS + 1, now)]
    const sel = staleSelection(items, now)
    expect(sel.has('old')).toBe(true)
    expect(sel.has('edge')).toBe(true)
    expect(sel.has('recent')).toBe(false)
  })
})

describe('projectDisplay', () => {
  it('derives name + parent folder from the node_modules path', () => {
    const d = projectDisplay('/Users/me/dev/clients/work-app/node_modules')
    expect(d.name).toBe('work-app')
    expect(d.parent).toBe('/Users/me/dev/clients')
  })
})
