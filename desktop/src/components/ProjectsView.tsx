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
  const total = items.reduce((n, i) => n + i.bytes, 0)
  return (
    <div className="flex-1 overflow-y-auto px-5 pb-6">
      <div className="my-3 flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-[12.5px]">
        <span>📁</span>
        <span className="font-mono text-ink-soft">{root}</span>
        <span className="text-ink-soft/70">— folder searched for node_modules</span>
        <button onClick={onChangeFolder} className="ml-auto font-semibold text-accent">
          Change…
        </button>
      </div>
      <div className="mb-1 mt-2 text-[11px] font-bold tracking-wider text-ink-soft">
        PROJECTS · {items.length} found · {humanBytes(total)}
      </div>
      {items.map((i) => (
        <ProjectRow
          key={i.id}
          item={i}
          checked={selection.has(i.id)}
          nowSecs={nowSecs}
          onToggle={onToggle}
        />
      ))}
    </div>
  )
}
