import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useJournalStore } from '../../../stores/journalStore'
import { JournalBookshelfView } from './JournalBookshelfView'
import { JournalPageView } from './JournalPageView'

export function JournalWorkspace({ oshiId }: { oshiId: string }) {
  const navigate = useNavigate()
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
        onOpenPostcard={(postcard) => navigate(`/oshis/${oshiId}/journal/pages/${postcard.id}/edit`)}
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
