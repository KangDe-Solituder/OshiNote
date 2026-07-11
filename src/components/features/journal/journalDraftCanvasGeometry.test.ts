import { describe, expect, it } from 'vitest'
import { angleFromCenter, getDraggedLayout, resizeLayout, type FrameDragState } from './journalDraftCanvasGeometry'

const baseDrag: FrameDragState = {
  pointerId: 1,
  mode: 'move',
  startClientX: 100,
  startClientY: 100,
  startLayout: { x: 50, y: 60, width: 200, height: 120, rotation: 0 },
  moved: false,
}

describe('journalDraftCanvasGeometry', () => {
  it('converts pointer movement through zoom before moving items', () => {
    const result = getDraggedLayout(baseDrag, { clientX: 140, clientY: 120 }, 0.5, 'portrait', undefined, null)
    expect(result.x).toBe(130)
    expect(result.y).toBe(100)
  })

  it('resizes from west and north while preserving the opposite edge', () => {
    expect(resizeLayout(baseDrag.startLayout, 'nw', 20, 10)).toEqual({ x: 70, y: 70, width: 180, height: 110, rotation: 0 })
  })

  it('calculates rotation angle around an item center', () => {
    expect(Math.round(angleFromCenter(100, 0, { x: 0, y: 0 }))).toBe(90)
    expect(Math.round(angleFromCenter(0, 100, { x: 0, y: 0 }))).toBe(180)
  })

  it('clamps resized items to minimum constraints', () => {
    const drag: FrameDragState = { ...baseDrag, mode: 'resize', handle: 'se' }
    const result = getDraggedLayout(drag, { clientX: -200, clientY: -200 }, 1, 'portrait', { minWidth: 80, minHeight: 60 }, null)
    expect(result.width).toBe(80)
    expect(result.height).toBe(60)
  })
})
