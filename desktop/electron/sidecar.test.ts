import { describe, it, expect } from 'vitest'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Sidecar } from './sidecar'
import type { DscanEvent } from '../src/lib/protocol'

function fakeSidecar(): string {
  const dir = mkdtempSync(join(tmpdir(), 'dscan-'))
  const file = join(dir, 'fake.mjs')
  writeFileSync(
    file,
    [
      "process.stdin.on('data', () => {})",
      "process.stdout.write(JSON.stringify({event:'disk',disk:{used:1,free:2,total:3}})+'\\n')",
      "process.stdout.write(JSON.stringify({event:'scanDone',reclaimable:0})+'\\n')",
    ].join('\n'),
  )
  return file
}

describe('Sidecar', () => {
  it('emits one typed event per JSON line', async () => {
    const sc = new Sidecar('node', [fakeSidecar()])
    const got: string[] = []
    await new Promise<void>((res) => {
      sc.on('event', (e: DscanEvent) => {
        got.push(e.event)
        if (e.event === 'scanDone') res()
      })
      sc.start()
    })
    expect(got).toEqual(['disk', 'scanDone'])
    sc.stop()
  })
})
