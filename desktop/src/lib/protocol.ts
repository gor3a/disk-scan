export type AppArch = 'intel' | 'appleSilicon' | 'universal' | 'unknown'

export interface AppDTO {
  id: string
  name: string
  bundleId: string
  path: string
  bytes: number
  arch: AppArch
}

export interface Leftover {
  path: string
  label: string
  bytes: number
}

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
  kind?: string // project artifact kind (node_modules, .next, target, …)
  command?: string[]
}

export interface Disk {
  used: number
  free: number
  total: number
}

export interface TreeNode {
  name: string
  path: string
  bytes: number
  dir: boolean
  children?: TreeNode[]
}

// EventTab routes a tab-scoped event to its slice. The backend stamps it on
// every scan/clean event so two concurrent scans never cross-contaminate.
export type EventTab = 'cleanup' | 'projects' | 'map' | 'apps'

export type DscanEvent =
  | { event: 'disk'; tab?: EventTab; disk: Disk }
  | { event: 'item'; tab?: EventTab; item: ItemDTO }
  // numeric fields are optional: Go omits them when zero (omitempty)
  | { event: 'progress'; tab?: EventTab; scanned?: number; phase?: string; bytes?: number; path?: string }
  | { event: 'scanDone'; tab?: EventTab; reclaimable?: number }
  | { event: 'tree'; tab?: EventTab; path?: string; node: TreeNode | null }
  | { event: 'cleanResult'; tab?: EventTab; freed?: number; trashed?: number; errors?: string[] }
  | { event: 'error'; message: string }
  | { event: 'host'; tab?: EventTab; host: { arch: 'appleSilicon' | 'other' } }
  | { event: 'app'; tab?: EventTab; app: AppDTO }
  | { event: 'leftovers'; tab?: EventTab; path?: string; leftovers?: Leftover[] }

export type Request =
  | { cmd: 'scan'; kind?: 'caches' | 'projects'; root?: string; system?: boolean; excludes?: string[] }
  | { cmd: 'map'; root?: string; excludes?: string[] }
  | { cmd: 'clean'; tab?: EventTab; ids: string[]; dryRun?: boolean; killLockers?: boolean }
  | { cmd: 'trash'; tab?: EventTab; path: string }
  | { cmd: 'cancel'; tab?: EventTab }
  | { cmd: 'apps' }
  | { cmd: 'appLeftovers'; path: string }
  | { cmd: 'uninstall'; tab?: EventTab; paths: string[] }

export function parseEvent(line: string): DscanEvent {
  return JSON.parse(line) as DscanEvent
}
