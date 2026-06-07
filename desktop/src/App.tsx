import { useEffect, useReducer, useRef, useState } from 'react'
import { reduce, initialState, activeTab, type Tab, type Settings, type CleanResult } from './state'
import { toggle, toggleGroup, selectedIds, selectedTotal, defaultSelection } from './lib/selection'
import { staleSelection } from './lib/projects'
import { resolveTheme } from './lib/theme'
import { isExcluded, excludeTargetFor } from './lib/exclude'
import { humanBytes } from './lib/format'
import { HeroBar } from './components/HeroBar'
import { Group } from './components/Group'
import { Tabs } from './components/Tabs'
import { ScanLine } from './components/ScanLine'
import { ProjectsView } from './components/ProjectsView'
import { MapView } from './components/MapView'
import { UpdateBanner } from './components/UpdateBanner'
import { Modal } from './components/Modal'
import type { UpdateStatus } from './lib/update'
import { SupportButton } from './components/SupportButton'
import { TopBar } from './components/TopBar'
import { Menu } from './components/Menu'
import { AboutModal } from './components/AboutModal'
import { UninstallModal } from './components/UninstallModal'
import { SettingsModal } from './components/SettingsModal'
import type { DscanEvent, Request, Tier, ItemDTO, TreeNode } from './lib/protocol'

const KOFI = 'https://ko-fi.com/gor3a'
const CONTACT = 'https://minasameh.com/contact'

declare global {
  interface Window {
    dscan: {
      send: (r: Request) => void
      pickFolder: () => Promise<string | null>
      openExternal: (url: string) => void
      onEvent: (cb: (e: DscanEvent) => void) => () => void
      appInfo: () => Promise<{ version: string; platform: string; isPackaged: boolean }>
      reveal: (p: string) => void
      uninstall: () => Promise<{ ok: boolean; reason?: 'dev' | 'managed' }>
      getSettings: () => Promise<Settings>
      setSettings: (p: Partial<Settings>) => Promise<Settings>
      getHistory: () => Promise<
        Array<{ at: number; freed: number; trashed: number; items: number; tab: string }>
      >
      addHistory: (e: { at: number; freed: number; trashed: number; items: number; tab: string }) => void
      setSchedule: (opts: {
        cadence: 'off' | 'daily' | 'weekly'
        autoClean: boolean
      }) => Promise<{ ok: boolean; error?: string }>
      update: {
        onStatus: (cb: (s: UpdateStatus) => void) => () => void
        check: () => Promise<void>
        install: () => Promise<void>
        openReleases: () => Promise<void>
      }
      win: {
        minimize: () => void
        maximize: () => void
        close: () => void
        onMaximized: (cb: (max: boolean) => void) => () => void
      }
    }
  }
}

const nowSecs = () => Math.floor(Date.now() / 1000)

