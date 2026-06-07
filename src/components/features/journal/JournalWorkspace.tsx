import { useEffect, useMemo } from 'react'
import { useJournalStore } from '../../../stores/journalStore'
import { JournalBookshelfView } from './JournalBookshelfView'
import { JournalPageView } from './JournalPageView'

export function JournalWorkspace({ oshiId }: { oshiId: string }) {
  const { books, postcards, activeBookId, activeStandalonePageId, loadBookshelf, closeBook } = useJournalStore()

  useEffect(() => {
    loadBookshelf(oshiId)
  }, [loadBookshelf, oshiId])

  const activeBook = useMemo(
    () => books.find((book) => book.id === activeBookId) || null,
    [activeBookId, books]
  )
  const activePostcard = useMemo(
    () => postcards.find((postcard) => postcard.id === activeStandalonePageId) || null,
    [activeStandalonePageId, postcards]
  )

  if (!activeBook && !activePostcard) {
    return (
      <JournalBookshelfView
        oshiId={oshiId}
        onOpenBook={(book) => useJournalStore.getState().openBook(book.id, oshiId)}
        onOpenPostcard={(postcard) => useJournalStore.getState().openPostcard(postcard.id, oshiId)}
      />
    )
  }

  return (
    <JournalPageView
      oshiId={oshiId}
      bookId={activeBook?.id || null}
      bookTitle={activeBook?.title || activePostcard?.title || 'Loose page'}
      standalonePostcard={activePostcard}
      onBack={() => {
        closeBook()
        loadBookshelf(oshiId)
      }}
    />
  )
}
