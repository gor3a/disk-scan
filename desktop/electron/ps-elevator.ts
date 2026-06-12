// Elevator — run a privileged powersched argv via the platform's native auth.
//   macOS: osascript "do shell script … with administrator privileges".
//   Linux: pkexec (polkit) — runs argv directly, no shell.
// The quoting helpers are pure + exported so they can be unit-tested in isolation.

import { spawn } from 'node:child_process'

export interface ElevateResult {
  ok: boolean
  stdout: string
  stderr: string
  code: number | null
  cancelled: boolean
}

/** POSIX single-quote one argument so /bin/sh treats it literally. */
export function shQuote(arg: string): string {
  return `'${arg.replace(/'/g, `'\\''`)}'`
}

/** Build a single /bin/sh command line from a binary path + argv. */
export function buildShellCommand(bin: string, argv: string[]): string {
  return [bin, ...argv].map(shQuote).join(' ')
}

/** Escape a string for embedding inside an AppleScript double-quoted literal. */
export function osaEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/** The full `-e` argument passed to osascript for an elevated run. */
export function appleScriptFor(bin: string, argv: string[]): string {
  const cmd = osaEscape(buildShellCommand(bin, argv))
  return `do shell script "${cmd}" with administrator privileges`
}

export type Spawner = typeof spawn

export class Elevator {
  constructor(
    private platform: NodeJS.Platform = process.platform,
    private spawner: Spawner = spawn,
  ) {}

  runElevated(bin: string, argv: string[]): Promise<ElevateResult> {
    if (this.platform === 'darwin') {
      return this.run('osascript', ['-e', appleScriptFor(bin, argv)], /user cancell?ed|\(-128\)/i)
    }
    return this.run('pkexec', [bin, ...argv], /dismissed|not authorized|126|127/i)
  }

  private run(cmd: string, args: string[], cancelRe: RegExp): Promise<ElevateResult> {
    return new Promise((resolve) => {
      let stdout = ''
      let stderr = ''
      let child
      try {
        child = this.spawner(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
      } catch (e) {
        resolve({ ok: false, stdout: '', stderr: String(e), code: null, cancelled: false })
        return
      }
      child.stdout?.on('data', (b: Buffer) => (stdout += b.toString()))
      child.stderr?.on('data', (b: Buffer) => (stderr += b.toString()))
      child.on('error', (e: Error) =>
        resolve({ ok: false, stdout, stderr: stderr || String(e), code: null, cancelled: false }),
      )
      child.on('close', (code: number | null) => {
        const cancelled = code !== 0 && cancelRe.test(stderr)
        resolve({ ok: code === 0, stdout, stderr, code, cancelled })
      })
    })
  }
}
