// CommandBridge — the single place that runs the powersched CLI.
//   reads  (list --json): plain spawn, no root needed
//   writes (schedule/cancel/abort): routed through the Elevator (native auth)

import { spawn } from 'node:child_process'
import { Elevator } from './ps-elevator'
import { toArgv, type Job, type Result, type ScheduleRequest } from '../src/lib/powersched'

// Must start alphanumeric — rejects "." / ".." and option-like leading "-" ids
// before they reach a root filesystem op in the CLI.
const VALID_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

export type Spawner = typeof spawn

export class CommandBridge {
  constructor(
    private bin: string,
    private elevator: Elevator = new Elevator(),
    private spawner: Spawner = spawn,
  ) {}

  /** Read the current jobs. No elevation. Returns [] on any failure. */
  list(): Promise<Job[]> {
    return new Promise((resolve) => {
      let out = ''
      let child
      try {
        child = this.spawner(this.bin, ['list', '--json'], { stdio: ['ignore', 'pipe', 'pipe'] })
      } catch {
        resolve([])
        return
      }
      child.stdout?.on('data', (b: Buffer) => (out += b.toString()))
      child.on('error', () => resolve([]))
      child.on('close', (code: number | null) => {
        if (code !== 0) return resolve([])
        try {
          const jobs = JSON.parse(out.trim() || '[]') as Job[]
          resolve(Array.isArray(jobs) ? jobs : [])
        } catch {
          resolve([])
        }
      })
    })
  }

  async schedule(req: ScheduleRequest): Promise<Result> {
    let argv: string[]
    try {
      argv = toArgv(req)
    } catch (e) {
      return { ok: false, message: (e as Error).message }
    }
    return this.elevate(argv, 'Scheduled.')
  }

  cancel(id: string): Promise<Result> {
    if (!VALID_ID.test(id)) return Promise.resolve({ ok: false, message: `Invalid job id: ${id}` })
    return this.elevate(['cancel', id], `Cancelled ${id}.`)
  }

  abort(id: string): Promise<Result> {
    if (id !== 'all' && !VALID_ID.test(id))
      return Promise.resolve({ ok: false, message: `Invalid job id: ${id}` })
    return this.elevate(['abort', id], 'Abort signalled.')
  }

  private async elevate(argv: string[], okMsg: string): Promise<Result> {
    const r = await this.elevator.runElevated(this.bin, argv)
    if (r.ok) return { ok: true, message: okMsg }
    if (r.cancelled) return { ok: false, message: 'Authorization cancelled.' }
    const msg = (r.stderr || r.stdout || '').trim().split('\n').pop() || 'Command failed.'
    return { ok: false, message: msg }
  }
}
