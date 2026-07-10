import { describe, expect, it } from 'vitest'
import { draftItemToLayout, getDefaultIllustrationItemSize, getDraftItemConstraints } from './journalItemSizing'
import type { JournalDraftItem } from '../../types'

describe('journalItemSizing', () => {
  it('scales portrait and landscape illustrations within max side', () => {
    expect(getDefaultIllustrationItemSize({ width: 800, height: 1200 })).toEqual({ width: 213, height: 320 })
    expect(getDefaultIllustrationItemSize({ width: 1200, height: 600 })).toEqual({ width: 320, height: 160 })
  })

  it('keeps fallback size when image dimensions are unknown', () => {
    expect(getDefaultIllustrationItemSize({ width: null, height: null }, { width: 240, height: 180 })).toEqual({ width: 240, height: 180 })
  })

  it('returns material and note constraints', () => {
    const tape: JournalDraftItem = {
      draftId: 'draft-1',
      itemType: 'material',
      materialId: 'washi-lilac',
      x: 0,
      y: 0,
      width: 180,
      height: 36,
      rotation: 0,
      zIndex: 1,
    }
    const note: JournalDraftItem = { ...tape, draftId: 'draft-2', itemType: 'note', materialId: undefined }

    expect(getDraftItemConstraints(tape)).toEqual({ minWidth: 90, minHeight: 18 })
    expect(getDraftItemConstraints(note)).toEqual({ minWidth: 120, minHeight: 90 })
  })

  it('maps draft item layout for persistence', () => {
    const item: JournalDraftItem = {
      draftId: 'draft-1',
      itemType: 'illustration',
      sourceId: 'illustration-1',
      x: 10,
      y: 20,
      width: 300,
      height: 200,
      rotation: -3,
      zIndex: 7,
    }

    expect(draftItemToLayout(item)).toEqual({ x: 10, y: 20, width: 300, height: 200, rotation: -3, z_index: 7 })
  })
})
