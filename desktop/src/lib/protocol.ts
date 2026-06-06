export type Tier = 'SAFE' | 'REVIEW' | 'KEEP'
export type Method = 'remove' | 'trash' | 'command'

export interface ItemDTO {
  id: string
  path: string
  label: string
  bytes: number
  category: string
  tier: Tier
  method: Method
  source: 'catalog' | 'heuristic'
  selectable: boolean
  modified?: number // unix secs, projects only
  command?: string[]
}

export interface Disk {
  used: number
  free: number
  total: number
}

export type DscanEvent =
  | { event: 'disk'; disk: Disk }
  | { event: 'item'; item: ItemDTO }
  // numeric fields are optional: Go omits them when zero (omitempty)
  | { event: 'progress'; scanned?: number; phase?: string; bytes?: number; path?: string }
  | { event: 'scanDone'; reclaimable?: number }
  | { event: 'cleanResult'; freed?: number; trashed?: number; errors?: string[] }
  | { event: 'error'; message: string }

export type Request =
  | { cmd: 'scan'; kind?: 'caches' | 'projects'; root?: string; system?: boolean }
  | { cmd: 'clean'; ids: string[]; dryRun?: boolean }
  | { cmd: 'cancel' }

export function parseEvent(line: string): DscanEvent {
  return JSON.parse(line) as DscanEvent
}
