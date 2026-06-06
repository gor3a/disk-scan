import { useEffect, useReducer, useRef } from 'react'
import { reduce, initialState, activeTab, type Tab } from './state'
import { toggle, toggleGroup, selectedIds, selectedTotal, defaultSelection } from './lib/selection'
import { staleSelection } from './lib/projects'
import { humanBytes } from './lib/format'
import { HeroBar } from './components/HeroBar'
import { Group } from './components/Group'
import { Tabs } from './components/Tabs'
import { ScanLine } from './components/ScanLine'
import { ProjectsView } from './components/ProjectsView'
import type { DscanEvent, Request, Tier } from './lib/protocol'

declare global {
  interface Window {
    dscan: {
      send: (r: Request) => void
      pickFolder: () => Promise<string | null>
      onEvent: (cb: (e: DscanEvent) => void) => () => void
    }
  }
}

const nowSecs = () => Math.floor(Date.now() / 1000)

export default function App() {
  const [s, dispatch] = useReducer(reduce, undefined, initialState)
  const projectsRoot = useRef('~')
  const startedCleanup = useRef(false)
  const startedProjects = useRef(false)

  useEffect(() => window.dscan.onEvent((e) => dispatch({ type: 'event', event: e })), [])

  const scanCleanup = () => {
    dispatch({ type: 'startScan', tab: 'cleanup' })
    window.dscan.send({ cmd: 'scan', kind: 'caches' })
  }
  const scanProjects = (root: string) => {
    projectsRoot.current = root
    dispatch({ type: 'startScan', tab: 'projects' })
    window.dscan.send({ cmd: 'scan', kind: 'projects', root: root === '~' ? '' : root })
  }

  // Auto-scan caches on launch.
  useEffect(() => {
    if (startedCleanup.current) return
    startedCleanup.current = true
    scanCleanup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-scan projects the first time that tab is opened.
  useEffect(() => {
    if (s.tab === 'projects' && !startedProjects.current) {
      startedProjects.current = true
      scanProjects('~')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.tab])

  const t = activeTab(s)
  const setSelection = (sel: Set<string>) => dispatch({ type: 'setSelection', selection: sel })
  const onToggle = (id: string) => setSelection(toggle(t.selection, id, t.items))
  const onToggleGroup = (tier: Tier) => setSelection(toggleGroup(t.selection, t.items, tier))

  // Seed the per-tab default selection as items stream in (while nothing chosen yet).
  useEffect(() => {
    if (t.items.length === 0 || t.selection.size > 0) return
    setSelection(s.tab === 'projects' ? staleSelection(t.items, nowSecs()) : defaultSelection(t.items))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.tab, t.items.length])

  const doClean = () => {
    const ids = selectedIds(t.selection)
    dispatch({ type: 'startClean', ids })
    window.dscan.send({ cmd: 'clean', ids })
  }
  const onChangeFolder = async () => {
    const dir = await window.dscan.pickFolder()
    if (dir) scanProjects(dir)
  }

  return (
    <div className="flex h-screen flex-col text-ink">
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
        <div className="border-t border-line bg-surface px-5 py-2 text-[12.5px] text-safe">
          Reclaimed {humanBytes(s.result.freed + s.result.trashed)}
          {s.result.errors.length > 0 && ` · ${s.result.errors.length} skipped`}
        </div>
      )}
    </div>
  )
}
