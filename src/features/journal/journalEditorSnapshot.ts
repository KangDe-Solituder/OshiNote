import { fetchJournalBookById, fetchJournalItems, fetchJournalPageById } from './journalService'
import { fetchStampForTarget } from '../stamps/stampService'

/** Keep the editor's page, items and stamp together, independent of viewer loads. */
export async function loadJournalEditorSnapshot(pageId: string) {
  const page = await fetchJournalPageById(pageId)
  if (!page) throw new Error('Journal page not found')
  const [items, stamp, book] = await Promise.all([
    fetchJournalItems(pageId, true),
    fetchStampForTarget('journal_page', pageId),
    page.book_id ? fetchJournalBookById(page.book_id) : Promise.resolve(null),
  ])
  return { page, items, stamp, bookTitle: book?.title || page.title }
}

export type JournalEditorSnapshot = Awaited<ReturnType<typeof loadJournalEditorSnapshot>>
