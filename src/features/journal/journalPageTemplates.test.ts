import { describe, expect, it } from 'vitest'
import type { JournalDraftItem } from '../../types'
import {
  JOURNAL_PAGE_TEMPLATES,
  applyJournalPageTemplate,
  createTemplateDecorationItems,
  getAvailableTemplateSlot,
  getJournalPageTemplateDefinition,
  getMaterializedTemplateSlots,
  materializeTemplateLayout,
  placeDraftItemInTemplateSlot,
  type JournalPageTemplateDefinition,
} from './journalPageTemplates'

function draft(overrides: Partial<JournalDraftItem> = {}): JournalDraftItem {
  return {
    draftId: 'draft-1',
    itemType: 'note',
    sourceId: 'note-1',
    x: 20,
    y: 30,
    width: 240,
    height: 180,
    rotation: 0,
    zIndex: 5,
    ...overrides,
  }
}

describe('journalPageTemplates', () => {
  it('materializes normalized layouts for portrait and landscape pages', () => {
    const normalized = { x: 0.1, y: 0.2, width: 0.5, height: 0.25, rotation: 3, zIndex: 4 }

    expect(materializeTemplateLayout(normalized, 'portrait')).toEqual({ x: 70, y: 196, width: 350, height: 245, rotation: 3, zIndex: 4 })
    expect(materializeTemplateLayout(normalized, 'landscape')).toEqual({ x: 98, y: 140, width: 490, height: 175, rotation: 3, zIndex: 4 })
  })

  it('provides five built-in templates with valid materials', () => {
    expect(JOURNAL_PAGE_TEMPLATES).toHaveLength(5)
    for (const template of JOURNAL_PAGE_TEMPLATES) {
      expect(createTemplateDecorationItems(template, () => `${template.id}-decoration`)).toHaveLength(template.decorations.length)
    }
  })

  it('ignores unknown decoration materials', () => {
    const template: JournalPageTemplateDefinition = {
      id: 'invalid-material',
      nameKey: 'templates.title',
      descriptionKey: 'templates.subtitle',
      preferredOrientation: 'portrait',
      background: 'paper',
      slots: [],
      decorations: [{ materialId: 'missing', layout: { x: 0, y: 0, width: 0.2, height: 0.1, rotation: 0, zIndex: 1 } }],
    }

    expect(createTemplateDecorationItems(template)).toEqual([])
  })

  it('finds only compatible unfilled slots at a drop point', () => {
    const slots = getMaterializedTemplateSlots('live-highlight', 'portrait')
    const imageSlot = slots.find((slot) => slot.kind === 'illustration')!
    const point = { x: imageSlot.layout.x + 10, y: imageSlot.layout.y + 10 }

    expect(getAvailableTemplateSlot('live-highlight', [], 'illustration', 'portrait', point)?.id).toBe(imageSlot.id)
    expect(getAvailableTemplateSlot('live-highlight', [], 'note', 'portrait', point)).toBeNull()
    expect(getAvailableTemplateSlot('live-highlight', [draft({ templateSlotId: imageSlot.id, itemType: 'illustration' })], 'illustration', 'portrait', point)).toBeNull()
  })

  it('uses the first compatible slot for click fallback', () => {
    expect(getAvailableTemplateSlot('monthly-recap', [], 'note', 'portrait')?.id).toBe('month-note-one')
  })

  it('places items into slots and merges nested style overrides', () => {
    const slot = getMaterializedTemplateSlots('quiet-letter', 'portrait').find((entry) => entry.kind === 'note')!
    const placed = placeDraftItemInTemplateSlot(
      draft({ stylePayload: '{"noteCard":{"fontSize":14,"backgroundColor":"#ffffff"}}' }),
      'quiet-letter',
      slot
    )

    expect(placed.templateSlotId).toBe('letter-note')
    expect(placed.x).toBe(slot.layout.x)
    expect(JSON.parse(placed.stylePayload || '{}').noteCard).toMatchObject({ fontSize: 14, backgroundColor: '#fffaf0', fontFamily: 'serif' })
  })

  it('switches templates while preserving user materials and excess resources', () => {
    let id = 0
    const current = [
      draft({ draftId: 'note-1' }),
      draft({ draftId: 'note-2', sourceId: 'note-2' }),
      draft({ draftId: 'custom-material', itemType: 'material', sourceId: undefined, materialId: 'heart' }),
      draft({ draftId: 'old-decoration', itemType: 'material', sourceId: undefined, materialId: 'star', templateGenerated: true, templateSourceId: 'old' }),
    ]
    const applied = applyJournalPageTemplate('live-highlight', current, () => `generated-${++id}`)

    expect(applied.background).toBe('sakura')
    expect(applied.items.some((item) => item.draftId === 'old-decoration')).toBe(false)
    expect(applied.items.some((item) => item.draftId === 'custom-material')).toBe(true)
    expect(applied.items.find((item) => item.draftId === 'note-1')?.templateSlotId).toBe('live-note')
    expect(applied.items.find((item) => item.draftId === 'note-2')?.templateSlotId).toBeUndefined()
  })

  it('returns user content without template metadata when switching to blank', () => {
    const result = applyJournalPageTemplate(null, [
      draft({ templateSlotId: 'slot-1', templateSourceId: 'live-highlight' }),
      draft({ draftId: 'generated', itemType: 'material', templateGenerated: true, templateSourceId: 'live-highlight' }),
    ])

    expect(result.items).toHaveLength(1)
    expect(result.items[0].templateSlotId).toBeUndefined()
    expect(result.items[0].templateSourceId).toBeUndefined()
    expect(getJournalPageTemplateDefinition('missing')).toBeNull()
  })
})
