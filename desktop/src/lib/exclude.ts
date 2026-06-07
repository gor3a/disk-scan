import type { ItemDTO } from './protocol'

export function isExcluded(path: string, excludes: string[]): boolean {
  return excludes.some((e) => e !== '' && (path === e || path.startsWith(e + '/')))
}

// excludeTargetFor returns the folder to exclude when the user excludes a row:
// the project dir (parent of the artifact) for projects, else the item path.
export function excludeTargetFor(item: ItemDTO): string {
  if (item.kind) return item.path.slice(0, item.path.lastIndexOf('/')) || '/'
  return item.path
}
