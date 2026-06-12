import { describe, it, expect, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { CommandBridge } from './ps-bridge'
import type { Elevator } from './ps-elevator'

function spawnEmitting(stdout: string, code = 0) {
  return vi.fn(() => {
    const child = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter }
    child.stdout = new EventEmitter()
    child.stderr = new EventEmitter()
    setTimeout(() => {
      if (stdout) child.stdout.emit('data', Buffer.from(stdout))
      child.emit('close', code)
    }, 0)
    return child
  })
}

const okEl = {
  runElevated: vi.fn(async () => ({ ok: true, stdout: '', stderr: '', code: 0, cancelled: false })),
} as unknown as Elevator

describe('CommandBridge.list', () => {
  it('parses a JSON array', async () => {
    const spawn = spawnEmitting(
      '[{"id":"a","action":"sleep","force":false,"kind":"oneshot","when":"1","wakeAt":null,"grace":120,"spec":"x"}]',
    )
    const jobs = await new CommandBridge('/p', okEl, spawn as never).list()
    expect(jobs).toHaveLength(1)
    expect(jobs[0].id).toBe('a')
  })
  it('returns [] on bad JSON or non-zero exit', async () => {
    expect(await new CommandBridge('/p', okEl, spawnEmitting('nope') as never).list()).toEqual([])
    expect(await new CommandBridge('/p', okEl, spawnEmitting('[]', 1) as never).list()).toEqual([])
  })
})

describe('CommandBridge mutations', () => {
  it('schedule routes a valid request through the elevator', async () => {
    const el = {
      runElevated: vi.fn(async () => ({ ok: true, stdout: '', stderr: '', code: 0, cancelled: false })),
    } as unknown as Elevator
    const r = await new CommandBridge('/p', el).schedule({
      action: 'shutdown',
      time: { kind: 'relative', value: '2h' },
    })
    expect(r.ok).toBe(true)
    expect(el.runElevated).toHaveBeenCalledWith('/p', ['shutdown', 'in', '2h'])
  })
  it('schedule returns ok:false (no elevation) on invalid input', async () => {
    const el = { runElevated: vi.fn() } as unknown as Elevator
    const r = await new CommandBridge('/p', el).schedule({
      action: 'shutdown',
      time: { kind: 'relative', value: 'banana' },
    })
    expect(r.ok).toBe(false)
    expect(el.runElevated).not.toHaveBeenCalled()
  })
  it('cancel rejects malformed ids before elevating', async () => {
    const el = { runElevated: vi.fn() } as unknown as Elevator
    const b = new CommandBridge('/p', el)
    for (const bad of ['../etc/passwd', '.', '..', '-rf', '']) expect((await b.cancel(bad)).ok).toBe(false)
    expect(el.runElevated).not.toHaveBeenCalled()
  })
  it('abort allows the "all" sentinel', async () => {
    const el = {
      runElevated: vi.fn(async () => ({ ok: true, stdout: '', stderr: '', code: 0, cancelled: false })),
    } as unknown as Elevator
    expect((await new CommandBridge('/p', el).abort('all')).ok).toBe(true)
    expect(el.runElevated).toHaveBeenCalledWith('/p', ['abort', 'all'])
  })
  it('surfaces elevator cancel as a friendly message', async () => {
    const el = {
      runElevated: vi.fn(async () => ({ ok: false, stdout: '', stderr: '', code: 1, cancelled: true })),
    } as unknown as Elevator
    expect(await new CommandBridge('/p', el).cancel('shutdown-2300')).toEqual({
      ok: false,
      message: 'Authorization cancelled.',
    })
  })
})
