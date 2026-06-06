import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { parseEvent, type DscanEvent } from './protocol'

describe('protocol fixture', () => {
  it('parses every golden line into a typed event', () => {
    const file = resolve(__dirname, '../../../testdata/protocol-fixture.jsonl')
    const lines = readFileSync(file, 'utf8').trim().split('\n')
    const events: DscanEvent[] = lines.map(parseEvent)
    expect(events.map((e) => e.event)).toEqual([
      'disk',
      'item',
      'progress',
      'scanDone',
      'cleanResult',
    ])
    const item = events[1]
    if (item.event !== 'item') throw new Error('expected item')
    expect(item.item.tier).toBe('SAFE')
    expect(item.item.selectable).toBe(true)
  })
})
