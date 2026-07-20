import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, Camera, FileImage, Flower, Grid3X3, Heart, List, Loader2, Moon, MoreHorizontal, Pencil, Plus, Search, Ticket, Trash2 } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { SelectMenu } from '../components/ui/SelectMenu'
import { PAGE_CONTENT_CLASS, PAGE_HEADER_CLASS } from '../components/layout/pageShell'
import { fetchJournalBooks, fetchStandalonePostcards } from '../features/journal/journalService'
import { getJournalBackgroundPreset } from '../features/journal/journalBackgrounds'
import { fetchAllOshis } from '../features/oshis/oshiService'
import { useJournalStore } from '../stores/journalStore'
import type { JournalBook, JournalCoverDecoration, JournalCoverStyle, JournalPage, Oshi } from '../types'
import { JournalPageView } from '../components/features/journal/JournalPageView'
import { usePageTransition, useUiMotionSeconds } from '../components/features/themes/uiMotion'
import { useI18n } from '../i18n/useI18n'

interface JournalBookItem {
  kind: 'book'
  book: JournalBook
  oshi: Oshi
}

interface JournalLoosePageItem {
  kind: 'postcard'
  page: JournalPage
  oshi: Oshi
}

type JournalShelfItem = JournalBookItem | JournalLoosePageItem
type ShelfViewMode = 'grid' | 'list'

const BOOK_COVER_COLORS = ['#c9c5f3', '#f2c4ce', '#d7e4f5', '#efe2cc', '#29314b', '#e8e5dd', '#bfd9c4', '#f4c7a1']
const BOOK_COVER_STYLES: JournalCoverStyle[] = ['cloth', 'paper', 'minimal', 'classic', 'night', 'postcard']
const BOOK_COVER_DECORATIONS: JournalCoverDecoration[] = ['none', 'flower', 'moon', 'heart', 'camera', 'ticket']

