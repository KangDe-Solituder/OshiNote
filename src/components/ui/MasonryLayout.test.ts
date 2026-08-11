import { describe, expect, it } from 'vitest'
import { calculateMasonryLayout } from './masonryLayoutGeometry'

describe('calculateMasonryLayout', () => {
  it('fills the shortest column while preserving input placement order', () => {
    const layout = calculateMasonryLayout([100, 220, 80, 60], 2, 100, 12)

    expect(layout.positions).toEqual([
      { x: 0, y: 0 },
      { x: 112, y: 0 },
      { x: 0, y: 112 },
      { x: 0, y: 204 },
    ])
    expect(layout.height).toBe(264)
  })

  it('uses left-to-right columns when their heights are tied', () => {
    const layout = calculateMasonryLayout([100, 100, 50, 50], 2, 100, 12)

    expect(layout.positions).toEqual([
      { x: 0, y: 0 },
      { x: 112, y: 0 },
      { x: 0, y: 112 },
      { x: 112, y: 112 },
    ])
    expect(layout.height).toBe(162)
  })
})
