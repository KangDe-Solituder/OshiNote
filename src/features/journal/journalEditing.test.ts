import { describe, expect, it } from 'vitest'
import type { JournalDraftItem } from '../../types'
import { moveDraftGroup, reorderDraftLayer } from './journalEditing'
import { clampLayout } from './journalLayout'

function item(id: string, x: number, zIndex: number, rotation = 0): JournalDraftItem {
  return { draftId: id, itemType: 'material', materialId: 'heart', x, y: 100, width: 80, height: 60, rotation, zIndex }
}

describe('journal editing', () => {
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
