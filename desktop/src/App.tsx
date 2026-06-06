import { useEffect, useReducer, useRef } from 'react'
import { reduce, initialState } from './state'
import { toggle, toggleGroup, selectedIds, selectedTotal } from './lib/selection'
import type { Tier } from './lib/protocol'
import { HeroBar } from './components/HeroBar'
import { Group } from './components/Group'
import { ScanProgress } from './components/ScanProgress'
import { ConfirmScreen } from './components/ConfirmScreen'
import { DoneScreen } from './components/DoneScreen'
import type { DscanEvent, Request } from './lib/protocol'

declare global {
  interface Window {
    dscan: {
      send: (r: Request) => void
      onEvent: (cb: (e: DscanEvent) => void) => () => void
    }
  }
}

export default function App() {
  const [s, dispatch] = useReducer(reduce, undefined, initialState)

  useEffect(() => window.dscan.onEvent((e) => dispatch({ type: 'event', event: e })), [])

  const startScan = () => {
    dispatch({ type: 'startScan' })
    window.dscan.send({ cmd: 'scan' })
  }

  const didStart = useRef(false)
  useEffect(() => {
    if (didStart.current) return // StrictMode invokes mount effects twice
    didStart.current = true
    startScan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onToggle = (id: string) =>
    dispatch({ type: 'setSelection', selection: toggle(s.selection, id, s.items) })

  const onToggleGroup = (tier: Tier) =>
    dispatch({ type: 'setSelection', selection: toggleGroup(s.selection, s.items, tier) })

  const deleteBytes = s.items
    .filter((i) => s.selection.has(i.id) && i.method === 'remove')
    .reduce((n, i) => n + i.bytes, 0)
  const trashBytes = s.items
    .filter((i) => s.selection.has(i.id) && i.method === 'trash')
    .reduce((n, i) => n + i.bytes, 0)

  const doClean = () => window.dscan.send({ cmd: 'clean', ids: selectedIds(s.selection) })

  return (
    <div className="flex h-screen flex-col text-ink">
      {s.phase === 'scanning' && (
        <ScanProgress scanned={s.scanned} onCancel={() => window.dscan.send({ cmd: 'cancel' })} />
      )}
      {s.phase === 'list' && (
        <>
          <HeroBar
            reclaimable={selectedTotal(s.items, s.selection)}
            disk={s.disk}
            onClean={() => dispatch({ type: 'toGate' })}
          />
          <div className="flex-1 overflow-y-auto pb-6">
            {(['SAFE', 'REVIEW', 'KEEP'] as const).map((t) => (
              <Group
                key={t}
                tier={t}
                items={s.items}
                selection={s.selection}
                onToggle={onToggle}
                onToggleGroup={onToggleGroup}
              />
            ))}
          </div>
        </>
      )}
      {s.phase === 'confirm' && (
        <ConfirmScreen
          deleteBytes={deleteBytes}
          trashBytes={trashBytes}
          count={s.selection.size}
          onConfirm={doClean}
          onBack={() => dispatch({ type: 'back' })}
        />
      )}
      {s.phase === 'done' && s.result && <DoneScreen result={s.result} onAgain={startScan} />}
    </div>
  )
}
