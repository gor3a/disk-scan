import { useEffect, useRef, useState } from 'react'
import { Cpu, ExternalLink, Trash2, Search } from 'lucide-react'
import type { AppDTO, Leftover } from '../lib/protocol'
import { archBadge, sortApps, uninstallTotal } from '../lib/apps'
import { humanBytes } from '../lib/format'
import { Modal } from './Modal'

const TONE: Record<string, string> = {
  warn: 'bg-[#f3d9a4] text-[#7a4a00]',
  accent: 'bg-accent/15 text-accent-deep',
  neutral: 'border border-line text-ink-soft',
  muted: 'text-ink-soft',
}

export function AppsView({
  apps,
  scanning,
  leftovers,
  onReveal,
  onFindNative,
  onRequestLeftovers,
  onUninstall,
}: {
  apps: AppDTO[]
  scanning: boolean
  leftovers: Leftover[]
  onReveal: (path: string) => void
  onFindNative: (name: string) => void
  onRequestLeftovers: (path: string) => void
  onUninstall: (paths: string[]) => void
}) {
  const [target, setTarget] = useState<AppDTO | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Which target we've already applied the default leftover selection for, so
  // it fires once per modal open and never re-selects after a manual deselect.
  const defaultedFor = useRef<string | null>(null)

  const sorted = sortApps(apps)
  const intelCount = apps.filter((a) => a.arch === 'intel').length

  const openUninstall = (app: AppDTO) => {
    setTarget(app)
    setSelected(new Set())
    onRequestLeftovers(app.path)
  }
  // Default-select all leftovers once they arrive for the open target.
  useEffect(() => {
    if (target && leftovers.length && defaultedFor.current !== target.path) {
      defaultedFor.current = target.path
      setSelected(new Set(leftovers.map((l) => l.path)))
    }
  }, [target, leftovers])
  const toggle = (p: string) =>
    setSelected((s) => {
      const n = new Set(s)
      n.has(p) ? n.delete(p) : n.add(p)
      return n
    })
  const confirm = () => {
    if (!target) return
    onUninstall([target.path, ...leftovers.filter((l) => selected.has(l.path)).map((l) => l.path)])
    setTarget(null)
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-5 pb-6">
      <div className="my-3 flex items-center gap-2 text-[12.5px] text-ink-soft">
        <Cpu size={15} strokeWidth={1.75} />
        {scanning ? (
          <span>Scanning applications…</span>
        ) : (
          <span>
            {apps.length} apps · <span className="font-semibold text-[#7a4a00]">{intelCount} Intel-only</span> run
            under Rosetta
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        {sorted.map((app) => {
          const b = archBadge(app.arch)
          return (
            <div
              key={app.id}
              className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2 text-[13px]"
            >
              <span className="min-w-0 flex-1 truncate font-semibold text-ink">{app.name}</span>
              <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${TONE[b.tone]}`}>
                {b.label}
              </span>
              <span className="w-20 shrink-0 text-right font-mono text-[11.5px] text-ink-soft">
                {humanBytes(app.bytes)}
              </span>
              <span className="flex shrink-0 gap-1">
                <button
                  onClick={() => onReveal(app.path)}
                  title="Reveal in Finder"
                  className="rounded-md p-1.5 text-ink hover:bg-paper"
                >
                  <ExternalLink size={14} strokeWidth={1.75} />
                </button>
                {b.flagged && (
                  <button
                    onClick={() => onFindNative(app.name)}
                    title="Find Apple Silicon version"
                    className="rounded-md p-1.5 text-accent-deep hover:bg-paper"
                  >
                    <Search size={14} strokeWidth={1.75} />
                  </button>
                )}
                <button
                  onClick={() => openUninstall(app)}
                  title="Uninstall"
                  className="rounded-md p-1.5 text-[#b91c1c] hover:bg-paper"
                >
                  <Trash2 size={14} strokeWidth={1.75} />
                </button>
              </span>
            </div>
          )
        })}
      </div>

      {target && (
        <Modal onClose={() => setTarget(null)}>
          <h2 className="font-display text-xl text-ink">Uninstall {target.name}?</h2>
          <p className="mt-2 text-[13px] text-ink-soft">
            These items will be moved to the Trash. You can restore them from there.
          </p>
          <div className="mt-3 max-h-56 overflow-y-auto rounded-xl border border-line">
            <label className="flex items-center gap-2 border-b border-line px-3 py-2 text-[12.5px]">
              <input type="checkbox" checked readOnly />
              <span className="min-w-0 flex-1 truncate font-mono text-ink">{target.path}</span>
              <span className="font-mono text-ink-soft">{humanBytes(target.bytes)}</span>
            </label>
            {leftovers.map((l) => (
              <label key={l.path} className="flex items-center gap-2 px-3 py-2 text-[12.5px]">
                <input type="checkbox" checked={selected.has(l.path)} onChange={() => toggle(l.path)} />
                <span className="min-w-0 flex-1 truncate font-mono text-ink-soft">{l.path}</span>
                <span className="font-mono text-ink-soft">{humanBytes(l.bytes)}</span>
              </label>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-[12.5px] text-ink-soft">
              Total: {humanBytes(uninstallTotal(target, leftovers, selected))}
            </span>
            <button
              onClick={() => setTarget(null)}
              className="ml-auto rounded-xl border border-line px-4 py-2.5 font-semibold text-ink"
            >
              Cancel
            </button>
            <button
              onClick={confirm}
              className="rounded-xl bg-[#b91c1c] px-4 py-2.5 font-semibold text-white"
            >
              Move to Trash
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
