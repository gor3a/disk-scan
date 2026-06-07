import type { DscanEvent, Disk, ItemDTO, TreeNode } from './lib/protocol'
import type { Selection } from './lib/selection'

export type Tab = 'cleanup' | 'projects' | 'map'

export interface Settings {
  staleDays: number
  lastProjectRoot?: string
  theme?: 'system' | 'light' | 'dark'
  excludes?: string[]
}
export type Modal = 'about' | 'settings' | 'uninstall' | null

export interface CleanResult {
  freed: number
  trashed: number
  errors: string[]
}

export interface TabState {
  scanning: boolean
  phase?: string
  scanned: number
  bytes: number
  currentPath?: string
  disk?: Disk
  items: ItemDTO[]
  selection: Selection
  reclaimable: number
}

export interface MapState {
  scanning: boolean
  scanned: number
  bytes: number
  currentPath?: string
  tree: TreeNode | null
}

export interface State {
  tab: Tab
  scanningTab: Tab | null
  cleanup: TabState
  projects: TabState
  map: MapState
  pendingCleanIds: string[]
  result?: CleanResult
  settings: Settings
  modal: Modal
}

export type Action =
  | { type: 'setTab'; tab: Tab }
  | { type: 'startScan'; tab: Tab }
  | { type: 'startClean'; ids: string[] }
  | { type: 'event'; event: DscanEvent }
  | { type: 'setSelection'; selection: Selection }
  | { type: 'setSettings'; settings: Settings }
  | { type: 'openModal'; modal: Modal }

function emptyTab(): TabState {
  return { scanning: false, scanned: 0, bytes: 0, items: [], selection: new Set(), reclaimable: 0 }
}

function emptyMap(): MapState {
  return { scanning: false, scanned: 0, bytes: 0, tree: null }
}

export function initialState(): State {
  return {
    tab: 'cleanup',
    scanningTab: null,
    cleanup: emptyTab(),
    projects: emptyTab(),
    map: emptyMap(),
    pendingCleanIds: [],
    settings: { staleDays: 30, theme: 'system', excludes: [] },
    modal: null,
  }
}

// activeTab returns the TabState for the current tab. The Map tab has no
// TabState (it uses the `map` slice); callers gate on `tab` and never render
// TabState-driven UI on Map, so a cleanup placeholder is harmless here.
export function activeTab(s: State): TabState {
  return s.tab === 'map' ? s.cleanup : s[s.tab]
}

function setTabState(s: State, tab: Tab, t: TabState): State {
  return { ...s, [tab]: t }
}

export function reduce(s: State, a: Action): State {
  switch (a.type) {
    case 'setTab':
      return { ...s, tab: a.tab }
    case 'startScan':
      if (a.tab === 'map')
        return { ...s, map: { ...emptyMap(), scanning: true }, tab: 'map', scanningTab: 'map' }
      return {
        ...setTabState(s, a.tab, { ...emptyTab(), scanning: true }),
        tab: a.tab,
        scanningTab: a.tab,
      }
    case 'startClean':
      return { ...s, pendingCleanIds: a.ids }
    case 'setSelection':
      return setTabState(s, s.tab, { ...activeTab(s), selection: a.selection })
    case 'setSettings':
      return { ...s, settings: a.settings }
    case 'openModal':
      return { ...s, modal: a.modal }
    case 'event':
      return applyEvent(s, a.event)
  }
}

function applyEvent(s: State, e: DscanEvent): State {
  // cleanResult applies to whichever tab initiated the clean (the current tab).
  if (e.event === 'cleanResult') {
    const result = { freed: e.freed ?? 0, trashed: e.trashed ?? 0, errors: e.errors ?? [] }
    if (s.tab === 'map') return { ...s, pendingCleanIds: [], result }
    const cleaned = new Set(s.pendingCleanIds)
    const t = activeTab(s)
    const items = t.items.filter((i) => !cleaned.has(i.id))
    const selection = new Set([...t.selection].filter((id) => !cleaned.has(id)))
    return {
      ...setTabState(s, s.tab, { ...t, items, selection }),
      pendingCleanIds: [],
      result,
    }
  }

  // Map slice: the tree event and map-scan progress route here, never to a TabState.
  if (e.event === 'tree') {
    return { ...s, map: { ...s.map, scanning: false, tree: e.node } }
  }
  if (s.scanningTab === 'map') {
    if (e.event === 'progress') {
      return {
        ...s,
        map: { ...s.map, scanned: e.scanned ?? 0, bytes: e.bytes ?? 0, currentPath: e.path },
      }
    }
    return s
  }

  const tab = s.scanningTab ?? s.tab
  if (tab === 'map') return s
  const t = s[tab]
  let nt: TabState
  switch (e.event) {
    case 'disk':
      nt = { ...t, disk: e.disk }
      break
    case 'item': {
      const idx = t.items.findIndex((i) => i.id === e.item.id)
      const items =
        idx === -1 ? [...t.items, e.item] : t.items.map((i, k) => (k === idx ? e.item : i))
      nt = { ...t, items }
      break
    }
    case 'progress':
      nt = { ...t, scanned: e.scanned ?? 0, phase: e.phase, bytes: e.bytes ?? 0, currentPath: e.path }
      break
    case 'scanDone':
      nt = { ...t, scanning: false, reclaimable: e.reclaimable ?? 0 }
      break
    default:
      return s
  }
  return setTabState(s, tab, nt)
}
