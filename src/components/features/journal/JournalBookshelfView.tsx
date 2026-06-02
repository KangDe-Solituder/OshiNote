import { useState } from 'react'
import { BookOpen, Check, Edit3, Loader2, Plus, Trash2, X } from 'lucide-react'
import { Button } from '../../ui/Button'
import { useJournalStore } from '../../../stores/journalStore'
import type { JournalBook } from '../../../types'

interface JournalBookshelfViewProps {
  oshiId: string
  onOpenBook: (book: JournalBook) => void
}

export function JournalBookshelfView({ oshiId, onOpenBook }: JournalBookshelfViewProps) {
  const { books, loading, error, createBook, renameBook, deleteBook } = useJournalStore()
  const [newTitle, setNewTitle] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editingBookId, setEditingBookId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')

  async function handleCreate() {
    const title = newTitle.trim()
    if (!title) return
    await createBook(oshiId, title)
    setNewTitle('')
    setShowCreate(false)
  }

  async function handleRename(bookId: string) {
    const title = editingTitle.trim()
    if (!title) return
    await renameBook(bookId, title, oshiId)
    setEditingBookId(null)
  }

  async function handleDelete(book: JournalBook) {
    if (!confirm(`Delete journal "${book.title}"? Its pages and placed stickers will be removed. Original notes will be kept.`)) return
    await deleteBook(book.id, oshiId)
  }

  return (
    <div className="min-h-full bg-[var(--journal-canvas-bg)] px-6 py-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-7 flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-text-primary">Journal Bookshelf</h2>
            <p className="mt-1 text-sm text-text-muted">Choose a journal, or start a new book for a different collection of memories.</p>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={16} />
            New Journal
          </Button>
        </div>

        {showCreate && (
          <form onSubmit={(event) => { event.preventDefault(); handleCreate() }} className="mb-6 flex max-w-md items-center gap-2 rounded-xl border border-border-color bg-bg-secondary/70 p-3 shadow-sm">
            <input
              autoFocus
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder="Journal title..."
              className="min-w-0 flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
            />
            <button type="submit" className="rounded-lg p-1.5 text-accent hover:bg-bg-tertiary" title="Create journal"><Check size={16} /></button>
            <button type="button" onClick={() => { setShowCreate(false); setNewTitle('') }} className="rounded-lg p-1.5 text-text-muted hover:bg-bg-tertiary" title="Cancel"><X size={16} /></button>
          </form>
        )}

        {loading && books.length === 0 && <Loader2 size={24} className="mx-auto mt-20 animate-spin text-accent" />}
        {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

        {!loading && books.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border-color bg-bg-secondary/25 px-6 py-16 text-center">
            <BookOpen size={42} className="mx-auto mb-3 text-accent" />
            <h3 className="text-base font-semibold text-text-primary">Your bookshelf is waiting</h3>
            <p className="mt-1 text-sm text-text-muted">Create a journal to begin arranging notes into pages.</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
          {books.map((book) => (
            <div key={book.id} className="group relative">
              <button
                type="button"
                onClick={() => onOpenBook(book)}
                className="relative block h-64 w-full overflow-hidden rounded-r-xl rounded-l-md border border-black/15 text-left shadow-lg transition-transform hover:-translate-y-1 hover:shadow-xl"
                style={{ backgroundColor: book.cover_color }}
              >
                <span className="absolute inset-y-0 left-0 w-5 bg-black/20 shadow-[inset_-2px_0_2px_rgba(255,255,255,0.18)]" />
                <span className="absolute inset-x-8 top-12 rounded border border-white/30 bg-black/15 px-3 py-4 text-center text-sm font-bold text-white shadow-sm">
                  {book.title}
                </span>
                <span className="absolute bottom-5 right-5 text-xs text-white/75">{book.page_count} page{book.page_count === 1 ? '' : 's'}</span>
              </button>

              <div className="mt-2 flex items-center gap-1">
                {editingBookId === book.id ? (
                  <>
                    <input
                      autoFocus
                      value={editingTitle}
                      onChange={(event) => setEditingTitle(event.target.value)}
                      onKeyDown={(event) => event.key === 'Enter' && handleRename(book.id)}
                      className="min-w-0 flex-1 rounded-lg border border-border-color bg-bg-secondary px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-soft"
                    />
                    <button type="button" onClick={() => handleRename(book.id)} className="rounded p-1 text-accent hover:bg-bg-tertiary" title="Save name"><Check size={14} /></button>
                    <button type="button" onClick={() => setEditingBookId(null)} className="rounded p-1 text-text-muted hover:bg-bg-tertiary" title="Cancel"><X size={14} /></button>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate text-xs text-text-muted">{book.title}</span>
                    <button type="button" onClick={() => { setEditingBookId(book.id); setEditingTitle(book.title) }} className="rounded p-1 text-text-muted opacity-0 hover:bg-bg-tertiary hover:text-text-primary group-hover:opacity-100" title="Rename journal"><Edit3 size={14} /></button>
                    <button type="button" onClick={() => handleDelete(book)} className="rounded p-1 text-text-muted opacity-0 hover:bg-red-50 hover:text-red-500 group-hover:opacity-100" title="Delete journal"><Trash2 size={14} /></button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
