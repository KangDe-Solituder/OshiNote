import { describe, expect, it } from 'vitest'
import { getAnchoredPopoverPosition, getElementAnchoredPopoverPosition } from './journalPopoverPosition'

describe('journalPopoverPosition', () => {
  it('places pointer anchored popovers on the side with more space', () => {
    const viewport = { width: 1000, height: 700 }

    expect(getAnchoredPopoverPosition({ clientX: 120, clientY: 300 }, { popoverWidth: 240, popoverHeight: 260, viewport }).left).toBe(132)
    expect(getAnchoredPopoverPosition({ clientX: 900, clientY: 300 }, { popoverWidth: 240, popoverHeight: 260, viewport }).left).toBe(648)
  })

  it('clamps pointer anchored popovers within the viewport', () => {
    const position = getAnchoredPopoverPosition(
      { clientX: 990, clientY: 690 },
      { popoverWidth: 280, popoverHeight: 260, viewport: { width: 1000, height: 700 } }
    )

    expect(position.left).toBe(698)
    expect(position.top).toBe(424)
  })

  it('anchors to element sides when pointer coordinates are absent', () => {
    expect(getElementAnchoredPopoverPosition(
      { left: 100, top: 120, width: 180, height: 80 },
      { popoverWidth: 240, popoverHeight: 220, viewport: { width: 800, height: 600 } }
    )).toEqual({ left: 292, top: 50 })
  })
})