export default function App() {
  const [s, dispatch] = useReducer(reduce, undefined, initialState)
  const projectsRoot = useRef('~')
  const mapRoot = useRef('~')
  const startedCleanup = useRef(false)
  const startedProjects = useRef(false)
  const startedMap = useRef(false)
  const pendingCount = useRef(0)
  const lastResult = useRef<CleanResult | undefined>(undefined)
  // Auto-selection follows incoming items until the user manually toggles.
  const touched = useRef<Record<Tab, boolean>>({ cleanup: false, projects: false, map: false })
  const [trashTarget, setTrashTarget] = useState<TreeNode | null>(null)

  const [menuOpen, setMenuOpen] = useState(false)
  const [version, setVersion] = useState('')
  const [platform, setPlatform] = useState('')
  const [update, setUpdate] = useState<UpdateStatus>({ state: 'none' })
  const [stats, setStats] = useState({ total: 0, cleans: 0 })

  useEffect(() => window.dscan.onEvent((e) => dispatch({ type: 'event', event: e })), [])

  // Load persisted version/settings/history once.
  useEffect(() => {
    window.dscan.appInfo().then((i) => {
      setVersion(i.version)
      setPlatform(i.platform)
    })
    window.dscan.getSettings().then((set) => {
      dispatch({ type: 'setSettings', settings: set })
      if (set.lastProjectRoot) projectsRoot.current = set.lastProjectRoot
    })
    window.dscan
      .getHistory()
      .then((h) => setStats({ total: h.reduce((n, e) => n + e.freed + e.trashed, 0), cleans: h.length }))
  }, [])

  // Apply the theme: toggle `dark` on <html> from the setting + OS preference.
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const mode = resolveTheme(s.settings.theme ?? 'system', mql.matches)
      document.documentElement.classList.toggle('dark', mode === 'dark')
    }
    apply()
    mql.addEventListener('change', apply)
    return () => mql.removeEventListener('change', apply)
  }, [s.settings.theme])

  // Subscribe to update status from the main process.
  useEffect(() => window.dscan.update.onStatus(setUpdate), [])

  // (Re)apply the OS scheduled-scan job when the schedule settings change.
  useEffect(() => {
    window.dscan.setSchedule({
      cadence: s.settings.schedule ?? 'off',
      autoClean: s.settings.scheduleAutoClean ?? false,
    })
  }, [s.settings.schedule, s.settings.scheduleAutoClean])

  const excludes = s.settings.excludes ?? []

  const scanCleanup = () => {
    touched.current.cleanup = false
    dispatch({ type: 'startScan', tab: 'cleanup' })
    window.dscan.send({ cmd: 'scan', kind: 'caches', excludes })
  }
  const scanProjects = (root: string) => {
    touched.current.projects = false
    projectsRoot.current = root
    dispatch({ type: 'startScan', tab: 'projects' })
    window.dscan.send({ cmd: 'scan', kind: 'projects', root: root === '~' ? '' : root, excludes })
  }
  const scanMap = (root: string) => {
    mapRoot.current = root
    dispatch({ type: 'startScan', tab: 'map' })
    window.dscan.send({ cmd: 'map', root: root === '~' ? '' : root, excludes })
  }

  useEffect(() => {
    if (startedCleanup.current) return
    startedCleanup.current = true
    scanCleanup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (s.tab === 'projects' && !startedProjects.current) {
      startedProjects.current = true
      scanProjects(projectsRoot.current)
    }
    if (s.tab === 'map' && !startedMap.current) {
      startedMap.current = true
      scanMap(s.settings.lastProjectRoot ?? '~')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.tab])

  const t = activeTab(s)
  const items = t.items.filter((i) => !isExcluded(i.path, excludes))
  const setSelection = (sel: Set<string>) => dispatch({ type: 'setSelection', selection: sel })
  const onToggle = (id: string) => {
    touched.current[s.tab] = true
    setSelection(toggle(t.selection, id, t.items))
  }
  const onToggleGroup = (tier: Tier) => {
    touched.current[s.tab] = true
    setSelection(toggleGroup(t.selection, t.items, tier))
  }

  // Re-derive the default selection as items stream in / the threshold changes,
  // until the user manually toggles this tab.
  useEffect(() => {
    if (s.tab === 'map' || touched.current[s.tab] || items.length === 0) return
    setSelection(
      s.tab === 'projects'
        ? staleSelection(items, nowSecs(), s.settings.staleDays)
        : defaultSelection(items),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.tab, items.length, s.settings.staleDays])

  // Log each clean to history + update the running stats.
  useEffect(() => {
    if (!s.result || s.result === lastResult.current) return
    lastResult.current = s.result
    const entry = {
      at: nowSecs(),
      freed: s.result.freed,
      trashed: s.result.trashed,
      items: pendingCount.current,
      tab: s.tab,
    }
    window.dscan.addHistory(entry)
    setStats((p) => ({ total: p.total + entry.freed + entry.trashed, cleans: p.cleans + 1 }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.result])

  // After a trash on the Map tab, re-map the current root.
  useEffect(() => {
    if (s.result && s.tab === 'map') scanMap(mapRoot.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.result])

  const doClean = () => {
    const ids = selectedIds(t.selection)
    pendingCount.current = ids.length
    dispatch({ type: 'startClean', ids })
    window.dscan.send({ cmd: 'clean', ids, killLockers: s.tab === 'projects' })
  }
  const onChangeFolder = async () => {
    const dir = await window.dscan.pickFolder()
    if (dir) {
      scanProjects(dir)
      window.dscan.setSettings({ lastProjectRoot: dir })
    }
  }
  const onExclude = (item: ItemDTO) => {
    const next = [...excludes, excludeTargetFor(item)]
    dispatch({ type: 'setSettings', settings: { ...s.settings, excludes: next } })
    window.dscan.setSettings({ excludes: next })
  }
  const onMapExclude = (path: string) => {
    const next = [...excludes, path]
    dispatch({ type: 'setSettings', settings: { ...s.settings, excludes: next } })
    window.dscan.setSettings({ excludes: next })
    scanMap(mapRoot.current)
  }
  const onMapChangeFolder = async () => {
    const dir = await window.dscan.pickFolder()
    if (dir) {
      scanMap(dir)
      window.dscan.setSettings({ lastProjectRoot: dir })
    }
  }
  const confirmTrash = () => {
    if (trashTarget) window.dscan.send({ cmd: 'trash', path: trashTarget.path })
    setTrashTarget(null)
  }

  const closeModal = () => dispatch({ type: 'openModal', modal: null })

  return (
    <div className="flex h-screen flex-col text-ink">
      <TopBar onToggleMenu={() => setMenuOpen((o) => !o)} />
      {menuOpen && (
        <Menu
          onContact={() => {
            setMenuOpen(false)
            window.dscan.openExternal(CONTACT)
          }}
          onSupport={() => {
            setMenuOpen(false)
            window.dscan.openExternal(KOFI)
          }}
          onCheckUpdates={() => {
            setMenuOpen(false)
            window.dscan.update.check()
          }}
          onSettings={() => {
            setMenuOpen(false)
            dispatch({ type: 'openModal', modal: 'settings' })
          }}
          onAbout={() => {
            setMenuOpen(false)
            dispatch({ type: 'openModal', modal: 'about' })
          }}
          onUninstall={() => {
            setMenuOpen(false)
            dispatch({ type: 'openModal', modal: 'uninstall' })
          }}
        />
      )}

      <Tabs tab={s.tab} onTab={(tab: Tab) => dispatch({ type: 'setTab', tab })} />

      {s.tab !== 'map' && (
        <HeroBar reclaimable={selectedTotal(items, t.selection)} disk={t.disk} onClean={doClean} />
      )}
      <ScanLine
        scanning={s.tab === 'map' ? s.map.scanning : t.scanning}
        phase={s.tab === 'map' ? 'map' : t.phase}
        scanned={s.tab === 'map' ? s.map.scanned : t.scanned}
        bytes={s.tab === 'map' ? s.map.bytes : t.bytes}
        currentPath={s.tab === 'map' ? s.map.currentPath : t.currentPath}
        onStop={() => window.dscan.send({ cmd: 'cancel' })}
      />

      {s.tab === 'cleanup' ? (
        <div className="flex-1 overflow-y-auto pb-6">
          {(['SAFE', 'REVIEW', 'KEEP'] as const).map((tier) => (
            <Group
              key={tier}
              tier={tier}
              items={items}
              selection={t.selection}
              onToggle={onToggle}
              onToggleGroup={onToggleGroup}
              onExclude={onExclude}
            />
          ))}
        </div>
      ) : s.tab === 'projects' ? (
        <ProjectsView
          items={items}
          selection={t.selection}
          root={projectsRoot.current}
          nowSecs={nowSecs()}
          onToggle={onToggle}
          onChangeFolder={onChangeFolder}
          onExclude={onExclude}
        />
      ) : (
        <MapView
          tree={s.map.tree}
          scanning={s.map.scanning}
          scanned={s.map.scanned}
          bytes={s.map.bytes}
          currentPath={s.map.currentPath}
          root={mapRoot.current}
          onChangeFolder={onMapChangeFolder}
          onReveal={(p) => window.dscan.reveal(p)}
          onExclude={onMapExclude}
          onTrash={(node) => setTrashTarget(node)}
        />
      )}

      {s.result && (
        <div className="flex items-center gap-3 border-t border-line bg-surface px-5 py-2 text-[12.5px] text-safe">
          <span>
            Reclaimed {humanBytes(s.result.freed + s.result.trashed)}
            {s.result.errors.length > 0 && ` · ${s.result.errors.length} skipped`}
          </span>
          <span className="text-ink-soft">— enjoying dscan?</span>
          <span className="ml-auto">
            <SupportButton onClick={() => window.dscan.openExternal(KOFI)} />
          </span>
        </div>
      )}

      <UpdateBanner
        status={update}
        platform={platform}
        onInstall={() => window.dscan.update.install()}
        onDownload={() => window.dscan.update.openReleases()}
      />

      <footer className="flex items-center border-t border-line bg-surface px-5 py-1.5 text-[11.5px] text-ink-soft">
        <span className="font-display text-[13px] text-ink">dscan</span>
        <span className="ml-auto">
          <SupportButton onClick={() => window.dscan.openExternal(KOFI)} />
        </span>
      </footer>

      {s.modal === 'about' && (
        <AboutModal
          version={version}
          reclaimedAllTime={stats.total}
          cleans={stats.cleans}
          onClose={closeModal}
          onContact={() => window.dscan.openExternal(CONTACT)}
          onSupport={() => window.dscan.openExternal(KOFI)}
        />
      )}
      {s.modal === 'settings' && (
        <SettingsModal
          settings={s.settings}
          onChange={(set: Settings) => {
            dispatch({ type: 'setSettings', settings: set })
            window.dscan.setSettings(set)
          }}
          onClose={closeModal}
        />
      )}
      {s.modal === 'uninstall' && <UninstallModal onClose={closeModal} />}

      {trashTarget && (
        <Modal onClose={() => setTrashTarget(null)}>
          <h2 className="font-display text-xl text-ink">Move to Trash?</h2>
          <p className="mt-2 text-[13px] text-ink-soft">
            <span className="font-mono">{trashTarget.path}</span> ({humanBytes(trashTarget.bytes)}) will be
            moved to the Trash. You can restore it from there.
          </p>
          <div className="mt-5 flex gap-2">
            <button
              onClick={() => setTrashTarget(null)}
              className="flex-1 rounded-xl border border-line px-4 py-2.5 font-semibold text-ink"
            >
              Cancel
            </button>
            <button
              onClick={confirmTrash}
              className="flex-1 rounded-xl bg-[#b91c1c] px-4 py-2.5 font-semibold text-white"
            >
              Move to Trash
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
