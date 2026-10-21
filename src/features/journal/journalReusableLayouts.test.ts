import { describe, expect, it } from 'vitest'
import { captureJournalLayout, readReusableLayout } from './journalReusableLayouts'
import { applyJournalPageTemplate, getAvailableTemplateSlot, registerJournalTemplate } from './journalPageTemplates'
import type { JournalCompositionDraft } from './journalDraftAdapters'
import type { ResourceTemplate } from '../../types'

describe('reusable journal layouts', () => {
  const item = { draftId: 'old-id', originItemId: 'db-id', sourceId: 'old-note', itemType: 'note' as const, x: 20, y: 40, width: 400, height: 150, rotation: -4, zIndex: 7, stylePayload: JSON.stringify({ noteCard: { titleText: 'old title', bodyText: 'old words', fontSize: 18, backgroundColor: '#fff' } }) }
  const draft: JournalCompositionDraft = { oshiId: 'one', title: 'week', dateLabel: '', description: '', background: 'sakura', orientation: 'landscape', stamp: null, items: [item, { ...item, draftId: 'picture', itemType: 'image', stylePayload: '{}' }, { ...item, draftId: 'paper', itemType: 'material', materialId: 'memo-pink' }, { ...item, draftId: 'reserve', staged: true }] }
  it('captures layout and typography without old content, identities or reserve items', () => {
    const layout = captureJournalLayout(draft, 'mine', 'My week')
    expect(layout.slots).toHaveLength(2)
    expect(layout.decorations).toHaveLength(1)
    const json = JSON.stringify(layout)
    expect(json).not.toContain('old words')
    expect(json).not.toContain('old-note')
    expect(json).not.toContain('db-id')
    expect(layout.slots[0].styleOverrides?.noteCard).toEqual({ fontSize: 18, backgroundColor: '#fff' })
    expect(layout.decorations[0].styleOverrides?.noteCard).toMatchObject({ titleText: '', bodyText: '' })
    expect(JSON.parse(draft.items[0].stylePayload || '{}').noteCard.bodyText).toBe('old words')
  })
  it('supports imported images and releases a slot when its item is staged', () => {
    const layout = registerJournalTemplate(captureJournalLayout(draft, 'reuse-test', 'Test'))
    const result = applyJournalPageTemplate(layout.id, [{ ...item, itemType: 'image', staged: true }])
    const image = result.items.find(i => i.itemType === 'image')!
    expect(image.staged).toBe(false)
    expect(image.templateSlotId).toBe(layout.slots[1].id)
    expect(getAvailableTemplateSlot(layout.id, [{ ...image, staged: true }], 'illustration', 'landscape')?.id).toBe(image.templateSlotId)
  })
  it('registers a saved template by its database identity and rejects invalid geometry', () => {
    const layout = captureJournalLayout(draft, 'temporary', 'My week')
    const resource = { id: 'db-template', name: 'Saved name', payload: JSON.stringify({ version: 1, layout }) } as ResourceTemplate
    expect(readReusableLayout(resource)?.id).toBe('db-template')
    expect(readReusableLayout({ ...resource, payload: JSON.stringify({ version: 1, layout: { ...layout, slots: [{ layout: null }] } }) })).toBeNull()
  })
})
