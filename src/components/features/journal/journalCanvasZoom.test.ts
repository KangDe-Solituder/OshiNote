import { describe, expect, it } from 'vitest'
import { JOURNAL_ZOOM_MAX, JOURNAL_ZOOM_MIN, getJournalWheelZoom } from './journalCanvasZoom'

describe('journal canvas wheel zoom', () => {
  it('zooms in when scrolling up and out when scrolling down', () => {
    expect(getJournalWheelZoom(1, -100)).toBeGreaterThan(1)
    expect(getJournalWheelZoom(1, 100)).toBeLessThan(1)
  })

  it('keeps wheel zoom within the canvas zoom range', () => {
    expect(getJournalWheelZoom(JOURNAL_ZOOM_MAX, -1000)).toBe(JOURNAL_ZOOM_MAX)
    expect(getJournalWheelZoom(JOURNAL_ZOOM_MIN, 1000)).toBe(JOURNAL_ZOOM_MIN)
  })
})
