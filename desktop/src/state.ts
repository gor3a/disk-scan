import type { DscanEvent, Disk, ItemDTO } from './lib/protocol'
import { defaultSelection, type Selection } from './lib/selection'

export type Phase = 'idle' | 'scanning' | 'list' | 'confirm' | 'cleaning' | 'done'

export interface CleanResult {
  freed: number
  trashed: number
  errors: string[]
}

export interface State {
  phase: Phase
  disk?: Disk
  items: ItemDTO[]
  scanned: number
  selection: Selection
  reclaimable: number
  result?: CleanResult
}

export type Action =
  | { type: 'startScan' }
  | { type: 'startClean' }
  | { type: 'event'; event: DscanEvent }
  | { type: 'toGate' }
  | { type: 'back' }
  | { type: 'setSelection'; selection: Selection }

export function initialState(): State {
  return { phase: 'idle', items: [], scanned: 0, selection: new Set(), reclaimable: 0 }
}

export function reduce(s: State, a: Action): State {
  switch (a.type) {
    case 'startScan':
      return { ...initialState(), phase: 'scanning' }
    case 'startClean':
      return { ...s, phase: 'cleaning' }
    case 'toGate':
      return { ...s, phase: 'confirm' }
    case 'back':
      return { ...s, phase: 'list' }
    case 'setSelection':
      return { ...s, selection: a.selection }
    case 'event':
      return applyEvent(s, a.event)
  }
}

function applyEvent(s: State, e: DscanEvent): State {
  switch (e.event) {
    case 'disk':
      return { ...s, disk: e.disk }
    case 'item': {
      // Upsert by id so a re-scan (or React StrictMode's double-invoked effect)
      // can never duplicate rows.
      const idx = s.items.findIndex((i) => i.id === e.item.id)
      if (idx === -1) return { ...s, items: [...s.items, e.item] }
      const items = s.items.slice()
      items[idx] = e.item
      return { ...s, items }
    }
    case 'progress':
      // Go omits zero-valued numerics (omitempty), so coerce undefined → 0 to
      // avoid NaN downstream.
      return { ...s, scanned: e.scanned ?? 0 }
    case 'scanDone':
      return {
        ...s,
        phase: 'list',
        reclaimable: e.reclaimable ?? 0,
        selection: defaultSelection(s.items),
      }
    case 'cleanResult':
      return {
        ...s,
        phase: 'done',
        result: { freed: e.freed ?? 0, trashed: e.trashed ?? 0, errors: e.errors ?? [] },
      }
    case 'error':
      return s
  }
}
