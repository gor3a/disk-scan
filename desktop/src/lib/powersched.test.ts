import { describe, it, expect } from 'vitest'
import {
  toArgv,
  nextFire,
  formatCountdown,
  describeWhen,
  sortedJobs,
  visibleJobs,
  type Job,
} from './powersched'

describe('toArgv', () => {
  it('relative shutdown', () => {
    expect(toArgv({ action: 'shutdown', time: { kind: 'relative', value: '2h' } })).toEqual([
      'shutdown',
      'in',
      '2h',
    ])
  })

  it('absolute clock + datetime tokens', () => {
    expect(toArgv({ action: 'sleep', time: { kind: 'at', value: '23:00' } })).toEqual([
      'sleep',
      'at',
      '23:00',
    ])
    expect(toArgv({ action: 'restart', time: { kind: 'at', value: '2026-06-12 01:30' } })).toEqual([
      'restart',
      'at',
      '2026-06-12',
      '01:30',
    ])
  })

  it('recurring daily / weekday / custom', () => {
    expect(
      toArgv({ action: 'shutdown', time: { kind: 'recurring', days: 'daily', time: '01:00' } }),
    ).toEqual(['shutdown', 'every', 'day', 'at', '01:00'])
    expect(
      toArgv({ action: 'shutdown', time: { kind: 'recurring', days: 'weekday', time: '09:30' } }),
    ).toEqual(['shutdown', 'every', 'weekday', 'at', '09:30'])
    expect(
      toArgv({ action: 'shutdown', time: { kind: 'recurring', days: 'Mon,Wed', time: '22:15' } }),
    ).toEqual(['shutdown', 'every', 'Mon,Wed', 'at', '22:15'])
  })

  it('flags: force, wake-at, power-on, grace', () => {
    expect(
      toArgv({
        action: 'shutdown',
        time: { kind: 'relative', value: '1h' },
        force: true,
        wakeAt: '07:00',
        grace: 60,
      }),
    ).toEqual(['shutdown', 'in', '1h', '--force', '--wake-at', '07:00', '--grace', '60'])
    expect(toArgv({ action: 'wake', time: { kind: 'at', value: '07:00' }, powerOn: true })).toEqual([
      'wake',
      'at',
      '07:00',
      '--power-on',
    ])
  })

  it('rejects invalid / zero-total / impossible dates / bad grace', () => {
    expect(() => toArgv({ action: 'shutdown', time: { kind: 'relative', value: 'banana' } })).toThrow()
    expect(() => toArgv({ action: 'shutdown', time: { kind: 'relative', value: '0s' } })).toThrow()
    expect(() => toArgv({ action: 'shutdown', time: { kind: 'at', value: '99:99' } })).toThrow()
    expect(() => toArgv({ action: 'shutdown', time: { kind: 'at', value: '2026-13-01 01:00' } })).toThrow()
    expect(() =>
      toArgv({ action: 'shutdown', time: { kind: 'recurring', days: 'Funday', time: '01:00' } }),
    ).toThrow()
    expect(() =>
      toArgv({ action: 'shutdown', time: { kind: 'relative', value: '2h' }, grace: -5 }),
    ).toThrow()
    // @ts-expect-error invalid action at runtime
    expect(() => toArgv({ action: 'destroy', time: { kind: 'relative', value: '2h' } })).toThrow()
  })
})

describe('nextFire / formatCountdown / describeWhen', () => {
  it('oneshot returns the epoch', () => {
    expect(nextFire(oneshot('1700000000'), 1699999999)).toBe(1700000000)
  })
  it('recurring daily picks next HH:MM in the future', () => {
    const now = Math.floor(new Date(2024, 0, 1, 0, 0, 0).getTime() / 1000)
    const f = nextFire(recurring('09:00:daily'), now)!
    expect(new Date(f * 1000).getHours()).toBe(9)
    expect(f).toBeGreaterThan(now)
  })
  it('recurring weekday set picks an allowed day', () => {
    const now = Math.floor(new Date(2024, 0, 1, 12, 0, 0).getTime() / 1000) // Mon noon
    const f = nextFire(recurring('08:00:Wed'), now)!
    expect(new Date(f * 1000).getDay()).toBe(3)
  })
  it('formatCountdown', () => {
    const now = 1_000_000
    expect(formatCountdown(now + 3600 + 720, now)).toBe('in 1h 12m')
    expect(formatCountdown(now + 45, now)).toBe('in 45s')
    expect(formatCountdown(now - 5, now)).toBe('now')
    expect(formatCountdown(null, now)).toBe('—')
  })
  it('describeWhen', () => {
    expect(describeWhen(recurring('01:00:daily'))).toBe('every day at 01:00')
    expect(describeWhen(oneshot('1700000000'))).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
  })
})

describe('sortedJobs / visibleJobs', () => {
  it('orders one-shots by epoch', () => {
    const a = oneshot('300', 'a')
    const b = oneshot('100', 'b')
    const c = oneshot('200', 'c')
    expect(sortedJobs([a, b, c], 0).map((j) => j.id)).toEqual(['b', 'c', 'a'])
  })
  it('hides one-shots past fire+grace, keeps recurring', () => {
    const now = 1000
    const stale = { ...oneshot(String(now - 200), 'stale'), grace: 60 }
    const live = oneshot(String(now + 500), 'live')
    expect(visibleJobs([stale, live], now).map((j) => j.id)).toEqual(['live'])
    expect(visibleJobs([recurring('01:00:daily')], 9_999_999)).toHaveLength(1)
  })
})

function oneshot(when: string, id = 'x'): Job {
  return { id, action: 'shutdown', force: false, kind: 'oneshot', when, wakeAt: null, grace: 120, spec: 'at 00:00' }
}
function recurring(when: string): Job {
  return {
    id: 'r',
    action: 'shutdown',
    force: false,
    kind: 'recurring',
    when,
    wakeAt: null,
    grace: 120,
    spec: when.endsWith('daily') ? 'every day at 01:00' : 'every Wed at 08:00',
  }
}
