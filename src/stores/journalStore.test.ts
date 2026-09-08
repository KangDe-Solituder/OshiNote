import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { JournalItemWithNote, JournalPage } from '../types'

vi.mock('../features/journal/journalService', () => ({
  fetchJournalPageById: vi.fn(async (id: string) => ({ id, book_id: 'book-1', oshi_id: 'oshi-1', standalone: 0 }) as unknown as JournalPage),
  ensureJournalPage: vi.fn(async () => ({ id: 'p1' }) as unknown as JournalPage),
  fetchJournalPages: vi.fn(async () => [
    { id: 'p1', book_id: 'book-1', oshi_id: 'oshi-1' },
    { id: 'p2', book_id: 'book-1', oshi_id: 'oshi-1' },
  ] as unknown as JournalPage[]),
  // p1 resolves slowly so its load finishes after p2's even though it started first.
  fetchJournalItems: vi.fn(async (pageId: string) => {
    if (pageId === 'p1') await new Promise((resolve) => setTimeout(resolve, 30))
    return [{ id: `item-${pageId}` }] as unknown as JournalItemWithNote[]
  }),
  fetchUnplacedNotes: vi.fn(async () => []),
  fetchUnplacedIllustrations: vi.fn(async () => []),
}))

import { useJournalStore } from './journalStore'
import * as journalService from '../features/journal/journalService'

beforeEach(() => {
  useJournalStore.setState({
    activeBookId: null,
    activeStandalonePageId: null,
    pages: [],
    activePageId: null,
    items: [],
    unplacedNotes: [],
    unplacedIllustrations: [],
    loading: false,
    error: null,
  })
})

describe('journalStore page load races', () => {
  it('does not let a stale book load replace a different book metadata or clear loading', async () => {
    const opening = useJournalStore.getState().openBook('old-book', 'oshi-1')
    await useJournalStore.getState().openPageForEditing('p2', 'oshi-1')
    await opening
    expect(useJournalStore.getState().activeBookId).toBe('book-1')
    expect(useJournalStore.getState().activePageId).toBe('p2')
  })

  it('invalidates pending loads when leaving a book', async () => {
    const pending = useJournalStore.getState().openPageForEditing('p1', 'oshi-1')
    useJournalStore.getState().closeBook()
    await pending
    expect(useJournalStore.getState().activePageId).toBeNull()
    expect(useJournalStore.getState().items).toEqual([])
    expect(useJournalStore.getState().loading).toBe(false)
  })

  it('ignores a stale request error after a newer page is ready', async () => {
    let reject!: (error: Error) => void
    vi.mocked(journalService.fetchJournalItems).mockImplementationOnce(() => new Promise((_, fail) => { reject = fail }))
    const pending = useJournalStore.getState().setActivePage('p1', 'oshi-1')
    await useJournalStore.getState().openPageForEditing('p2', 'oshi-1')
    reject(new Error('old request failed'))
    await pending
    expect(useJournalStore.getState().error).toBeNull()
    expect(useJournalStore.getState().activePageId).toBe('p2')
  })
  it('drops a stale openPageForEditing completion so the newest page wins', async () => {
    const slow = useJournalStore.getState().openPageForEditing('p1', 'oshi-1')
    const fast = useJournalStore.getState().openPageForEditing('p2', 'oshi-1')
    await Promise.all([slow, fast])
    expect(useJournalStore.getState().activePageId).toBe('p2')
    expect(useJournalStore.getState().items.map((item) => item.id)).toEqual(['item-p2'])
  })

  it('keeps the user-picked page when an earlier openBook finishes late', async () => {
    const opening = useJournalStore.getState().openBook('book-1', 'oshi-1')
    await useJournalStore.getState().setActivePage('p2', 'oshi-1')
    await opening
    expect(useJournalStore.getState().activePageId).toBe('p2')
    expect(useJournalStore.getState().items.map((item) => item.id)).toEqual(['item-p2'])
  })
})
