import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BookOpen,
  Camera,
  Check,
  ChevronDown,
  FileImage,
  Flower2,
  Grid3X3,
  Heart,
  List,
  Loader2,
  Moon,
  MoreHorizontal,
  Palette,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '../../ui/Button'
import { useJournalStore } from '../../../stores/journalStore'
import type { JournalBook, JournalCoverDecoration, JournalCoverStyle, JournalPage } from '../../../types'
import { usePageTransition, usePanelTransition, usePopoverTransition, useUiMotionSeconds } from '../themes/uiMotion'

interface JournalBookshelfViewProps {
  oshiId: string
  onOpenBook: (book: JournalBook) => void
  onOpenPostcard: (postcard: JournalPage) => void
}

interface BookDraft {
  title: string
  description: string
  cover_color: string
  cover_style: JournalCoverStyle
  cover_decoration: JournalCoverDecoration
  date_label: string
}

type BookshelfViewMode = 'grid' | 'list'
type CreateKind = 'book' | 'postcard'

const COVER_COLORS = ['#c9c5f3', '#f2c4ce', '#d7e4f5', '#efe2cc', '#29314b', '#e8e5dd', '#c9dfd2', '#f4d9b9']
const COVER_STYLES: { id: JournalCoverStyle; label: string }[] = [
  { id: 'cloth', label: 'Cloth' },
  { id: 'paper', label: 'Paper' },
  { id: 'classic', label: 'Classic' },
  { id: 'night', label: 'Night' },
  { id: 'postcard', label: 'Loose page' },
  { id: 'minimal', label: 'Minimal' },
]
const COVER_DECORATIONS: { id: JournalCoverDecoration; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'flower', label: 'Flower' },
  { id: 'moon', label: 'Moon' },
  { id: 'heart', label: 'Heart' },
  { id: 'camera', label: 'Camera' },
  { id: 'ticket', label: 'Ticket' },
]

