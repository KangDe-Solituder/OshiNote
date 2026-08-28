import { describe, expect, it } from 'vitest'
import { collectSupersededIllustrationPaths, normalizeLegacySyncRecord } from './syncDataset'

describe('normalizeLegacySyncRecord', () => {
  it('fills schema 2 defaults for schema 1 oshi records', () => {
    expect(normalizeLegacySyncRecord('oshis', { id: 'oshi-1', name: 'A' })).toEqual({
      id: 'oshi-1',
      name: 'A',
      anniversaries: '[]',
    })
  })

  it('fills staged for schema 1 journal items without overwriting schema 2 values', () => {
    expect(normalizeLegacySyncRecord('journal_items', { id: 'item-1' }).staged).toBe(0)
    expect(normalizeLegacySyncRecord('journal_items', { id: 'item-2', staged: 1 }).staged).toBe(1)
  })

  it('does not add schema-specific fields to unrelated tables', () => {
    expect(normalizeLegacySyncRecord('notes', { id: 'note-1' })).toEqual({ id: 'note-1' })
  })
})

describe('collectSupersededIllustrationPaths', () => {
  it('returns both original and thumbnail paths when an illustration is deleted', () => {
    expect(collectSupersededIllustrationPaths(
      { original_path: 'media/illustrations/original.png', thumbnail_path: 'media/illustrations/thumb.webp' },
      { original_path: null, thumbnail_path: null }
    )).toEqual(['media/illustrations/original.png', 'media/illustrations/thumb.webp'])
  })

  it('keeps media paths that are unchanged', () => {
    const current = { original_path: 'media/illustrations/original.png', thumbnail_path: 'media/illustrations/thumb.webp' }
    expect(collectSupersededIllustrationPaths(current, current)).toEqual([])
  })
})
