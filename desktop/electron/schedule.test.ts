import { describe, it, expect, afterEach } from 'vitest'
import { plistContent, systemdUnits, applySchedule } from './schedule'
import { mkdtempSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

afterEach(() => {
  delete process.env.DSCAN_SCHEDULE_DIR
})

describe('schedule', () => {
  it('plist carries bin path, notify, calendar, clean flag', () => {
    const p = plistContent('/x/dscan', false, 'daily')
    expect(p).toContain('/x/dscan')
    expect(p).toContain('<string>notify</string>')
    expect(p).toContain('<key>Hour</key><integer>11</integer>')
    expect(p).not.toContain('--clean')
    const w = plistContent('/x/dscan', true, 'weekly')
    expect(w).toContain('--clean')
    expect(w).toContain('<key>Weekday</key>')
  })
  it('systemd units carry ExecStart + OnCalendar', () => {
    const u = systemdUnits('/x/dscan', true, 'weekly')
    expect(u.service).toContain('ExecStart=/x/dscan notify --clean')
    expect(u.timer).toContain('OnCalendar=Mon *-*-* 11:00:00')
  })
  it('applySchedule writes then removes the unit under DSCAN_SCHEDULE_DIR', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sched-'))
    process.env.DSCAN_SCHEDULE_DIR = dir
    expect(applySchedule('daily', false, '/x/dscan', 'darwin').ok).toBe(true)
    expect(existsSync(join(dir, 'com.gor3a.dscan.plist'))).toBe(true)
    expect(applySchedule('off', false, '/x/dscan', 'darwin').ok).toBe(true)
    expect(existsSync(join(dir, 'com.gor3a.dscan.plist'))).toBe(false)
  })
})
