import { useEffect, useReducer, useRef, useState } from 'react'
import { reduce, initialState, activeTab, type Tab, type Settings, type CleanResult } from './state'
import { toggle, toggleGroup, selectedIds, selectedTotal, defaultSelection } from './lib/selection'
import { staleSelection } from './lib/projects'
import { resolveTheme } from './lib/theme'
import { humanBytes } from './lib/format'
import { HeroBar } from './components/HeroBar'
import { Group } from './components/Group'
import { Tabs } from './components/Tabs'
import { ScanLine } from './components/ScanLine'
import { ProjectsView } from './components/ProjectsView'
import { SupportButton } from './components/SupportButton'
import { TopBar } from './components/TopBar'
import { Menu } from './components/Menu'
import { AboutModal } from './components/AboutModal'
import { UninstallModal } from './components/UninstallModal'
import { SettingsModal } from './components/SettingsModal'
import type { DscanEvent, Request, Tier } from './lib/protocol'

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
    }
  }
}

const nowSecs = () => Math.floor(Date.now() / 1000)

export default function App() {
  const [s, dispatch] = useReducer(reduce, undefined, initialState)
  const projectsRoot = useRef('~')
  const startedCleanup = useRef(false)
  const startedProjects = useRef(false)
  const pendingCount = useRef(0)
  const lastResult = useRef<CleanResult | undefined>(undefined)
  // Auto-selection follows incoming items until the user manually toggles.
  const touched = useRef<{ cleanup: boolean; projects: boolean }>({ cleanup: false, projects: false })

  const [menuOpen, setMenuOpen] = useState(false)
  const [version, setVersion] = useState('')
  const [stats, setStats] = useState({ total: 0, cleans: 0 })

  useEffect(() => window.dscan.onEvent((e) => dispatch({ type: 'event', event: e })), [])

  // Load persisted version/settings/history once.
  useEffect(() => {
    window.dscan.appInfo().then((i) => setVersion(i.version))
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

  const scanCleanup = () => {
    touched.current.cleanup = false
    dispatch({ type: 'startScan', tab: 'cleanup' })
    window.dscan.send({ cmd: 'scan', kind: 'caches' })
  }
  const scanProjects = (root: string) => {
    touched.current.projects = false
    projectsRoot.current = root
    dispatch({ type: 'startScan', tab: 'projects' })
    window.dscan.send({ cmd: 'scan', kind: 'projects', root: root === '~' ? '' : root })
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.tab])

  const t = activeTab(s)
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
    if (touched.current[s.tab] || t.items.length === 0) return
    setSelection(
      s.tab === 'projects'
        ? staleSelection(t.items, nowSecs(), s.settings.staleDays)
        : defaultSelection(t.items),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.tab, t.items.length, s.settings.staleDays])

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

      <HeroBar reclaimable={selectedTotal(t.items, t.selection)} disk={t.disk} onClean={doClean} />
      <ScanLine
        scanning={t.scanning}
        phase={t.phase}
        scanned={t.scanned}
        bytes={t.bytes}
        currentPath={t.currentPath}
        onStop={() => window.dscan.send({ cmd: 'cancel' })}
      />

      {s.tab === 'cleanup' ? (
        <div className="flex-1 overflow-y-auto pb-6">
          {(['SAFE', 'REVIEW', 'KEEP'] as const).map((tier) => (
            <Group
              key={tier}
              tier={tier}
              items={t.items}
              selection={t.selection}
              onToggle={onToggle}
              onToggleGroup={onToggleGroup}
            />
          ))}
        </div>
      ) : (
        <ProjectsView
          items={t.items}
          selection={t.selection}
          root={projectsRoot.current}
          nowSecs={nowSecs()}
          onToggle={onToggle}
          onChangeFolder={onChangeFolder}
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
    </div>
  )
}
