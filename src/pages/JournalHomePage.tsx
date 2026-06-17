import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, FileImage, Grid3X3, List, Loader2, MoreHorizontal, Plus, Search } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { PAGE_CONTENT_CLASS, PAGE_HEADER_CLASS } from '../components/layout/pageShell'
import { fetchJournalBooks, fetchStandalonePostcards } from '../features/journal/journalService'
import { fetchAllOshis } from '../features/oshis/oshiService'
import { useJournalStore } from '../stores/journalStore'
import type { JournalBook, JournalPage, Oshi } from '../types'
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

export function JournalHomePage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const motionSeconds = useUiMotionSeconds()
  const pageTransition = usePageTransition()
  const openPostcard = useJournalStore((state) => state.openPostcard)
  const closeBook = useJournalStore((state) => state.closeBook)
  const [items, setItems] = useState<JournalShelfItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [viewMode, setViewMode] = useState<ShelfViewMode>('grid')
  const [openedItem, setOpenedItem] = useState<JournalShelfItem | null>(null)

  useEffect(() => {
    loadShelf()
  }, [])

  async function loadShelf() {
    setLoading(true)
    try {
      const oshis = await fetchAllOshis()
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
          {t('journalHome.new')}
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
                  />
                ))}
                <button
                  type="button"
                  onClick={() => navigate('/journal/create')}
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
    </div>
  )
}

function ShelfGridCard({
  item,
  index,
  motionSeconds,
  onOpen,
}: {
  item: JournalShelfItem
  index: number
  motionSeconds: number
  onOpen: () => void
}) {
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
        className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-bg-card text-accent shadow-sm transition-colors hover:bg-bg-secondary"
        title="Actions"
      >
        <MoreHorizontal size={16} />
      </button>
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
    <div className="relative aspect-[0.68] w-full overflow-hidden rounded-[14px] border border-border-color bg-[var(--journal-canvas-bg)] shadow-[0_14px_28px_rgba(66,90,130,0.16)]">
      <div className="absolute inset-3 rounded-[10px] border border-border-color/80" />
      <div className="absolute inset-0 opacity-70 [background-image:radial-gradient(var(--journal-canvas-dot)_1px,transparent_1px)] [background-size:15px_15px]" />
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
      <span className="pointer-events-none absolute inset-2 rounded-[10px] border border-white/24" />
      {!compact && (
        <>
          <div className={`absolute inset-x-5 top-[30%] text-sm font-semibold leading-snug ${isDark ? 'text-white/78' : 'text-[#56667f]'}`}>
            {book.title}
          </div>
          <div className={`absolute inset-x-6 top-[49%] text-[11px] ${isDark ? 'text-white/55' : 'text-[#7c8da5]'}`}>
            {book.date_label || book.created_at.slice(0, 4)}
          </div>
          <BookOpen size={30} className={`absolute bottom-[18%] left-1/2 -translate-x-1/2 ${isDark ? 'text-white/58' : 'text-[#64748b]'}`} />
        </>
      )}
    </div>
  )
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