export function JournalBookshelfView({ oshiId, onOpenBook, onOpenPostcard }: JournalBookshelfViewProps) {
  const { books, postcards, loading, error, createBook, createPostcard, updateBook, deleteBook, collectPostcard } = useJournalStore()
  const motionSeconds = useUiMotionSeconds()
  const pageTransition = usePageTransition()
  const panelTransition = usePanelTransition()
  const popoverTransition = usePopoverTransition()
  const [newTitle, setNewTitle] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showCreateMenu, setShowCreateMenu] = useState(false)
  const [createKind, setCreateKind] = useState<CreateKind>('book')
  const [editingBookId, setEditingBookId] = useState<string | null>(null)
  const [menuBookId, setMenuBookId] = useState<string | null>(null)
  const [draft, setDraft] = useState<BookDraft>(createDraft())
  const [query, setQuery] = useState('')
  const [viewMode, setViewMode] = useState<BookshelfViewMode>('grid')

  const filteredBooks = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return books
    return books.filter((book) =>
      book.title.toLowerCase().includes(normalized) ||
      book.description.toLowerCase().includes(normalized) ||
      book.date_label.toLowerCase().includes(normalized)
    )
  }, [books, query])

  const filteredPostcards = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return postcards
    return postcards.filter((postcard) =>
      (postcard.title || '').toLowerCase().includes(normalized) ||
      (postcard.description || '').toLowerCase().includes(normalized) ||
      (postcard.date_label || '').toLowerCase().includes(normalized)
    )
  }, [postcards, query])

  async function handleCreate() {
    const title = newTitle.trim()
    if (!title) return
    if (createKind === 'postcard') {
      await createPostcard(oshiId, title)
    } else {
      await createBook(oshiId, title)
    }
    setNewTitle('')
    setShowCreate(false)
  }

  async function handleSaveBook(bookId: string) {
    const title = draft.title.trim()
    if (!title) return
    await updateBook(bookId, {
      title,
      description: draft.description.trim(),
      cover_color: draft.cover_color,
      cover_style: draft.cover_style,
      cover_decoration: draft.cover_decoration,
      date_label: draft.date_label.trim(),
    }, oshiId)
    setEditingBookId(null)
    setMenuBookId(null)
  }

  function startEditing(book: JournalBook) {
    setEditingBookId(book.id)
    setMenuBookId(null)
    setDraft(createDraft(book))
  }

  async function handleDelete(book: JournalBook) {
    if (!confirm(`Delete archive "${book.title}"? Its pages and placed stickers will be removed. Original notes will be kept.`)) return
    await deleteBook(book.id, oshiId)
    setMenuBookId(null)
  }

  return (
    <div className="min-h-full bg-bg-primary px-6 py-6 text-text-primary">
      <div className="mx-auto max-w-6xl">
        <div className="mb-7 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1 sm:max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full rounded-2xl border border-border-color bg-bg-card py-2 pl-9 pr-3 text-sm text-text-primary shadow-sm outline-none transition-shadow placeholder:text-text-muted focus:ring-2 focus:ring-accent-soft/40"
              placeholder="Search journal..."
            />
          </div>
          <button type="button" className="rounded-2xl border border-border-color bg-bg-card px-4 py-2 text-sm font-medium text-accent shadow-sm">
            All
          </button>
          <div className="relative">
            <Button
              variant="primary"
              size="md"
              onClick={() => setShowCreateMenu(!showCreateMenu)}
              aria-expanded={showCreateMenu}
            >
              <Plus size={16} />
              New
              <ChevronDown size={15} />
            </Button>
            <AnimatePresence>
              {showCreateMenu && (
                <motion.div
                  {...popoverTransition}
                  className="absolute right-0 top-11 z-50 w-56 rounded-xl border border-border-color bg-bg-primary p-1.5 shadow-xl"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setCreateKind('book')
                      setShowCreate(true)
                      setShowCreateMenu(false)
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary"
                  >
                    <BookOpen size={14} className="text-accent" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">Archive</span>
                      <span className="block text-xs text-text-muted">A folder-like collection of pages</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreateKind('postcard')
                      setShowCreate(true)
                      setShowCreateMenu(false)
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary"
                  >
                    <FileImage size={14} className="text-accent" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">Loose page</span>
                      <span className="block text-xs text-text-muted">A single layout you can collect later</span>
                    </span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="ml-auto flex rounded-2xl border border-border-color bg-bg-card p-1 shadow-sm">
            <IconToggle active={viewMode === 'grid'} title="Grid view" onClick={() => setViewMode('grid')}><Grid3X3 size={16} /></IconToggle>
            <IconToggle active={viewMode === 'list'} title="List view" onClick={() => setViewMode('list')}><List size={16} /></IconToggle>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {showCreate && (
            <motion.form
              {...panelTransition}
              onSubmit={(event) => { event.preventDefault(); handleCreate() }}
              className="mb-8 flex max-w-md items-center gap-2 overflow-hidden rounded-2xl border border-border-color bg-bg-card p-3 shadow-sm"
            >
              <div className="flex rounded-xl border border-border-color bg-bg-secondary p-0.5">
                <button
                  type="button"
                  onClick={() => setCreateKind('book')}
                  className={clsx('rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors', createKind === 'book' ? 'bg-accent-soft/25 text-accent' : 'text-text-muted')}
                >
                  Archive
                </button>
                <button
                  type="button"
                  onClick={() => setCreateKind('postcard')}
                  className={clsx('rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors', createKind === 'postcard' ? 'bg-accent-soft/25 text-accent' : 'text-text-muted')}
                >
                  Loose page
                </button>
              </div>
              <input
                autoFocus
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder={createKind === 'postcard' ? 'Loose page title...' : 'Archive title...'}
                className="min-w-0 flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
              />
              <button type="submit" className="rounded-lg p-1.5 text-accent hover:bg-bg-tertiary" title="Create"><Check size={16} /></button>
              <button type="button" onClick={() => { setShowCreate(false); setNewTitle('') }} className="rounded-lg p-1.5 text-text-muted hover:bg-bg-tertiary" title="Cancel"><X size={16} /></button>
            </motion.form>
          )}
        </AnimatePresence>

        {loading && books.length === 0 && <Loader2 size={24} className="mx-auto mt-20 animate-spin text-accent" />}
        {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

        {!loading && books.length === 0 && postcards.length === 0 && (
          <div className="rounded-3xl border border-dashed border-border-color bg-bg-secondary/25 px-6 py-16 text-center">
            <BookOpen size={42} className="mx-auto mb-3 text-accent" />
            <h3 className="text-base font-semibold text-text-primary">Your journal is waiting</h3>
            <p className="mt-1 text-sm text-text-muted">Create an archive or a loose page to begin arranging memories.</p>
          </div>
        )}

        <AnimatePresence mode="wait">
          {viewMode === 'grid' ? (
            <motion.div
              key="grid"
              {...pageTransition}
              className="grid grid-cols-2 gap-x-7 gap-y-10 md:grid-cols-3 xl:grid-cols-4"
            >
              {filteredPostcards.map((postcard) => (
                <LoosePageCard
                  key={postcard.id}
                  postcard={postcard}
                  books={books}
                  onOpen={() => onOpenPostcard(postcard)}
                  onCollect={(bookId) => collectPostcard(postcard.id, bookId, oshiId)}
                />
              ))}
              {filteredBooks.map((book, index) => (
                <JournalBookCard
                  key={book.id}
                  book={book}
                  index={index}
                  menuOpen={menuBookId === book.id}
                  editing={editingBookId === book.id}
                  draft={draft}
                  onOpen={() => onOpenBook(book)}
                  onToggleMenu={() => setMenuBookId(menuBookId === book.id ? null : book.id)}
                  onEdit={() => startEditing(book)}
                  onDelete={() => handleDelete(book)}
                  onDraftChange={setDraft}
                  onSave={() => handleSaveBook(book.id)}
                  onCancel={() => setEditingBookId(null)}
                />
              ))}
              <motion.button
                type="button"
                onClick={() => {
                  setCreateKind('book')
                  setShowCreate(true)
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: motionSeconds, ease: 'easeOut' }}
                className="flex h-[262px] flex-col items-center justify-center rounded-2xl border border-dashed border-border-color bg-bg-secondary/20 text-accent transition-colors hover:border-border-hover hover:bg-bg-secondary/40"
              >
                <Plus size={28} />
                <span className="mt-4 text-sm font-semibold">New</span>
                <span className="mt-1 text-xs text-text-muted">Create an archive or loose page</span>
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="list"
              {...pageTransition}
              className="space-y-3"
            >
              {filteredBooks.map((book) => (
                <motion.button
                  key={book.id}
                  type="button"
                  onClick={() => onOpenBook(book)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: motionSeconds, ease: 'easeOut' }}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.99 }}
                  className="flex w-full items-center gap-4 rounded-2xl border border-border-color bg-bg-card p-3 text-left shadow-sm"
                >
                  <BookCover book={book} compact />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-text-primary">{book.title}</p>
                    <p className="mt-1 line-clamp-1 text-sm text-text-muted">{book.description || 'No description yet'}</p>
                  </div>
                  <span className="text-sm text-text-muted">{book.date_label || new Date(book.created_at).getFullYear()}</span>
                  <span className="text-sm text-text-muted">{book.page_count} pages</span>
                </motion.button>
              ))}
              {filteredPostcards.map((postcard) => (
                <motion.button
                  key={postcard.id}
                  type="button"
                  onClick={() => onOpenPostcard(postcard)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: motionSeconds, ease: 'easeOut' }}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.99 }}
                  className="flex w-full items-center gap-4 rounded-2xl border border-border-color bg-bg-card p-3 text-left shadow-sm"
                >
                  <span className="flex h-20 w-28 shrink-0 items-center justify-center rounded-xl border border-border-color bg-[var(--journal-canvas-bg)] text-accent">
                    <FileImage size={22} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-text-primary">{postcard.title || 'Untitled loose page'}</p>
                    <p className="mt-1 line-clamp-1 text-sm text-text-muted">{postcard.description || 'Loose page'}</p>
                  </div>
                  <span className="text-sm text-text-muted">{postcard.date_label || new Date(postcard.created_at).getFullYear()}</span>
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function JournalBookCard({
  book,
  index,
  menuOpen,
  editing,
  draft,
  onOpen,
  onToggleMenu,
  onEdit,
  onDelete,
  onDraftChange,
  onSave,
  onCancel,
}: {
  book: JournalBook
  index: number
  menuOpen: boolean
  editing: boolean
  draft: BookDraft
  onOpen: () => void
  onToggleMenu: () => void
  onEdit: () => void
  onDelete: () => void
  onDraftChange: (draft: BookDraft) => void
  onSave: () => void
  onCancel: () => void
}) {
  const popoverTransition = usePopoverTransition()
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18, delay: Math.min(index * 0.012, 0.06), ease: 'easeOut' }}
      className="group relative"
    >
      <div className="relative mx-auto w-full max-w-[180px]">
        <motion.button type="button" onClick={onOpen} whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }} className="block w-full text-left">
          <BookCover book={book} />
        </motion.button>
        <button
          type="button"
          onClick={onToggleMenu}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-bg-card text-accent shadow-sm transition-colors hover:bg-bg-secondary"
          title="Archive actions"
        >
          <MoreHorizontal size={16} />
        </button>
        <AnimatePresence>
          {menuOpen && !editing && (
            <motion.div
              {...popoverTransition}
              className="absolute right-2 top-12 z-40 w-36 rounded-xl border border-border-color bg-bg-primary p-1.5 shadow-xl"
            >
              <button type="button" onClick={onEdit} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-text-primary hover:bg-bg-secondary">
                <Palette size={14} />
                Edit cover
              </button>
              <button type="button" onClick={onDelete} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-red-500 hover:bg-red-50">
                <Trash2 size={14} />
                Delete
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {editing && (
            <BookEditor
              draft={draft}
              onChange={onDraftChange}
              onSave={onSave}
              onCancel={onCancel}
            />
          )}
        </AnimatePresence>
      </div>
      <div className="mx-auto mt-3 max-w-[180px]">
        <p className="truncate text-sm font-semibold text-text-primary">{book.title}</p>
        <p className="mt-1 text-xs text-text-muted">{book.date_label || new Date(book.created_at).getFullYear()}</p>
        <p className="mt-1 text-xs text-text-muted">{book.page_count} page{book.page_count === 1 ? '' : 's'}</p>
      </div>
    </motion.div>
  )
}

