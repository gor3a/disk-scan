import { describe, it, expect } from 'vitest'
import { updateBanner } from './update'

describe('updateBanner', () => {
  it('Linux: downloaded → install action', () => {
    const b = updateBanner({ state: 'downloaded', version: '0.6.0' }, 'linux')
    expect(b.show).toBe(true)
    expect(b.action).toBe('install')
  })
  it('downloading → percent text, no action', () => {
    const b = updateBanner({ state: 'downloading', percent: 42.6 }, 'linux')
    expect(b.show).toBe(true)
    expect(b.text).toContain('43%')
    expect(b.action).toBeUndefined()
  })
  it('macOS: available → download action', () => {
    const b = updateBanner({ state: 'available', version: '0.6.0' }, 'darwin')
    expect(b.show).toBe(true)
    expect(b.action).toBe('download')
    expect(b.text).toContain('0.6.0')
  })
  it('Linux: available → hidden (auto-download follows)', () => {
    expect(updateBanner({ state: 'available', version: '0.6.0' }, 'linux').show).toBe(false)
  })
  it('none/checking/error → hidden', () => {
    expect(updateBanner({ state: 'none' }, 'linux').show).toBe(false)
    expect(updateBanner({ state: 'checking' }, 'darwin').show).toBe(false)
    expect(updateBanner({ state: 'error' }, 'linux').show).toBe(false)
  })
})
