import { describe, it, expect } from 'vitest'
import { squarify } from './treemap'
import type { TreeNode } from './protocol'

const n = (bytes: number): TreeNode => ({ name: String(bytes), path: '/' + bytes, bytes, dir: false })
const R = { x: 0, y: 0, w: 100, h: 100 }

describe('squarify', () => {
  it('tiles the rect proportionally, within bounds, no gaps', () => {
    const nodes = [n(40), n(30), n(20), n(10)]
    const placed = squarify(nodes, R)
    expect(placed).toHaveLength(4)
    const total = R.w * R.h
    for (const p of placed) {
      expect(p.x).toBeGreaterThanOrEqual(-0.01)
      expect(p.y).toBeGreaterThanOrEqual(-0.01)
      expect(p.x + p.w).toBeLessThanOrEqual(R.w + 0.01)
      expect(p.y + p.h).toBeLessThanOrEqual(R.h + 0.01)
    }
    const area = placed.reduce((s, p) => s + p.w * p.h, 0)
    expect(area).toBeCloseTo(total, -1)
    const big = placed.find((p) => p.node.bytes === 40)!
    expect(big.w * big.h).toBeCloseTo(0.4 * total, -1)
  })
  it('handles empty and single', () => {
    expect(squarify([], R)).toEqual([])
    expect(squarify([n(5)], R)).toHaveLength(1)
  })
})
