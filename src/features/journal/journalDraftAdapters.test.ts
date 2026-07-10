import { describe, expect, it } from 'vitest'
import {
  createCompositionDraft,
  createDraftSavePlan,
  draftItemToJournalLayout,
  journalItemToDraftItem,
} from './journalDraftAdapters'
import { getImageItemStyleFromPayload, getNoteCardStyleFromPayload } from './journalItemStyles'
import type { Illustration, JournalDraftItem, JournalItemWithNote, JournalPage, Note } from '../../types'

const note: Note = {
  id: 'note-1',
  oshi_id: 'oshi-1',
  archive_id: null,
  title: 'Memory',
  content: '{}',
  plain_text: 'Body text',
  source_url: '',
  tags: ['tag'],
  favorite: false,
  created_at: '',
  updated_at: '',
}

const illustration: Illustration = {
  id: 'ill-1',
  oshi_id: 'oshi-1',
  category: 'fanart',
  title: 'IMG',
  original_path: '/tmp/img.png',
  thumbnail_path: null,
  original_filename: 'img.png',
  mime_type: 'image/png',
  file_size: 1,
  width: 800,
  height: 1200,
  date: null,
  owner: 'owner',
  artist: '',
  source_url: '',
  tags: [],
  description: '',
  favorite: false,
  archived: false,
  created_at: '',
  updated_at: '',
}

function item(overrides: Partial<JournalItemWithNote>): JournalItemWithNote {
  return {
    id: 'item-1',
    page_id: 'page-1',
    note_id: null,
    illustration_id: null,
    item_type: 'material',
    x: 10,
    y: 20,
    width: 100,
    height: 80,
    rotation: 0,
    z_index: 1,
    sticker_style: 'sticky',
    color: null,
    border_style: null,
    material_id: null,
    material_snapshot: '{}',
    style_payload: '{}',
    created_at: '',
    updated_at: '',
    note: null,
    illustration: null,
    ...overrides,
  }
}

const page: JournalPage = {
  id: 'page-1',
  book_id: null,
  oshi_id: 'oshi-1',
  page_type: 'postcard',
  title: 'Page',
  description: 'Description',
  date_label: '2026',
  standalone: true,
  page_index: 0,
  background: 'sakura',
  orientation: 'portrait',
  created_at: '',
  updated_at: '',
}

describe('journalDraftAdapters', () => {
  it('converts old note items into editable note card drafts', () => {
    const [draft] = journalItemToDraftItem(item({
      item_type: 'note',
      note_id: note.id,
      note,
      color: '#dbeafe',
    }))
    const noteCard = getNoteCardStyleFromPayload(draft.stylePayload, note, '', '')

    expect(draft.itemType).toBe('note')
    expect(draft.sourceId).toBe(note.id)
    expect(noteCard.titleText).toBe('Memory')
    expect(noteCard.backgroundColor).toBe('#dbeafe')
  })

  it('converts old image items into contain image drafts with natural ratio', () => {
    const [draft] = journalItemToDraftItem(item({
      item_type: 'illustration',
      illustration_id: illustration.id,
      illustration,
      width: 280,
      height: 220,
    }))
    const imageStyle = getImageItemStyleFromPayload(draft.stylePayload)

    expect(draft.width).toBe(213)
    expect(draft.height).toBe(320)
    expect(imageStyle.fit).toBe('contain')
    expect(imageStyle.frame).toBe('none')
  })

  it('creates save plans without losing new, updated, or removed items', () => {
    const existing = [
      item({ id: 'keep', item_type: 'material', material_id: 'heart' }),
      item({ id: 'remove', item_type: 'material', material_id: 'star' }),
    ]
    const draftItems: JournalDraftItem[] = [
      {
        draftId: 'existing-keep',
        originItemId: 'keep',
        itemType: 'material',
        materialId: 'heart',
        x: 1,
        y: 2,
        width: 30,
        height: 30,
        rotation: 5,
        zIndex: 3,
      },
      {
        draftId: 'new',
        itemType: 'material',
        materialId: 'star',
        x: 4,
        y: 5,
        width: 40,
        height: 40,
        rotation: 0,
        zIndex: 4,
      },
    ]
    const plan = createDraftSavePlan(draftItems, existing)

    expect(plan.itemsToUpdate).toHaveLength(1)
    expect(plan.itemsToCreate).toHaveLength(1)
    expect(plan.existingItemsToRemove.map((entry) => entry.id)).toEqual(['remove'])
    expect(draftItemToJournalLayout(draftItems[0])).toEqual({ x: 1, y: 2, width: 30, height: 30, rotation: 5, z_index: 3 })
  })

  it('creates composition drafts from page storage and supported items', () => {
    const draft = createCompositionDraft(page, [item({ id: 'mat-1', material_id: 'heart' })], null)

    expect(draft.title).toBe('Page')
    expect(draft.background).toBe('sakura')
    expect(draft.orientation).toBe('portrait')
    expect(draft.items).toHaveLength(1)
  })
})
