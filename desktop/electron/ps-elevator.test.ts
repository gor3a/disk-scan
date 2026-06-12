import { describe, it, expect, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { shQuote, buildShellCommand, osaEscape, appleScriptFor, Elevator } from './ps-elevator'

describe('shell quoting', () => {
  it('single-quotes and escapes embedded quotes', () => {
    expect(shQuote('abc')).toBe(`'abc'`)
    expect(shQuote(`a'b`)).toBe(`'a'\\''b'`)
  })
  it('buildShellCommand quotes every token (no shell injection)', () => {
    expect(buildShellCommand('/p/powersched', ['shutdown', 'in', '2h; rm -rf /'])).toBe(
      `'/p/powersched' 'shutdown' 'in' '2h; rm -rf /'`,
    )
  })
  it('osaEscape escapes backslash then quote', () => {
    expect(osaEscape('a"b\\c')).toBe('a\\"b\\\\c')
  })
  it('appleScriptFor wraps an elevated do-shell-script', () => {
    expect(appleScriptFor('/p/powersched', ['abort', 'all'])).toBe(
      `do shell script "'/p/powersched' 'abort' 'all'" with administrator privileges`,
    )
  })
})

function fakeSpawn(code: number, stderr = '') {
  return vi.fn(() => {
    const child = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter }
    child.stdout = new EventEmitter()
    child.stderr = new EventEmitter()
    setTimeout(() => {
      if (stderr) child.stderr.emit('data', Buffer.from(stderr))
      child.emit('close', code)
    }, 0)
    return child
  })
}

describe('Elevator.runElevated', () => {
  it('darwin success → ok, uses osascript', async () => {
    const spawn = fakeSpawn(0)
    const r = await new Elevator('darwin', spawn as never).runElevated('/p/powersched', ['list'])
    expect(r.ok).toBe(true)
    expect(spawn).toHaveBeenCalledWith('osascript', expect.arrayContaining(['-e']), expect.anything())
  })
  it('darwin cancel detected from -128', async () => {
    const r = await new Elevator('darwin', fakeSpawn(1, 'User canceled. (-128)') as never).runElevated(
      '/p/powersched',
      ['shutdown', 'in', '2h'],
    )
    expect(r.ok).toBe(false)
    expect(r.cancelled).toBe(true)
  })
  it('linux uses pkexec with an argv array', async () => {
    const spawn = fakeSpawn(0)
    await new Elevator('linux', spawn as never).runElevated('/p/powersched', ['cancel', 'all'])
    expect(spawn).toHaveBeenCalledWith('pkexec', ['/p/powersched', 'cancel', 'all'], expect.anything())
  })
})
