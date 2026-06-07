import type { ItemDTO } from '../lib/protocol'
import { humanBytes } from '../lib/format'
import { ProjectRow } from './ProjectRow'

export function ProjectsView({
  items,
  selection,
  root,
  nowSecs,
  onToggle,
  onChangeFolder,
}: {
  items: ItemDTO[]
  selection: Set<string>
  root: string
  nowSecs: number
  onToggle: (id: string) => void
  onChangeFolder: () => void
}) {
  const groups = new Map<string, ItemDTO[]>()
  for (const i of items) {
    const k = i.kind ?? 'node_modules'
    groups.set(k, [...(groups.get(k) ?? []), i])
  }
  return (
    <div className="flex-1 overflow-y-auto px-5 pb-6">
      <div className="my-3 flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-[12.5px]">
        <span>📁</span>
        <span className="font-mono text-ink-soft">{root}</span>
        <span className="text-ink-soft/70">— folder searched for project artifacts</span>
        <button onClick={onChangeFolder} className="ml-auto font-semibold text-accent">
          Change…
        </button>
      </div>
      {[...groups.entries()].map(([kind, rows]) => (
        <section key={kind}>
          <div className="mb-1 mt-3 text-[11px] font-bold tracking-wider text-ink-soft">
            {kind} · {rows.length} · {humanBytes(rows.reduce((n, i) => n + i.bytes, 0))}
          </div>
          {rows.map((i) => (
            <ProjectRow
              key={i.id}
              item={i}
              checked={selection.has(i.id)}
              nowSecs={nowSecs}
              onToggle={onToggle}
            />
          ))}
        </section>
      ))}
    </div>
  )
}
