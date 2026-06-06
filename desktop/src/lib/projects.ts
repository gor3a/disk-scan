import type { ItemDTO } from './protocol'
import type { Selection } from './selection'

export const STALE_DAYS = 30

// staleSelection pre-checks projects untouched for more than STALE_DAYS.
export function staleSelection(items: ItemDTO[], nowSecs: number): Selection {
  const cutoff = nowSecs - STALE_DAYS * 86400
  return new Set(
    items
      .filter((i) => i.selectable && (i.modified ?? 0) > 0 && (i.modified ?? 0) < cutoff)
      .map((i) => i.id),
  )
}

// projectDisplay splits a node_modules path into the project name and its parent.
export function projectDisplay(nodeModulesPath: string): { name: string; parent: string } {
  const projectDir = nodeModulesPath.replace(/\/node_modules\/?$/, '')
  const slash = projectDir.lastIndexOf('/')
  return { name: projectDir.slice(slash + 1), parent: projectDir.slice(0, slash) || '/' }
}
