import { useEffect, useState } from 'react'
import { Map as MapIcon, ChevronRight, ExternalLink, Ban, Trash2 } from 'lucide-react'
import type { TreeNode } from '../lib/protocol'
import { squarify } from '../lib/treemap'
import { humanBytes } from '../lib/format'

// warm depth-tinted palette (emerald → sand), cycled per tile in a level
const SHADES = ['#1f7a5c', '#2f8d6c', '#3f9a78', '#b06d10', '#c98a2a', '#8a8076']
const BOX = { x: 0, y: 0, w: 1000, h: 600 } // layout space; tiles positioned in %

export function MapView({
  tree,
  scanning,
  scanned,
  bytes,
  currentPath,
  root,
  onChangeFolder,
  onReveal,
  onExclude,
  onTrash,
}: {
  tree: TreeNode | null
  scanning: boolean
  scanned: number
  bytes: number
  currentPath?: string
  root: string
  onChangeFolder: () => void
  onReveal: (path: string) => void
  onExclude: (path: string) => void
  onTrash: (node: TreeNode) => void
}) {
  const [stack, setStack] = useState<TreeNode[]>([])
  const [selected, setSelected] = useState<TreeNode | null>(null)
  const [hover, setHover] = useState<TreeNode | null>(null)

  // Reset drill state whenever a new tree arrives (re-scan).
  useEffect(() => {
    setStack([])
    setSelected(null)
  }, [tree])

  const current = stack.length ? stack[stack.length - 1] : tree
  const children = current?.children ?? []
  const placed = squarify(children, BOX)
  const rootName = root === '' || root === '~' ? 'Home' : root.split('/').pop() || root

  const drill = (node: TreeNode) => {
    if (node.dir && node.children && node.children.length) {
      setStack((s) => [...s, node])
      setSelected(null)
    } else if (node.path) {
      setSelected(node)
    }
  }

  return (
    <div className="flex flex-1 flex-col px-5 pb-5">
      <div className="my-3 flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-[12.5px]">
        <MapIcon size={15} strokeWidth={1.75} className="text-ink-soft" />
        <button onClick={() => setStack([])} className="font-semibold text-accent">
          {rootName}
        </button>
        {stack.map((n, idx) => (
          <button
            key={n.path}
            onClick={() => setStack(stack.slice(0, idx + 1))}
            className="flex items-center text-ink-soft hover:text-ink"
          >
            <ChevronRight size={13} strokeWidth={1.75} />
            {n.name}
          </button>
        ))}
        <span className="ml-auto truncate font-mono text-[11px] text-ink-soft">
          {hover ? `${hover.path || hover.name} · ${humanBytes(hover.bytes)}` : root}
        </span>
        <button onClick={onChangeFolder} className="shrink-0 font-semibold text-accent">
          Change…
        </button>
      </div>

      {scanning ? (
        <div className="flex flex-1 items-center justify-center text-[13px] text-ink-soft">
          Mapping… {scanned.toLocaleString()} files · {humanBytes(bytes)}
          {currentPath ? ` · ${currentPath}` : ''}
        </div>
      ) : !tree || children.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-[13px] text-ink-soft">
          Nothing to map here.
        </div>
      ) : (
        <div className="relative flex-1 overflow-hidden rounded-xl border border-line bg-paper">
          {placed.map((p, idx) => {
            const big = p.w > 70 && p.h > 30
            const node = p.node
            const clickable = (node.dir && (node.children?.length ?? 0) > 0) || !!node.path
            return (
              <div
                key={(node.path || node.name) + idx}
                onClick={() => drill(node)}
                onMouseEnter={() => setHover(node)}
                onMouseLeave={() => setHover((h) => (h === node ? null : h))}
                title={`${node.path || node.name} · ${humanBytes(node.bytes)}`}
                className={`absolute overflow-hidden border border-black/10 p-1.5 text-white ${
                  clickable ? 'cursor-pointer' : 'cursor-default'
                } ${selected === node ? 'ring-2 ring-white' : ''}`}
                style={{
                  left: `${(p.x / BOX.w) * 100}%`,
                  top: `${(p.y / BOX.h) * 100}%`,
                  width: `${(p.w / BOX.w) * 100}%`,
                  height: `${(p.h / BOX.h) * 100}%`,
                  background: SHADES[idx % SHADES.length],
                }}
              >
                {big && (
                  <>
                    <div className="truncate text-[11px] font-bold leading-tight">{node.name}</div>
                    <div className="font-mono text-[10px] opacity-80">{humanBytes(node.bytes)}</div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {selected && selected.path && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-[12px]">
          <span className="truncate font-mono text-ink-soft">{selected.path}</span>
          <span className="ml-auto flex shrink-0 gap-2">
            <button
              onClick={() => onReveal(selected.path)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 font-semibold text-ink hover:bg-paper"
            >
              <ExternalLink size={14} strokeWidth={1.75} /> Reveal
            </button>
            <button
              onClick={() => onExclude(selected.path)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 font-semibold text-ink hover:bg-paper"
            >
              <Ban size={14} strokeWidth={1.75} /> Exclude
            </button>
            <button
              onClick={() => onTrash(selected)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 font-semibold text-[#b91c1c] hover:bg-paper"
            >
              <Trash2 size={14} strokeWidth={1.75} /> Move to Trash
            </button>
          </span>
        </div>
      )}
    </div>
  )
}
