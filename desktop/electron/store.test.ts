import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Store } from './store'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'dscan-store-'))
})

describe('Store', () => {
  it('returns defaults when files are missing', () => {
    const s = new Store(dir)
    expect(s.getSettings()).toEqual({ staleDays: 30 })
    expect(s.getHistory()).toEqual([])
  })
  it('merges partial settings and persists', () => {
    const s = new Store(dir)
    s.setSettings({ staleDays: 90 })
    s.setSettings({ lastProjectRoot: '/x' })
    expect(new Store(dir).getSettings()).toEqual({ staleDays: 90, lastProjectRoot: '/x' })
  })
  it('appends history entries', () => {
    const s = new Store(dir)
    s.addHistory({ at: 1, freed: 10, trashed: 2, items: 3, tab: 'cleanup' })
    expect(new Store(dir).getHistory()).toHaveLength(1)
  })
})
