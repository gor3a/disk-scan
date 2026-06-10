import type { DscanEvent, Disk, ItemDTO, TreeNode, AppDTO, Leftover } from './lib/protocol'
import type { Selection } from './lib/selection'

export type Tab = 'cleanup' | 'projects' | 'map' | 'apps'

export interface Settings {
  staleDays: number
  lastProjectRoot?: string
  theme?: 'system' | 'light' | 'dark'
  excludes?: string[]
  schedule?: 'off' | 'daily' | 'weekly'
  scheduleAutoClean?: boolean
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

export interface AppsState {
  scanning: boolean
  hostAppleSilicon: boolean
  apps: AppDTO[]
  leftovers: Leftover[] // for the currently-open uninstall modal
}

export interface State {
  tab: Tab
  scanningTab: Tab | null
  cleanup: TabState
  projects: TabState
  map: MapState
  apps: AppsState
  pendingCleanIds: string[]
  result?: CleanResult
  settings: Settings
  modal: Modal
}

export type Action =
  | { type: 'setTab'; tab: Tab }
  | { type: 'startScan'; tab: Tab }
  | { type: 'stopScan' }
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

function emptyApps(): AppsState {
  return { scanning: false, hostAppleSilicon: false, apps: [], leftovers: [] }
}

export function initialState(): State {
  return {
    tab: 'cleanup',
    scanningTab: null,
    cleanup: emptyTab(),
    projects: emptyTab(),
    map: emptyMap(),
    apps: emptyApps(),
    pendingCleanIds: [],
    settings: {
      staleDays: 30,
      theme: 'system',
      excludes: [],
      schedule: 'off',
      scheduleAutoClean: false,
    },
    modal: null,
  }
}

// activeTab returns the TabState for the current tab. The Map tab has no
// TabState (it uses the `map` slice); callers gate on `tab` and never render
// TabState-driven UI on Map, so a cleanup placeholder is harmless here.
export function activeTab(s: State): TabState {
  return s.tab === 'map' || s.tab === 'apps' ? s.cleanup : s[s.tab]
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
      if (a.tab === 'apps')
        return {
          ...s,
          apps: { ...emptyApps(), hostAppleSilicon: s.apps.hostAppleSilicon, scanning: true },
          tab: 'apps',
          scanningTab: 'apps',
        }
      return {
        ...setTabState(s, a.tab, { ...emptyTab(), scanning: true }),
        tab: a.tab,
        scanningTab: a.tab,
      }
    case 'stopScan':
      // User stopped the in-progress scan: clear scanning on the active slice.
      // (A cancel may not produce a terminal event, so we settle the UI here.)
      if (s.tab === 'map') return { ...s, map: { ...s.map, scanning: false }, scanningTab: null }
      if (s.tab === 'apps') return { ...s, apps: { ...s.apps, scanning: false }, scanningTab: null }
      return { ...setTabState(s, s.tab, { ...activeTab(s), scanning: false }), scanningTab: null }
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
    if (s.tab === 'apps') {
      const cleaned = new Set(s.pendingCleanIds)
      const apps = s.apps.apps.filter((a) => !cleaned.has(a.id))
      return { ...s, apps: { ...s.apps, apps, leftovers: [] }, pendingCleanIds: [], result }
    }
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

  // Apps slice: host/app/leftovers route here, never to a TabState.
  if (e.event === 'host') {
    return { ...s, apps: { ...s.apps, hostAppleSilicon: e.host.arch === 'appleSilicon' } }
  }
  if (e.event === 'app') {
    return { ...s, apps: { ...s.apps, apps: [...s.apps.apps, e.app] } }
  }
  if (e.event === 'leftovers') {
    return { ...s, apps: { ...s.apps, leftovers: e.leftovers ?? [] } }
  }
  if (s.scanningTab === 'apps') {
    if (e.event === 'scanDone') return { ...s, apps: { ...s.apps, scanning: false } }
    return s // progress during apps scan: ignore (no per-file UI)
  }

  const tab = s.scanningTab ?? s.tab
  if (tab === 'map' || tab === 'apps') return s
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
