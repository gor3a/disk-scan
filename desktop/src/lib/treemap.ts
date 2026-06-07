import type { TreeNode } from './protocol'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}
export interface Placed extends Rect {
  node: TreeNode
}

// squarify lays children out as a squarified treemap (Bruls et al.) inside rect.
export function squarify(nodes: TreeNode[], rect: Rect): Placed[] {
  const items = nodes.filter((n) => n.bytes > 0)
  if (items.length === 0 || rect.w <= 0 || rect.h <= 0) return []
  const total = items.reduce((s, n) => s + n.bytes, 0)
  const scale = (rect.w * rect.h) / total
  const data = items.map((n) => ({ node: n, area: n.bytes * scale }))

  const placed: Placed[] = []
  let free = { ...rect }
  let row: { node: TreeNode; area: number }[] = []
  const side = () => Math.min(free.w, free.h)

  const worst = (r: { area: number }[]): number => {
    if (r.length === 0) return Infinity
    const s = side()
    const sum = r.reduce((a, b) => a + b.area, 0)
    let max = -Infinity
    let min = Infinity
    for (const x of r) {
      if (x.area > max) max = x.area
      if (x.area < min) min = x.area
    }
    return Math.max((s * s * max) / (sum * sum), (sum * sum) / (s * s * min))
  }

  const flush = () => {
    const sum = row.reduce((a, b) => a + b.area, 0)
    const thick = sum / side()
    if (free.w >= free.h) {
      let off = free.y
      for (const r of row) {
        const hh = r.area / thick
        placed.push({ node: r.node, x: free.x, y: off, w: thick, h: hh })
        off += hh
      }
      free = { x: free.x + thick, y: free.y, w: free.w - thick, h: free.h }
    } else {
      let off = free.x
      for (const r of row) {
        const ww = r.area / thick
        placed.push({ node: r.node, x: off, y: free.y, w: ww, h: thick })
        off += ww
      }
      free = { x: free.x, y: free.y + thick, w: free.w, h: free.h - thick }
    }
    row = []
  }

  let i = 0
  while (i < data.length) {
    const next = data[i]
    if (row.length === 0 || worst([...row, next]) <= worst(row)) {
      row.push(next)
      i++
    } else {
      flush()
    }
  }
  if (row.length) flush()
  return placed
}