function LoosePageCard({
  postcard,
  books,
  onOpen,
  onCollect,
}: {
  postcard: JournalPage
  books: JournalBook[]
  onOpen: () => void
  onCollect: (bookId: string) => void
}) {
  const [showCollect, setShowCollect] = useState(false)
  return (
    <div className="relative rounded-2xl border border-border-color bg-bg-card p-3 shadow-sm">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="relative aspect-[1.48] overflow-hidden rounded-xl border border-border-color bg-[var(--journal-canvas-bg)]">
          <div className="absolute inset-0 opacity-70 [background-image:radial-gradient(var(--journal-canvas-dot)_1px,transparent_1px)] [background-size:15px_15px]" />
          <div className="absolute left-4 top-4 h-12 w-16 rotate-[-3deg] rounded-lg bg-[var(--journal-sticker-2)] shadow-sm" />
          <div className="absolute bottom-4 right-4 h-10 w-20 rotate-[2deg] rounded-lg bg-[var(--journal-sticker-4)] shadow-sm" />
          <FileImage size={24} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-accent" />
        </div>
        <p className="mt-3 truncate text-sm font-semibold text-text-primary">{postcard.title || 'Untitled loose page'}</p>
        <p className="mt-1 text-xs text-text-muted">{postcard.date_label || new Date(postcard.created_at).getFullYear()}</p>
      </button>
      <div className="mt-3">
        <Button variant="secondary" size="sm" className="w-full" onClick={() => setShowCollect(!showCollect)} disabled={books.length === 0}>
          <BookOpen size={14} />
          Collect into archive
        </Button>
      </div>
      <AnimatePresence>
        {showCollect && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute inset-x-3 top-[calc(100%-8px)] z-40 rounded-xl border border-border-color bg-bg-primary p-1.5 shadow-xl"
          >
            {books.map((book) => (
              <button
                key={book.id}
                type="button"
                onClick={() => onCollect(book.id)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary"
              >
                <BookOpen size={14} className="text-accent" />
                <span className="min-w-0 flex-1 truncate">{book.title}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function BookCover({ book, compact = false }: { book: JournalBook; compact?: boolean }) {
  const isDark = book.cover_style === 'night'
  return (
    <div
      className={clsx(
        'relative overflow-hidden border text-center shadow-[0_14px_28px_rgba(66,90,130,0.16)]',
        compact ? 'h-20 w-14 rounded-lg' : 'aspect-[0.68] w-full rounded-[14px]',
        getCoverClass(book.cover_style)
      )}
      style={{
        backgroundColor: book.cover_color || '#c9c5f3',
        borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(80,95,130,0.16)',
      }}
    >
      <span className={clsx('absolute inset-y-0 left-0 bg-black/10 shadow-[inset_-2px_0_2px_rgba(255,255,255,0.22)]', compact ? 'w-2' : 'w-4')} />
      <span className="pointer-events-none absolute inset-0 opacity-55 [background-image:linear-gradient(90deg,rgba(255,255,255,0.24)_0,rgba(255,255,255,0)_28%),radial-gradient(circle_at_20%_18%,rgba(255,255,255,0.5)_0,rgba(255,255,255,0)_18%),radial-gradient(circle_at_82%_70%,rgba(0,0,0,0.09)_0,rgba(0,0,0,0)_22%)]" />
      <span className="pointer-events-none absolute inset-2 rounded-[10px] border border-white/24" />
      {book.cover_style === 'paper' && <span className="absolute inset-0 opacity-35 [background-image:linear-gradient(0deg,rgba(90,74,50,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(90,74,50,0.06)_1px,transparent_1px)] [background-size:28px_28px]" />}
      {book.cover_style === 'postcard' && <span className="absolute inset-y-0 left-0 w-5 bg-[repeating-linear-gradient(135deg,#ef8a8a_0_7px,#fff_7px_14px,#79a8d8_14px_21px,#fff_21px_28px)] opacity-70" />}
      {book.cover_style === 'night' && <span className="absolute inset-0 bg-[radial-gradient(circle_at_70%_22%,rgba(255,255,255,0.22)_0_1px,transparent_2px),radial-gradient(circle_at_38%_62%,rgba(255,255,255,0.18)_0_1px,transparent_2px),linear-gradient(180deg,rgba(5,11,31,0.15),rgba(5,11,31,0.34))]" />}
      {!compact && (
        <>
          <div className={clsx('absolute inset-x-5 top-[28%] text-sm font-semibold leading-snug', isDark ? 'text-white/78' : 'text-[#56667f]')}>
            {book.title}
          </div>
          <div className={clsx('absolute inset-x-6 top-[48%] text-[11px]', isDark ? 'text-white/55' : 'text-[#7c8da5]')}>
            {book.date_label || new Date(book.created_at).getFullYear()}
          </div>
          <CoverDecoration decoration={book.cover_decoration} dark={isDark} />
        </>
      )}
    </div>
  )
}

function CoverDecoration({ decoration, dark }: { decoration: JournalCoverDecoration; dark: boolean }) {
  const className = clsx('absolute bottom-[19%] left-1/2 -translate-x-1/2', dark ? 'text-white/58' : 'text-[#64748b]')
  if (decoration === 'flower') return <Flower2 size={30} className={className} />
  if (decoration === 'moon') return <Moon size={30} className={className} />
  if (decoration === 'heart') return <Heart size={30} className={className} />
  if (decoration === 'camera') return <Camera size={30} className={className} />
  if (decoration === 'ticket') return <Sparkles size={30} className={className} />
  return null
}

function BookEditor({
  draft,
  onChange,
  onSave,
  onCancel,
}: {
  draft: BookDraft
  onChange: (draft: BookDraft) => void
  onSave: () => void
  onCancel: () => void
}) {
  const motionSeconds = useUiMotionSeconds()
  const popoverTransition = usePopoverTransition()
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: motionSeconds, ease: 'easeOut' }}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-bg-primary/70 p-6 backdrop-blur-sm"
    >
      <motion.div
        {...popoverTransition}
        className="max-h-[calc(100vh-48px)] w-[min(430px,calc(100vw-32px))] overflow-y-auto rounded-3xl border border-border-color bg-bg-primary p-5 text-left shadow-glass"
      >
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-accent-soft/20 text-accent">
            <Palette size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-text-primary">Edit archive</h3>
            <p className="text-xs text-text-muted">Choose a cover style for this archive.</p>
          </div>
          <button type="button" onClick={onCancel} className="rounded-xl p-2 text-text-muted hover:bg-bg-tertiary hover:text-text-primary" title="Close">
            <X size={17} />
          </button>
        </div>
        <input
          autoFocus
          value={draft.title}
          onChange={(event) => onChange({ ...draft, title: event.target.value })}
          className="mb-2 w-full rounded-2xl border border-border-color bg-bg-secondary px-3 py-2.5 text-sm text-text-primary outline-none placeholder:text-text-muted focus:ring-2 focus:ring-accent-soft/40"
          placeholder="Archive title"
        />
        <input
          value={draft.date_label}
          onChange={(event) => onChange({ ...draft, date_label: event.target.value })}
          className="mb-2 w-full rounded-2xl border border-border-color bg-bg-secondary px-3 py-2.5 text-sm text-text-primary outline-none placeholder:text-text-muted focus:ring-2 focus:ring-accent-soft/40"
          placeholder="Year or date range, e.g. 2024-2025"
        />
        <textarea
          value={draft.description}
          onChange={(event) => onChange({ ...draft, description: event.target.value })}
          className="mb-4 h-20 w-full resize-none rounded-2xl border border-border-color bg-bg-secondary px-3 py-2.5 text-sm text-text-primary outline-none placeholder:text-text-muted focus:ring-2 focus:ring-accent-soft/40"
          placeholder="Short description"
        />
        <div className="mb-4 flex flex-wrap gap-2">
          {COVER_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onChange({ ...draft, cover_color: color })}
              className={clsx('h-8 w-8 rounded-full border shadow-sm transition-transform hover:scale-105', draft.cover_color === color ? 'border-accent ring-2 ring-accent-soft/40' : 'border-border-color')}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
        <SegmentedOptions
          label="Cover"
          items={COVER_STYLES}
          value={draft.cover_style}
          onChange={(cover_style) => onChange({ ...draft, cover_style })}
        />
        <SegmentedOptions
          label="Decoration"
          items={COVER_DECORATIONS}
          value={draft.cover_decoration}
          onChange={(cover_decoration) => onChange({ ...draft, cover_decoration })}
        />
        <div className="mt-5 flex gap-2">
          <Button size="md" className="flex-1" onClick={onSave}>
            <Save size={16} />
            Save
          </Button>
          <Button variant="ghost" size="md" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function SegmentedOptions<T extends string>({
  label,
  items,
  value,
  onChange,
}: {
  label: string
  items: { id: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="mb-3">
      <p className="mb-1.5 text-xs font-semibold text-text-muted">{label}</p>
      <div className="grid grid-cols-3 gap-1">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={clsx(
              'rounded-lg border px-2 py-1.5 text-xs transition-colors',
              value === item.id ? 'border-accent bg-accent-soft/20 text-accent' : 'border-border-color bg-bg-secondary text-text-secondary hover:border-border-hover'
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function IconToggle({ active, title, onClick, children }: { active: boolean; title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" title={title} onClick={onClick} className={clsx('rounded-xl p-2 transition-colors', active ? 'bg-accent-soft/25 text-accent' : 'text-text-muted hover:text-accent')}>
      {children}
    </button>
  )
}

function createDraft(book?: JournalBook): BookDraft {
  return {
    title: book?.title || '',
    description: book?.description || '',
    cover_color: book?.cover_color || '#c9c5f3',
    cover_style: book?.cover_style || 'cloth',
    cover_decoration: book?.cover_decoration || 'none',
    date_label: book?.date_label || String(new Date().getFullYear()),
  }
}

function getCoverClass(style: JournalCoverStyle): string {
  if (style === 'minimal') return 'rounded-xl'
  if (style === 'night') return 'rounded-[14px]'
  return 'rounded-r-[14px] rounded-l-lg'
}
