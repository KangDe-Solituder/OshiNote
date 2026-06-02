import { useEffect, useMemo } from 'react'
import { useJournalStore } from '../../../stores/journalStore'
import { JournalBookshelfView } from './JournalBookshelfView'
import { JournalPageView } from './JournalPageView'

export function JournalWorkspace({ oshiId }: { oshiId: string }) {
  const { books, activeBookId, loadBookshelf, closeBook } = useJournalStore()

  useEffect(() => {
    loadBookshelf(oshiId)
  }, [loadBookshelf, oshiId])

  const activeBook = useMemo(
    () => books.find((book) => book.id === activeBookId) || null,
    [activeBookId, books]
  )

  if (!activeBook) {
    return <JournalBookshelfView oshiId={oshiId} onOpenBook={(book) => useJournalStore.getState().openBook(book.id, oshiId)} />
  }

  return (
    <JournalPageView
      oshiId={oshiId}
      bookId={activeBook.id}
      bookTitle={activeBook.title}
      onBack={() => {
        closeBook()
        loadBookshelf(oshiId)
      }}
    />
  )
}
