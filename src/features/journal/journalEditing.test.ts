import { describe, expect, it } from 'vitest'
import type { JournalDraftItem } from '../../types'
import { arrangeDraftItems, getDraftSizeLimits, isAspectLocked, moveDraftGroup, reorderDraftLayer, resizeDraftItem } from './journalEditing'
import { clampLayout } from './journalLayout'

function item(id: string, x: number, zIndex: number, rotation = 0): JournalDraftItem {
  return { draftId: id, itemType: 'material', materialId: 'heart', x, y: 100, width: 80, height: 60, rotation, zIndex }
}

describe('journal editing', () => {
  it('resizes images with one scale at either limit without moving their position', () => {
    const image = { ...item('image', 620, 1), itemType: 'image' as const, materialId: undefined, width: 200, height: 400 }
    const resized = resizeDraftItem(image, { width: 900 }, 'landscape')
    expect(resized.width / resized.height).toBe(0.5)
    expect(resized.height).toBe(664)
    expect(resized.x).toBe(image.x)
    expect(resized.y).toBe(image.y)
    expect(getDraftSizeLimits(image, 'landscape').maxWidth).toBe(332)
    expect(resizeDraftItem(image, { width: 1 }, 'landscape').width).toBe(80)
    expect(isAspectLocked(image)).toBe(true)
  })
  it('allows independent dimensions after unlocking the aspect ratio', () => {
    const source = { ...item('a', 100, 1), stylePayload: '{"aspectLocked":false}' }
    expect(resizeDraftItem(source, { width: 200 }, 'landscape')).toMatchObject({ width: 200, height: 60, x: 100, y: 100 })
  })
  it('aligns and distributes uneven widths while leaving locked items untouched', () => {
    const selection = [item('a', 100, 1), { ...item('b', 280, 2), width: 120 }, item('c', 500, 3), { ...item('locked', 10, 4), stylePayload: '{"locked":true}' }]
    const aligned = arrangeDraftItems(selection, 'left', 'landscape')
    expect(aligned.map(i => i.x)).toEqual([100, 100, 100, 10])
    const distributed = arrangeDraftItems(selection, 'horizontal', 'landscape')
    expect(distributed[1].x - distributed[0].x - distributed[0].width).toBe(distributed[2].x - distributed[1].x - distributed[1].width)
    expect(distributed[0].x).toBe(100)
    expect(distributed[2].x).toBe(500)
    expect(distributed[3]).toEqual(selection[3])
  })
  it('moves exactly one layer despite gaps and duplicate old z indices', () => {
    const items = [item('a', 100, 10), item('b', 200, 10), item('c', 300, 90)]
    const up = reorderDraftLayer(items, 'a', 'up')
    expect([...up].sort((a, b) => a.zIndex - b.zIndex).map((i) => i.draftId)).toEqual(['b', 'a', 'c'])
    expect(reorderDraftLayer(up, 'a', 'down').map((i) => i.zIndex)).toEqual([1, 2, 3])
    expect(reorderDraftLayer(items, 'a', 'top').find((i) => i.draftId === 'a')?.zIndex).toBe(3)
    expect(reorderDraftLayer(items, 'c', 'bottom').find((i) => i.draftId === 'c')?.zIndex).toBe(1)
  })

  it('does not include staged resources in the page layers', () => {
    const staged = { ...item('staged', 0, 100), staged: true }
    const result = reorderDraftLayer([item('a', 100, 5), staged], 'a', 'top')
    expect(result[0].zIndex).toBe(1)
    expect(result[1]).toEqual(staged)
  })

  it.each([[2000, 2000], [-2000, -2000], [45, -20]])('preserves relative positions at delta %s, %s', (dx, dy) => {
    const items = [item('a', 100, 1, 45), item('b', 250, 2, -90)]
    const moved = moveDraftGroup(items, dx, dy, 'landscape')
    expect(moved[1].x - moved[0].x).toBe(150)
    expect(moved[1].y - moved[0].y).toBe(0)
    expect(moved.map((i) => i.rotation)).toEqual([45, -90])
    expect(items[0].x).toBe(100)
  })

  it('keeps rotations past 18 degrees through layout edits', () => {
    for (const rotation of [-270, -90, 45, 180, 360]) {
      expect(clampLayout({ x: 100, y: 100, width: 250, height: 180, rotation }).rotation).toBe(rotation)
    }
  })
})
