import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { createInterface, type Interface } from 'node:readline'
import type { DscanEvent, Request } from '../src/lib/protocol'

// Sidecar spawns the Go `dscan serve` binary and frames its stdout as one
// DscanEvent per line. Emits 'event' (DscanEvent) and 'exit' (number | null).
export class Sidecar extends EventEmitter {
  private proc?: ChildProcessWithoutNullStreams
  private rl?: Interface

  constructor(
    private bin: string,
    private args: string[] = ['serve'],
  ) {
    super()
  }

  start(): void {
    this.proc = spawn(this.bin, this.args, { stdio: ['pipe', 'pipe', 'pipe'] })
    this.rl = createInterface({ input: this.proc.stdout })
    this.rl.on('line', (line) => {
      const t = line.trim()
      if (!t) return
      try {
        this.emit('event', JSON.parse(t) as DscanEvent)
      } catch {
        this.emit('event', { event: 'error', message: `bad line: ${t}` } as DscanEvent)
      }
    })
    this.proc.stderr.on('data', (b) =>
      this.emit('event', { event: 'error', message: String(b) } as DscanEvent),
    )
    this.proc.on('exit', (code) => this.emit('exit', code))
  }

  send(req: Request): void {
    this.proc?.stdin.write(JSON.stringify(req) + '\n')
  }

  stop(): void {
    this.rl?.close()
    this.proc?.kill()
  }
}
