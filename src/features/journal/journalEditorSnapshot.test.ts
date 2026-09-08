import { describe, expect, it, vi } from 'vitest'
import type { JournalItemWithNote, JournalPage } from '../../types'

vi.mock('./journalService', () => ({
  fetchJournalPageById: vi.fn(async (id: string) => ({ id, oshi_id: 'oshi', book_id: 'book', orientation: id === 'wide' ? 'landscape' : 'portrait' })),
  fetchJournalItems: vi.fn(async (id: string) => [{ id: `item-${id}`, page_id: id, item_type: 'material', material_id: 'tape' }]),
  fetchJournalBookById: vi.fn(async () => ({ title: 'Book' })),
}))
vi.mock('../stamps/stampService', () => ({ fetchStampForTarget: vi.fn(async (_: string, id: string) => ({ label: id })) }))

import { loadJournalEditorSnapshot } from './journalEditorSnapshot'
import { createCompositionDraft, createDraftSavePlan } from './journalDraftAdapters'
import { useJournalStore } from '../../stores/journalStore'

describe('editor data isolation', () => {
  it.each([['wide', 'tall'], ['tall', 'wide']])('loads %s then %s without mixing the page and items', async (previous, next) => {
    await loadJournalEditorSnapshot(previous)
    const loaded = await loadJournalEditorSnapshot(next)
    // A late viewer load replaces the shared store after the editor has loaded.
    useJournalStore.setState({
      activePageId: previous,
      pages: [{ id: previous } as JournalPage],
      items: [{ id: `item-${previous}`, page_id: previous } as JournalItemWithNote],
    })
    const draft = createCompositionDraft(loaded.page as JournalPage, loaded.items, loaded.stamp)
    expect(draft.orientation).toBe(next === 'wide' ? 'landscape' : 'portrait')
    expect(draft.items.map((item) => item.originItemId)).toEqual([`item-${next}`])
    expect(draft.stamp?.label).toBe(next)
    const plan = createDraftSavePlan(draft.items, loaded.items)
    expect(plan.existingItemsToRemove).toEqual([])
    expect(plan.itemsToUpdate.map((item) => item.originItemId)).toEqual([`item-${next}`])
  })
})