export function JournalHomePage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const motionSeconds = useUiMotionSeconds()
  const pageTransition = usePageTransition()
  const openPostcard = useJournalStore((state) => state.openPostcard)
  const closeBook = useJournalStore((state) => state.closeBook)
  const createBook = useJournalStore((state) => state.createBook)
  const updateBook = useJournalStore((state) => state.updateBook)
  const deleteBook = useJournalStore((state) => state.deleteBook)
  const deletePostcard = useJournalStore((state) => state.deletePostcard)
  const collectPostcard = useJournalStore((state) => state.collectPostcard)
  const [oshis, setOshis] = useState<Oshi[]>([])
  const [items, setItems] = useState<JournalShelfItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [viewMode, setViewMode] = useState<ShelfViewMode>('grid')
  const [openedItem, setOpenedItem] = useState<JournalShelfItem | null>(null)
  const [newChoiceOpen, setNewChoiceOpen] = useState(false)
  const [bookEditorOpen, setBookEditorOpen] = useState(false)
  const [editingBookItem, setEditingBookItem] = useState<JournalBookItem | null>(null)
  const [bookDraft, setBookDraft] = useState({
    oshiId: '',
    title: '',
    dateLabel: '',
    description: '',
    coverColor: BOOK_COVER_COLORS[0],
    coverStyle: 'cloth' as JournalCoverStyle,
    coverDecoration: 'ticket' as JournalCoverDecoration,
  })

  useEffect(() => {
    loadShelf()
  }, [])

  async function loadShelf() {
    setLoading(true)
    try {
      const oshis = await fetchAllOshis()
      setOshis(oshis)
      setBookDraft((current) => ({ ...current, oshiId: current.oshiId || oshis[0]?.id || '' }))
      const rows = await Promise.all(
        oshis.map(async (oshi) => {
          const [books, postcards] = await Promise.all([
            fetchJournalBooks(oshi.id),
            fetchStandalonePostcards(oshi.id),
          ])
          return [
            ...postcards.map((page): JournalLoosePageItem => ({ kind: 'postcard', page, oshi })),
            ...books.map((book): JournalBookItem => ({ kind: 'book', book, oshi })),
          ]
        })
      )
      setItems(rows.flat().sort(sortShelfItem))
    } finally {
      setLoading(false)
    }
  }

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return items
    return items.filter((item) => {
      const title = item.kind === 'book' ? item.book.title : item.page.title
      const date = item.kind === 'book' ? item.book.date_label : item.page.date_label
      const description = item.kind === 'book' ? item.book.description : item.page.description
      return [title, date, description, item.oshi.name].some((value) => value.toLowerCase().includes(normalized))
    })
  }, [items, query])

  async function handleOpenItem(item: JournalShelfItem) {
    if (item.kind === 'postcard') {
      await openPostcard(item.page.id, item.oshi.id)
    }
    setOpenedItem(item)
  }

  async function handleBackToShelf() {
    closeBook()
    setOpenedItem(null)
    await loadShelf()
  }

  async function handleDeleteItem(item: JournalShelfItem) {
    const title = item.kind === 'book'
      ? item.book.title
      : item.page.title || t('journalPage.untitledLoosePage')
    const confirmed = confirm(
      item.kind === 'book'
        ? t('journalHome.deleteBookConfirm', { title })
        : t('journalPage.deleteLooseConfirm', { title })
    )
    if (!confirmed) return
    if (item.kind === 'book') {
      await deleteBook(item.book.id, item.oshi.id)
    } else {
      await deletePostcard(item.page.id, item.oshi.id)
    }
    await loadShelf()
  }

  function openNewChoice() {
    setBookDraft((current) => ({
      ...current,
      oshiId: current.oshiId || oshis[0]?.id || '',
      title: '',
      dateLabel: String(new Date().getFullYear()),
      description: '',
      coverColor: BOOK_COVER_COLORS[0],
      coverStyle: 'cloth',
      coverDecoration: 'ticket',
    }))
    setNewChoiceOpen(true)
  }

  async function handleCreateBook() {
    const oshiId = bookDraft.oshiId || oshis[0]?.id
    if (!oshiId) return
    await createBook(oshiId, bookDraft.title.trim() || t('journalHome.newBook'))
    setNewChoiceOpen(false)
    await loadShelf()
  }

  function openBookEditor(item: JournalBookItem) {
    setEditingBookItem(item)
    setBookDraft({
      oshiId: item.oshi.id,
      title: item.book.title,
      dateLabel: item.book.date_label || '',
      description: item.book.description || '',
      coverColor: item.book.cover_color || BOOK_COVER_COLORS[0],
      coverStyle: item.book.cover_style || 'cloth',
      coverDecoration: item.book.cover_decoration || 'none',
    })
    setBookEditorOpen(true)
  }

  async function handleSaveBookEditor() {
    if (!editingBookItem) return
    await updateBook(editingBookItem.book.id, {
      title: bookDraft.title.trim() || editingBookItem.book.title,
      date_label: bookDraft.dateLabel.trim(),
      description: bookDraft.description.trim(),
      cover_color: bookDraft.coverColor,
      cover_style: bookDraft.coverStyle,
      cover_decoration: bookDraft.coverDecoration,
    }, editingBookItem.oshi.id)
    setBookEditorOpen(false)
    setEditingBookItem(null)
    await loadShelf()
  }

  async function handleCollectLoosePage(item: JournalLoosePageItem, bookId: string) {
    await collectPostcard(item.page.id, bookId, item.oshi.id)
    await loadShelf()
  }

  if (openedItem) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-bg-primary">
        <JournalPageView
          oshiId={openedItem.oshi.id}
          bookId={openedItem.kind === 'book' ? openedItem.book.id : null}
          bookTitle={openedItem.kind === 'book' ? openedItem.book.title : openedItem.page.title || t('journalHome.loosePage')}
          standalonePostcard={openedItem.kind === 'postcard' ? openedItem.page : null}
          onBack={handleBackToShelf}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg-primary text-text-primary">
      <header className={`${PAGE_HEADER_CLASS} gap-3`}>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <BookOpen size={23} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{t('nav.journal')}</p>
          <h1 className="truncate text-2xl font-bold text-text-primary">{t('nav.journalLibrary')}</h1>
        </div>
        <Button onClick={() => navigate('/journal/create')}>
          <Plus size={16} />
          {t('journalHome.newPage')}
        </Button>
        <div className="flex rounded-2xl border border-border-color bg-bg-card p-1 shadow-sm">
          <IconToggle active={viewMode === 'grid'} title={t('journalHome.gridView')} onClick={() => setViewMode('grid')}>
            <Grid3X3 size={17} />
          </IconToggle>
          <IconToggle active={viewMode === 'list'} title={t('journalHome.listView')} onClick={() => setViewMode('list')}>
            <List size={17} />
          </IconToggle>
        </div>
      </header>

      <main className={`${PAGE_CONTENT_CLASS} min-h-0`}>
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1 sm:max-w-md">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full rounded-2xl border border-border-color bg-bg-card py-3 pl-11 pr-4 text-sm text-text-primary shadow-sm outline-none transition-shadow placeholder:text-text-muted focus:ring-2 focus:ring-accent-soft/40"
              placeholder={t('journalHome.search')}
            />
          </div>
          <button type="button" className="rounded-2xl border border-border-color bg-bg-card px-5 py-3 text-sm font-semibold text-accent shadow-sm">
            {t('common.all')}
          </button>
        </div>

        {loading ? (
          <div className="flex min-h-80 items-center justify-center text-text-muted">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border-color bg-bg-secondary/25 px-6 py-16 text-center">
            <BookOpen size={42} className="mx-auto mb-3 text-accent" />
            <h2 className="text-base font-semibold text-text-primary">{t('journalHome.empty.title')}</h2>
            <p className="mt-1 text-sm text-text-muted">{t('journalHome.empty.body')}</p>
            <Button className="mx-auto mt-5" onClick={openNewChoice}>
              <Plus size={16} />
              {t('journalHome.new')}
            </Button>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {viewMode === 'grid' ? (
              <motion.div
                key="grid"
                {...pageTransition}
                className="grid grid-cols-2 gap-x-7 gap-y-10 md:grid-cols-3 xl:grid-cols-4"
              >
                {filteredItems.map((item, index) => (
                  <ShelfGridCard
                    key={item.kind === 'book' ? `book-${item.book.id}` : `postcard-${item.page.id}`}
                    item={item}
                    index={index}
                    motionSeconds={motionSeconds}
                    onOpen={() => handleOpenItem(item)}
                    onDelete={() => handleDeleteItem(item)}
                    onEditBook={item.kind === 'book' ? () => openBookEditor(item) : undefined}
                    onCollect={item.kind === 'postcard' ? (bookId) => handleCollectLoosePage(item, bookId) : undefined}
                    collectBooks={item.kind === 'postcard' ? items.filter((candidate): candidate is JournalBookItem => candidate.kind === 'book' && candidate.oshi.id === item.oshi.id).map((candidate) => candidate.book) : []}
                    t={t}
                  />
                ))}
                <button
                  type="button"
                  onClick={openNewChoice}
                  className="flex h-[262px] max-w-[180px] flex-col items-center justify-center rounded-2xl bg-bg-secondary/20 text-accent transition-colors hover:bg-bg-secondary/40"
                >
                  <Plus size={30} />
                  <span className="mt-4 text-sm font-semibold">{t('journalHome.new')}</span>
                  <span className="mt-1 px-4 text-center text-xs text-text-muted">{t('journalHome.newHint')}</span>
                </button>
              </motion.div>
            ) : (
              <motion.div key="list" {...pageTransition} className="space-y-3">
                {filteredItems.map((item) => (
                  <ShelfListRow
                    key={item.kind === 'book' ? `book-${item.book.id}` : `postcard-${item.page.id}`}
                    item={item}
                    onOpen={() => handleOpenItem(item)}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>
      <Modal open={newChoiceOpen} onClose={() => setNewChoiceOpen(false)} title={t('journalHome.createChoice.title')}>
        <div className="grid gap-4">
          <label className="grid gap-1.5 text-xs font-medium text-text-muted">
            {t('journalEditor.setup.oshi')}
            <SelectMenu
              value={bookDraft.oshiId}
              onChange={(oshiId) => setBookDraft((current) => ({ ...current, oshiId }))}
              options={oshis.map((oshi) => ({ value: oshi.id, label: oshi.name }))}
              placeholder={t('journalEditor.setup.chooseOshi')}
              ariaLabel={t('journalEditor.setup.chooseOshi')}
              className="w-full"
              buttonClassName="w-full rounded-xl text-text-primary"
              menuClassName="w-full"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-text-muted">
            {t('journalHome.bookTitle')}
            <input
              value={bookDraft.title}
              onChange={(event) => setBookDraft((current) => ({ ...current, title: event.target.value }))}
              className="rounded-xl border border-border-color bg-bg-card px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent-soft"
              placeholder={t('journalHome.newBook')}
            />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="secondary" onClick={handleCreateBook} disabled={!bookDraft.oshiId}>
              <BookOpen size={16} />
              {t('journalHome.newBook')}
            </Button>
            <Button variant="primary" onClick={() => navigate('/journal/create')}>
              <FileImage size={16} />
              {t('journalHome.newPage')}
            </Button>
          </div>
        </div>
      </Modal>
      <Modal open={bookEditorOpen} onClose={() => setBookEditorOpen(false)} title={t('journalHome.editBook')} contentClassName="max-w-3xl">
        <div className="grid gap-5 lg:grid-cols-[180px_minmax(0,1fr)]">
          <div className="mx-auto w-36">
            <BookCover
              book={{
                id: editingBookItem?.book.id || 'preview',
                oshi_id: bookDraft.oshiId,
                title: bookDraft.title || t('journalHome.newBook'),
                description: bookDraft.description,
                cover_style: bookDraft.coverStyle,
                cover_color: bookDraft.coverColor,
                cover_decoration: bookDraft.coverDecoration,
                date_label: bookDraft.dateLabel,
                sort_order: 0,
                page_count: editingBookItem?.book.page_count || 0,
                created_at: editingBookItem?.book.created_at || '',
                updated_at: editingBookItem?.book.updated_at || '',
              }}
            />
          </div>
          <div className="grid gap-3">
            <input
              value={bookDraft.title}
              onChange={(event) => setBookDraft((current) => ({ ...current, title: event.target.value }))}
              className="rounded-xl border border-border-color bg-bg-card px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent-soft"
              placeholder={t('journalHome.bookTitle')}
            />
            <input
              value={bookDraft.dateLabel}
              onChange={(event) => setBookDraft((current) => ({ ...current, dateLabel: event.target.value }))}
              className="rounded-xl border border-border-color bg-bg-card px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent-soft"
              placeholder={t('journalPage.dateLabel')}
            />
            <textarea
              value={bookDraft.description}
              onChange={(event) => setBookDraft((current) => ({ ...current, description: event.target.value }))}
              className="min-h-20 resize-none rounded-xl border border-border-color bg-bg-card px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent-soft"
              placeholder={t('journalPage.pageDescription')}
            />
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{t('journalHome.coverColor')}</p>
              <div className="flex flex-wrap gap-2">
                {BOOK_COVER_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setBookDraft((current) => ({ ...current, coverColor: color }))}
                    className={`h-8 w-8 rounded-full border shadow-sm ${bookDraft.coverColor === color ? 'border-accent ring-2 ring-accent-soft' : 'border-white/70'}`}
                    style={{ backgroundColor: color }}
                    aria-label={color}
                  />
                ))}
              </div>
            </section>
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{t('journalHome.coverStyle')}</p>
              <div className="grid grid-cols-3 gap-2">
                {BOOK_COVER_STYLES.map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => setBookDraft((current) => ({ ...current, coverStyle: style }))}
                    className={`h-10 rounded-xl border px-3 text-sm font-semibold transition-colors ${bookDraft.coverStyle === style ? 'border-accent bg-accent-soft text-accent' : 'border-border-color bg-bg-card text-text-secondary hover:border-border-hover'}`}
                  >
                    {t(`journalHome.coverStyle.${style}` as never)}
                  </button>
                ))}
              </div>
            </section>
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{t('journalHome.coverDecoration')}</p>
              <div className="grid grid-cols-3 gap-2">
                {BOOK_COVER_DECORATIONS.map((decoration) => (
                  <button
                    key={decoration}
                    type="button"
                    onClick={() => setBookDraft((current) => ({ ...current, coverDecoration: decoration }))}
                    className={`h-10 rounded-xl border px-3 text-sm font-semibold transition-colors ${bookDraft.coverDecoration === decoration ? 'border-accent bg-accent-soft text-accent' : 'border-border-color bg-bg-card text-text-secondary hover:border-border-hover'}`}
                  >
                    {t(`journalHome.coverDecoration.${decoration}` as never)}
                  </button>
                ))}
              </div>
            </section>
          </div>
          <div className="flex justify-end gap-2 lg:col-span-2">
            <Button variant="secondary" size="sm" onClick={() => setBookEditorOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" size="sm" onClick={handleSaveBookEditor}>{t('journalEditor.setup.save')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function ShelfGridCard({
  item,
  index,
  motionSeconds,
  onOpen,
  onDelete,
  onEditBook,
  onCollect,
  collectBooks,
  t,
}: {
  item: JournalShelfItem
  index: number
  motionSeconds: number
  onOpen: () => void
  onDelete: () => void
  onEditBook?: () => void
  onCollect?: (bookId: string) => void
  collectBooks?: JournalBook[]
  t: ReturnType<typeof useI18n>['t']
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const title = item.kind === 'book' ? item.book.title : item.page.title || 'Page'
  const date = item.kind === 'book'
    ? item.book.date_label || item.book.created_at.slice(0, 4)
    : item.page.date_label || item.page.created_at.slice(0, 4)
  const pages = item.kind === 'book' ? item.book.page_count || 0 : 1

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: motionSeconds, delay: Math.min(index * 0.012, 0.06), ease: 'easeOut' }}
      className="group relative max-w-[180px]"
    >
      <motion.button type="button" onClick={onOpen} whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }} className="block w-full text-left">
        {item.kind === 'book' ? <BookCover book={item.book} /> : <LoosePageCover page={item.page} />}
      </motion.button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          setMenuOpen((open) => !open)
        }}
        className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-bg-card text-accent shadow-sm transition-colors hover:bg-bg-secondary"
        title={t('journalHome.actions')}
      >
        <MoreHorizontal size={16} />
      </button>
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className="absolute right-3 top-12 z-30 w-48 rounded-xl border border-border-color bg-bg-primary p-1.5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            {item.kind === 'postcard' && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  onOpen()
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary"
              >
                <BookOpen size={14} className="text-accent" />
                {t('journalHome.open')}
              </button>
            )}
            {item.kind === 'book' && onEditBook && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  onEditBook()
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary"
              >
                <Pencil size={14} className="text-accent" />
                {t('journalHome.editBook')}
              </button>
            )}
            {item.kind === 'postcard' && onCollect && collectBooks && collectBooks.length > 0 && (
              <div className="my-1 border-t border-border-color pt-1">
                <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">{t('journalPage.collect')}</p>
                {collectBooks.map((book) => (
                  <button
                    key={book.id}
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      onCollect(book.id)
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary"
                  >
                    <BookOpen size={14} className="text-accent" />
                    <span className="min-w-0 flex-1 truncate">{book.title}</span>
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                onDelete()
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-red-500 hover:bg-bg-secondary"
            >
              <Trash2 size={14} />
              {t('journalHome.delete')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="mt-3">
        <h3 className="truncate text-sm font-semibold text-text-primary">{title}</h3>
        <p className="mt-1 text-xs text-accent">{date}</p>
        <p className="mt-1 text-xs text-accent">{pages} page{pages === 1 ? '' : 's'}</p>
      </div>
    </motion.div>
  )
}

function ShelfListRow({ item, onOpen }: { item: JournalShelfItem; onOpen: () => void }) {
  const title = item.kind === 'book' ? item.book.title : item.page.title || 'Page'
  const description = item.kind === 'book' ? item.book.description : item.page.description
  const date = item.kind === 'book'
    ? item.book.date_label || item.book.created_at.slice(0, 4)
    : item.page.date_label || item.page.created_at.slice(0, 4)
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-4 rounded-2xl border border-border-color bg-bg-card p-3 text-left shadow-sm transition-colors hover:border-border-hover"
    >
      <span className="flex h-20 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-bg-secondary">
        {item.kind === 'book' ? <BookCover book={item.book} compact /> : <FileImage size={22} className="text-accent" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-text-primary">{title}</p>
        <p className="mt-1 line-clamp-1 text-sm text-text-muted">{description || item.oshi.name}</p>
      </div>
      <span className="text-sm text-text-muted">{date}</span>
    </button>
  )
}

function LoosePageCover({ page }: { page: JournalPage }) {
  return (
    <div
      className="relative aspect-[0.68] w-full overflow-hidden rounded-[14px] border border-border-color shadow-[0_14px_28px_rgba(66,90,130,0.16)]"
      style={getJournalBackgroundPreset(page.background).canvasBackground}
    >
      <div className="absolute inset-3 rounded-[10px] border border-border-color/80" />
      <div className="absolute left-5 top-8 h-12 w-16 rotate-[-3deg] rounded-xl bg-[var(--journal-sticker-2)] shadow-sm" />
      <div className="absolute bottom-20 right-5 h-11 w-20 rotate-[2deg] rounded-xl bg-[var(--journal-sticker-4)] shadow-sm" />
      <FileImage size={28} className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 text-accent" />
      <div className="absolute inset-x-5 bottom-8 text-center">
        <p className="truncate text-sm font-semibold text-text-primary">{page.title || 'Page'}</p>
        <p className="mt-2 text-xs text-accent">{page.date_label || page.created_at.slice(0, 4)}</p>
      </div>
    </div>
  )
}

function BookCover({ book, compact = false }: { book: JournalBook; compact?: boolean }) {
  const isDark = book.cover_style === 'night'
  const decoration = renderCoverDecorationIcon(book.cover_decoration, compact, isDark)
  return (
    <div
      className={`${compact ? 'h-20 w-14 rounded-lg' : 'aspect-[0.68] w-full rounded-r-[14px] rounded-l-lg'} journal-book-cover relative overflow-hidden border text-center shadow-[0_14px_28px_rgba(66,90,130,0.16)]`}
      style={{
        backgroundColor: book.cover_color || '#c9c5f3',
        borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(80,95,130,0.16)',
      }}
    >
      <span className={`${compact ? 'w-2' : 'w-4'} absolute inset-y-0 left-0 bg-black/10 shadow-[inset_-2px_0_2px_rgba(255,255,255,0.22)]`} />
      <span className="pointer-events-none absolute inset-0 opacity-55 [background-image:linear-gradient(90deg,rgba(255,255,255,0.24)_0,rgba(255,255,255,0)_28%),radial-gradient(circle_at_20%_18%,rgba(255,255,255,0.5)_0,rgba(255,255,255,0)_18%),radial-gradient(circle_at_82%_70%,rgba(0,0,0,0.09)_0,rgba(0,0,0,0)_22%)]" />
      <span className="pointer-events-none absolute inset-0 opacity-45" style={getBookCoverPattern(book.cover_style)} />
      <span className="pointer-events-none absolute inset-2 rounded-[10px] border border-white/24" />
      {decoration && (
        <span className={`absolute left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full border border-white/35 bg-white/18 shadow-sm ${compact ? 'bottom-3 h-6 w-6' : 'bottom-[16%] h-12 w-12'}`}>
          {decoration}
        </span>
      )}
      {!compact && (
        <>
          <div className={`absolute inset-x-5 top-[30%] text-sm font-semibold leading-snug ${isDark ? 'text-white/78' : 'text-[#56667f]'}`}>
            {book.title}
          </div>
          <div className={`absolute inset-x-6 top-[49%] text-[11px] ${isDark ? 'text-white/55' : 'text-[#7c8da5]'}`}>
            {book.date_label || book.created_at.slice(0, 4)}
          </div>
          {!decoration && <BookOpen size={30} className={`absolute bottom-[18%] left-1/2 -translate-x-1/2 ${isDark ? 'text-white/58' : 'text-[#64748b]'}`} />}
        </>
      )}
    </div>
  )
}

function getBookCoverPattern(style: JournalCoverStyle): CSSProperties {
  if (style === 'paper') {
    return {
      backgroundImage: 'radial-gradient(rgba(255,255,255,.55) 1px, transparent 1px), radial-gradient(rgba(0,0,0,.08) 1px, transparent 1px)',
      backgroundSize: '14px 14px, 22px 22px',
    }
  }
  if (style === 'classic') {
    return {
      backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,.28) 0 1px, transparent 1px), linear-gradient(0deg, rgba(0,0,0,.09) 0 1px, transparent 1px)',
      backgroundSize: '32px 100%, 100% 46px',
    }
  }
  if (style === 'minimal') {
    return {
      backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,.32), transparent 48%)',
    }
  }
  if (style === 'postcard') {
    return {
      backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,.32) 12%, transparent 12% 88%, rgba(255,255,255,.22) 88%), repeating-linear-gradient(0deg, transparent 0 18px, rgba(0,0,0,.08) 18px 19px)',
    }
  }
  if (style === 'night') {
    return {
      backgroundImage: 'radial-gradient(circle at 25% 22%, rgba(255,255,255,.45), transparent 2px), radial-gradient(circle at 70% 45%, rgba(255,255,255,.32), transparent 1.5px), linear-gradient(145deg, rgba(255,255,255,.08), transparent 55%)',
      backgroundSize: '42px 42px, 58px 58px, auto',
    }
  }
  return {
    backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,.12) 0 1px, transparent 1px 5px)',
  }
}

function renderCoverDecorationIcon(decoration: JournalCoverDecoration, compact: boolean, isDark: boolean) {
  const size = compact ? 15 : 25
  const className = isDark ? 'text-white/70' : 'text-[#64748b]'
  if (decoration === 'flower') return <Flower size={size} className={className} />
  if (decoration === 'moon') return <Moon size={size} className={className} />
  if (decoration === 'heart') return <Heart size={size} className={className} />
  if (decoration === 'camera') return <Camera size={size} className={className} />
  if (decoration === 'ticket') return <Ticket size={size} className={className} />
  return null
}

function IconToggle({ active, title, onClick, children }: { active: boolean; title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" title={title} onClick={onClick} className={`rounded-xl p-2 transition-colors ${active ? 'bg-accent-soft/25 text-accent' : 'text-text-muted hover:text-accent'}`}>
      {children}
    </button>
  )
}

function sortShelfItem(a: JournalShelfItem, b: JournalShelfItem) {
  return dateValue(getItemDate(b)) - dateValue(getItemDate(a))
}

function getItemDate(item: JournalShelfItem) {
  return item.kind === 'book'
    ? item.book.updated_at || item.book.created_at
    : item.page.updated_at || item.page.created_at
}

function dateValue(value: string) {
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : 0
}
