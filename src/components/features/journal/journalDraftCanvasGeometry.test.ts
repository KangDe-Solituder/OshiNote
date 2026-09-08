import { describe, expect, it } from 'vitest'
import { angleFromCenter, getDraggedLayout, getResizeCursor, getResizeCursorClass, resizeLayout, RESIZE_HANDLES, type FrameDragState } from './journalDraftCanvasGeometry'

const baseDrag: FrameDragState = {
  pointerId: 1,
  mode: 'move',
  startClientX: 100,
  startClientY: 100,
  startLayout: { x: 50, y: 60, width: 200, height: 120, rotation: 0 },
  moved: false,
}

describe('journalDraftCanvasGeometry', () => {
  function point(layout: FrameDragState['startLayout'], localX: number, localY: number) {
    const angle = layout.rotation * Math.PI / 180
    return {
      x: layout.x + layout.width / 2 + localX * Math.cos(angle) - localY * Math.sin(angle),
      y: layout.y + layout.height / 2 + localX * Math.sin(angle) + localY * Math.cos(angle),
    }
  }

  for (const rotation of [0, 17, 45, 90, 137, -32, 270]) {
    for (const handle of RESIZE_HANDLES) {
      it(`keeps the opposite anchor fixed for ${handle} at ${rotation} degrees, including size limits`, () => {
        const start = { x: 220, y: 240, width: 200, height: 150, rotation }
        const hx = handle.includes('e') ? 1 : handle.includes('w') ? -1 : 0
        const hy = handle.includes('s') ? 1 : handle.includes('n') ? -1 : 0
        const anchor = point(start, -hx * start.width / 2, -hy * start.height / 2)
        for (const distance of [40, -2000, 2000]) {
          const radians = rotation * Math.PI / 180
          const dx = hx * distance * Math.cos(radians) - hy * distance * Math.sin(radians)
          const dy = hx * distance * Math.sin(radians) + hy * distance * Math.cos(radians)
          const result = getDraggedLayout({ ...baseDrag, mode: 'resize', handle, startLayout: start }, { clientX: 100 + dx * 0.72, clientY: 100 + dy * 0.72 }, 0.72, 'portrait', { minWidth: 80, minHeight: 60 }, null)
          const after = point(result, -hx * result.width / 2, -hy * result.height / 2)
          expect(after.x).toBeCloseTo(anchor.x)
          expect(after.y).toBeCloseTo(anchor.y)
          expect(result.width).toBeGreaterThanOrEqual(80)
          expect(result.height).toBeGreaterThanOrEqual(60)
          if (!hx) expect(result.width).toBe(200)
          if (!hy) expect(result.height).toBe(150)
          if (distance === 40) {
            expect(result.width).toBeCloseTo(200 + (hx ? 40 : 0))
            expect(result.height).toBeCloseTo(150 + (hy ? 40 : 0))
          }
        }
      })
    }
  }

  it('ignores movement tangent to a rotated edge', () => {
    const angle = 23 * Math.PI / 180
    const start = { ...baseDrag.startLayout, rotation: 23 }
    const result = resizeLayout(start, 'e', -70 * Math.sin(angle), 70 * Math.cos(angle))
    expect(result.x).toBeCloseTo(start.x)
    expect(result.y).toBeCloseTo(start.y)
    expect(result.width).toBeCloseTo(start.width)
    expect(result.height).toBeCloseTo(start.height)
  })

  it('uses an exact-angle cursor for non-45-degree rotations', () => {
    expect(decodeURIComponent(getResizeCursor('e', 23))).toContain('rotate(23 16 16)')
    expect(decodeURIComponent(getResizeCursor('n', 23))).toContain('rotate(293 16 16)')
  })
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

  it('keeps the resize cursor aligned with the edge normal after rotation', () => {
    expect(getResizeCursorClass('e', 0)).toBe('cursor-ew-resize')
    expect(getResizeCursorClass('e', 90)).toBe('cursor-ns-resize')
    expect(getResizeCursorClass('n', 90)).toBe('cursor-ew-resize')
    expect(getResizeCursorClass('se', -45)).toBe('cursor-ew-resize')
    expect(getResizeCursorClass('e', 135)).toBe('cursor-nesw-resize')
    expect(getResizeCursorClass('e', 200)).toBe('cursor-ew-resize')
    expect(getResizeCursorClass('w', 360)).toBe('cursor-ew-resize')
  })
})
