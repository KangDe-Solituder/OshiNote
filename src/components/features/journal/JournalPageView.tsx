import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, BookOpen, Check, ChevronDown, FileImage, ImageIcon, LayoutGrid, Loader2, MoreHorizontal, Palette, Plus, Trash2, X } from 'lucide-react'
import { Button } from '../../ui/Button'
import { PAGE_CONTENT_CLASS, PAGE_HEADER_CLASS } from '../../layout/pageShell'
import { useJournalStore } from '../../../stores/journalStore'
import { useNoteStore } from '../../../stores/noteStore'
import type { JournalBook, JournalItemWithNote, JournalPage, Stamp } from '../../../types'
import { autoArrangeNotes, clampLayout, getJournalCanvasSize, type JournalLayoutInput } from '../../../features/journal/journalLayout'
import { fetchJournalItems } from '../../../features/journal/journalService'
import { JournalCanvas } from './JournalCanvas'
import { getPageBackground } from './journalCanvasStyle'
import { JournalNotePicker } from './JournalNotePicker'
import { JournalIllustrationPicker } from './JournalIllustrationPicker'
import { JournalStickerPopover } from './JournalStickerPopover'
import { usePageTransition, usePanelTransition, usePopoverTransition } from '../themes/uiMotion'
import { useI18n } from '../../../i18n/useI18n'
import { fetchStampForTarget } from '../../../features/stamps/stampService'
import { StampOverlay } from '../stamps/StampOverlay'

interface JournalPageViewProps {
  oshiId: string
  bookId: string | null
  bookTitle: string
  standalonePostcard?: JournalPage | null
  onBack: () => void
}

type Translate = ReturnType<typeof useI18n>['t']

export function JournalPageView({ oshiId, bookId, bookTitle, standalonePostcard = null, onBack }: JournalPageViewProps) {
  const { t } = useI18n()
  const pageTransition = usePageTransition()
  const panelTransition = usePanelTransition()
  const popoverTransition = usePopoverTransition()
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [viewingPageId, setViewingPageId] = useState<string | null>(standalonePostcard?.id || null)
  const [previewItemsByPageId, setPreviewItemsByPageId] = useState<Record<string, JournalItemWithNote[]>>({})
  const [stampsByPageId, setStampsByPageId] = useState<Record<string, Stamp | null>>({})
  const [zoom, setZoom] = useState(1)
  const [showNotePicker, setShowNotePicker] = useState(false)
  const [showIllustrationPicker, setShowIllustrationPicker] = useState(false)
  const [showPageEditor, setShowPageEditor] = useState(false)
  const [showPageSidebar, setShowPageSidebar] = useState(false)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [showPageActions, setShowPageActions] = useState(false)
  const [pageDraft, setPageDraft] = useState({ title: '', description: '', date_label: '', background: 'paper' })
  const {
    books,
    pages,
    activePageId,
    items,
    unplacedNotes,
    unplacedIllustrations,
    loading,
    error,
    openBook,
    setActivePage,
    updatePage,
    createPage,
    deletePage,
    collectPostcard,
    detachPage,
    deletePostcard,
    placeNote,
    placeIllustration,
    loadUnplacedNotes,
    loadUnplacedIllustrations,
    updateItemLayout,
    updateItemStyle,
    removeItem,
    refreshItems,
  } = useJournalStore()
  const toggleFavorite = useNoteStore((state) => state.toggleFavorite)
  const updateNote = useNoteStore((state) => state.updateNote)

  useEffect(() => {
    if (bookId) openBook(bookId, oshiId)
  }, [bookId, openBook, oshiId])

  useEffect(() => {
    setViewingPageId(standalonePostcard?.id || null)
    setSelectedItemId(null)
    setShowPageSidebar(false)
  }, [bookId, standalonePostcard?.id])

  const activePage = useMemo(
    () => pages.find((page) => page.id === activePageId) || pages[0] || null,
    [activePageId, pages]
  )
  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) || null,
    [items, selectedItemId]
  )
  const showPageCanvas = Boolean(standalonePostcard || viewingPageId)

  useEffect(() => {
    let alive = true
    if (pages.length === 0) {
      setPreviewItemsByPageId({})
      setStampsByPageId({})
      return
    }
    Promise.all(pages.map(async (page) => [page.id, await fetchJournalItems(page.id), await fetchStampForTarget('journal_page', page.id)] as const))
      .then((entries) => {
        if (!alive) return
        setPreviewItemsByPageId(Object.fromEntries(entries.map(([pageId, pageItems]) => [pageId, pageItems])))
        setStampsByPageId(Object.fromEntries(entries.map(([pageId, , stamp]) => [pageId, stamp])))
      })
      .catch(() => {
        if (alive) {
          setPreviewItemsByPageId({})
          setStampsByPageId({})
        }
      })
    return () => { alive = false }
  }, [pages])

  useEffect(() => {
    if (!activePageId) return
    setPreviewItemsByPageId((current) => ({ ...current, [activePageId]: items }))
  }, [activePageId, items])

  useEffect(() => {
    if (!activePage) return
    setPageDraft({
      title: activePage.title || t('journalPage.pageNumber', { number: activePage.page_index + 1 }),
      description: activePage.description || '',
      date_label: activePage.date_label || '',
      background: activePage.background || 'paper',
    })
  }, [activePage, t])

  async function handleCommitLayout(itemId: string, layout: JournalLayoutInput) {
    const item = items.find((candidate) => candidate.id === itemId)
    await updateItemLayout(itemId, {
      ...layout,
      z_index: item?.z_index,
    })
  }

  async function handleInspectorLayout(item: JournalItemWithNote, layout: JournalLayoutInput & { z_index?: number }) {
    await updateItemLayout(item.id, layout)
  }

  async function handleAutoArrange() {
    const noteItems = items.filter((item) => item.note)
    const layouts = autoArrangeNotes(noteItems.map((item) => item.note!))
    await Promise.all(items.map((item) => {
      if (!item.note) return Promise.resolve()
      const layout = layouts.get(item.note.id)
      if (!layout) return Promise.resolve()
      return updateItemLayout(item.id, {
        ...clampLayout(layout),
        z_index: item.z_index,
      })
    }))
  }

  async function handleToggleFavorite(noteId: string) {
    await toggleFavorite(noteId)
    await refreshItems()
  }

  async function handleOpenNotePicker() {
    await loadUnplacedNotes(oshiId)
    setShowIllustrationPicker(false)
    setShowNotePicker(true)
  }

  async function handlePlaceNote(noteId: string) {
    if (!showPageCanvas) return
    await placeNote(noteId, oshiId)
    const placedItem = useJournalStore.getState().items.find((item) => item.note?.id === noteId)
    if (placedItem) setSelectedItemId(placedItem.id)
  }

  async function handleOpenIllustrationPicker() {
    await loadUnplacedIllustrations(oshiId)
    setShowNotePicker(false)
    setShowIllustrationPicker(true)
  }

  async function handlePlaceIllustration(illustrationId: string) {
    if (!showPageCanvas) return
    await placeIllustration(illustrationId, oshiId)
    const placedItem = useJournalStore.getState().items.find((item) => item.illustration?.id === illustrationId)
    if (placedItem) setSelectedItemId(placedItem.id)
  }

  async function handleUpdateNote(noteId: string, input: Parameters<typeof updateNote>[1]) {
    await updateNote(noteId, input)
    await refreshItems()
  }

  async function handleRemove(itemId: string) {
    await removeItem(itemId)
    if (selectedItemId === itemId) setSelectedItemId(null)
  }

  async function handleDeletePage() {
    if (!activePage || !bookId || pages.length <= 1) return
    if (!confirm(t('journalPage.deletePageConfirm', { title: activePage.title || t('journalPage.pageNumber', { number: activePage.page_index + 1 }) }))) return
    setSelectedItemId(null)
    await deletePage(activePage.id, bookId)
    setViewingPageId(null)
  }

  async function handleDeleteStandalonePostcard() {
    if (!activePage || !standalonePostcard) return
    if (!confirm(t('journalPage.deleteLooseConfirm', { title: activePage.title || t('journalPage.untitledLoosePage') }))) return
    await deletePostcard(activePage.id, oshiId)
    onBack()
  }

  async function handleSavePage() {
    if (!activePage) return
    await updatePage(activePage.id, {
      title: pageDraft.title.trim() || t('journalPage.pageNumber', { number: activePage.page_index + 1 }),
      description: pageDraft.description.trim(),
      date_label: pageDraft.date_label.trim(),
      background: pageDraft.background,
    })
    setShowPageEditor(false)
  }

  async function handleCreatePage() {
    if (!bookId) return
    await createPage(bookId)
    const nextPageId = useJournalStore.getState().activePageId
    if (nextPageId) setViewingPageId(nextPageId)
  }

  function handleOpenPage(pageId: string) {
    setSelectedItemId(null)
    setViewingPageId(pageId)
    setActivePage(pageId, oshiId)
  }

  function handleBack() {
    if (bookId && showPageCanvas && !standalonePostcard) {
      setSelectedItemId(null)
      setShowNotePicker(false)
      setShowIllustrationPicker(false)
      setShowPageEditor(false)
      setShowAddMenu(false)
      setShowPageActions(false)
      setViewingPageId(null)
      return
    }
    onBack()
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border-color bg-bg-primary/95">
        <div className={`${PAGE_HEADER_CLASS} h-20 gap-3 border-b-0`}>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button type="button" onClick={handleBack} className="rounded-lg p-2 text-text-muted hover:bg-bg-tertiary hover:text-text-primary" title={bookId && showPageCanvas && !standalonePostcard ? t('journalPage.backToPages') : t('journalPage.backToJournal')}>
              <ArrowLeft size={20} />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold text-text-primary">{bookTitle}</h1>
              <p className="mt-0.5 truncate text-sm text-text-secondary">{showPageCanvas ? activePage?.title || t('journalPage.page') : t('journalPage.pages')}</p>
            </div>
            {loading && <Loader2 size={15} className="animate-spin text-accent" />}
            {error && <span className="truncate text-xs text-red-500">{error}</span>}
          </div>
          {!standalonePostcard && (
            <Button variant="secondary" size="sm" onClick={() => setShowPageSidebar(!showPageSidebar)}>
              <LayoutGrid size={15} />
              {t('journalPage.pages')}
            </Button>
          )}
          {showPageCanvas ? (
            <>
              <Button variant="secondary" size="sm" onClick={() => setShowPageEditor(!showPageEditor)}>
                <Palette size={15} />
                {t('journalPage.pageSetup')}
              </Button>
              <div className="relative">
                <Button variant="secondary" size="sm" onClick={() => setShowAddMenu(!showAddMenu)}>
                  <Plus size={15} />
                  {t('journalPage.add')}
                  <ChevronDown size={14} />
                </Button>
                <AnimatePresence>
                  {showAddMenu && (
                    <motion.div
                      {...popoverTransition}
                      className="absolute right-0 top-10 z-50 w-56 rounded-xl border border-border-color bg-bg-primary p-1.5 shadow-xl"
                    >
                      <button type="button" onClick={() => { handleOpenNotePicker(); setShowAddMenu(false) }} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary">
                        <Plus size={14} className="text-accent" />
                        {t('journalPage.note')}
                      </button>
                      <button type="button" onClick={() => { handleOpenIllustrationPicker(); setShowAddMenu(false) }} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary">
                        <ImageIcon size={14} className="text-accent" />
                        {t('journalPage.illustration')}
                      </button>
                      {!standalonePostcard && bookId && (
                        <button type="button" onClick={() => { handleCreatePage(); setShowAddMenu(false) }} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary">
                          <FileImage size={14} className="text-accent" />
                          {t('journalPage.page')}
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          ) : (
            bookId && (
              <Button variant="secondary" size="sm" onClick={handleCreatePage}>
                <Plus size={15} />
                {t('journalPage.page')}
              </Button>
            )
          )}
          {showPageCanvas && !standalonePostcard && bookId && (
            <div className="relative">
              <Button variant="secondary" size="sm" onClick={() => setShowPageActions(!showPageActions)}>
                <MoreHorizontal size={15} />
              </Button>
              <AnimatePresence>
                {showPageActions && (
                  <motion.div
                    {...popoverTransition}
                    className="absolute right-0 top-10 z-50 w-52 rounded-xl border border-border-color bg-bg-primary p-1.5 shadow-xl"
                  >
                    <button type="button" onClick={() => { handleAutoArrange(); setShowPageActions(false) }} disabled={items.length === 0} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary disabled:pointer-events-none disabled:opacity-50">
                      <LayoutGrid size={14} className="text-accent" />
                      {t('journalPage.autoArrange')}
                    </button>
                    <button type="button" onClick={() => { if (activePage) detachPage(activePage.id, oshiId); setShowPageActions(false) }} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary">
                      <FileImage size={14} className="text-accent" />
                      {t('journalPage.saveAsLoose')}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
          {showPageCanvas && !standalonePostcard && bookId && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDeletePage}
                disabled={pages.length <= 1}
                title={pages.length <= 1 ? t('journalPage.needsOnePage') : t('journalPage.deleteCurrentPage')}
              >
                <Trash2 size={15} />
                {t('journalPage.delete')}
              </Button>
            </>
          )}
          {standalonePostcard && activePage && (
            <>
              <CollectMenu books={books} onCollect={(targetBookId) => collectPostcard(activePage.id, targetBookId, oshiId).then(onBack)} t={t} />
              <Button variant="secondary" size="sm" onClick={handleDeleteStandalonePostcard}>
                <Trash2 size={15} />
                {t('journalPage.delete')}
              </Button>
            </>
          )}
        </div>
        <AnimatePresence initial={false}>
          {showPageEditor && (
            <motion.div
              {...panelTransition}
              className="flex flex-wrap items-center gap-3 overflow-hidden border-t border-border-color px-4 py-3"
            >
              <input
                value={pageDraft.title}
                onChange={(event) => setPageDraft({ ...pageDraft, title: event.target.value })}
                className="min-w-56 rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-soft"
                placeholder={t('journalPage.pageTitle')}
                aria-label={t('journalPage.pageTitle')}
              />
              <input
                value={pageDraft.date_label}
                onChange={(event) => setPageDraft({ ...pageDraft, date_label: event.target.value })}
                className="min-w-36 rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-soft"
                placeholder={t('journalPage.dateLabel')}
                aria-label={t('journalPage.dateLabel')}
              />
              <input
                value={pageDraft.description}
                onChange={(event) => setPageDraft({ ...pageDraft, description: event.target.value })}
                className="min-w-64 flex-1 rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-soft"
                placeholder={t('journalPage.pageDescription')}
                aria-label={t('journalPage.pageDescription')}
              />
              <div className="flex flex-wrap gap-1">
                {PAGE_BACKGROUNDS.map((background) => (
                  <button
                    key={background.id}
                    type="button"
                    onClick={() => setPageDraft({ ...pageDraft, background: background.id })}
                    className={`rounded-lg border px-3 py-2 text-xs transition-colors ${pageDraft.background === background.id ? 'border-accent bg-accent-soft text-accent' : 'border-border-color bg-bg-primary text-text-secondary hover:border-border-hover'}`}
                  >
                    {t(background.labelKey)}
                  </button>
                ))}
              </div>
              <button type="button" onClick={handleSavePage} className="rounded-lg p-2 text-accent hover:bg-bg-tertiary" title={t('journalPage.savePage')}><Check size={16} /></button>
              <button type="button" onClick={() => setShowPageEditor(false)} className="rounded-lg p-2 text-text-muted hover:bg-bg-tertiary hover:text-text-primary" title={t('common.cancel')}><X size={16} /></button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex min-h-0 flex-1">
        <AnimatePresence initial={false}>
          {!standalonePostcard && showPageSidebar && (
              <PageSidebar
                pages={pages}
                activePageId={activePageId}
                itemsByPageId={previewItemsByPageId}
                stampsByPageId={stampsByPageId}
                onCreate={handleCreatePage}
                onSelect={handleOpenPage}
                t={t}
              />
          )}
        </AnimatePresence>
        <div className="relative flex min-w-0 flex-1">
          <AnimatePresence mode="wait">
            {showPageCanvas ? (
              <motion.div key="canvas" {...pageTransition} className="h-full min-w-0 flex-1">
                <JournalCanvas
                  page={activePage}
                  items={items}
                  selectedItemId={selectedItemId}
                  loading={loading}
                  zoom={zoom}
                  stamp={activePage ? stampsByPageId[activePage.id] : null}
                  onZoomChange={setZoom}
                  onSelectItem={(item) => setSelectedItemId(item?.id || null)}
                  onCommitLayout={handleCommitLayout}
                />
              </motion.div>
            ) : (
              <PageGallery
                key="gallery"
                pages={pages}
                loading={loading}
                itemsByPageId={previewItemsByPageId}
                stampsByPageId={stampsByPageId}
                transition={pageTransition}
                onCreate={handleCreatePage}
                onSelect={handleOpenPage}
                t={t}
              />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {showNotePicker && (
              <JournalNotePicker
                notes={unplacedNotes}
                onPlaceNote={handlePlaceNote}
                onClose={() => setShowNotePicker(false)}
              />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {showIllustrationPicker && (
              <JournalIllustrationPicker
                illustrations={unplacedIllustrations}
                onPlaceIllustration={handlePlaceIllustration}
                onClose={() => setShowIllustrationPicker(false)}
              />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {selectedItem && (
              <JournalStickerPopover
                key={selectedItem.id}
                oshiId={oshiId}
                selectedItem={selectedItem}
                items={items}
                onUpdateLayout={handleInspectorLayout}
                onUpdateStyle={updateItemStyle}
                onRemove={handleRemove}
                onToggleFavorite={handleToggleFavorite}
                onUpdateNote={handleUpdateNote}
                onClose={() => setSelectedItemId(null)}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

function CollectMenu({ books, onCollect, t }: { books: JournalBook[]; onCollect: (bookId: string) => void; t: Translate }) {
  const [open, setOpen] = useState(false)
  const popoverTransition = usePopoverTransition()
  return (
    <div className="relative">
      <Button variant="secondary" size="sm" onClick={() => setOpen(!open)} disabled={books.length === 0}>
        <BookOpen size={15} />
        {t('journalPage.collect')}
      </Button>
      <AnimatePresence>
        {open && (
          <motion.div
            {...popoverTransition}
            className="absolute right-0 top-11 z-50 w-56 rounded-xl border border-border-color bg-bg-primary p-1.5 shadow-xl"
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

function PageGallery({
  pages,
  loading,
  itemsByPageId,
  stampsByPageId,
  transition,
  onCreate,
  onSelect,
  t,
}: {
  pages: JournalPage[]
  loading: boolean
  itemsByPageId: Record<string, JournalItemWithNote[]>
  stampsByPageId: Record<string, Stamp | null>
  transition: ReturnType<typeof usePageTransition>
  onCreate: () => void
  onSelect: (pageId: string) => void
  t: Translate
}) {
  return (
    <motion.div {...transition} className={`${PAGE_CONTENT_CLASS} h-full min-w-0 flex-1 bg-bg-primary`}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-text-primary">{t('journalPage.pages')}</h3>
            <p className="mt-1 text-sm text-text-secondary">{t('journalPage.pagesDescription')}</p>
          </div>
          <Button variant="primary" size="md" onClick={onCreate}>
            <Plus size={16} />
            {t('journalPage.page')}
          </Button>
        </div>
        {loading && pages.length === 0 ? (
          <Loader2 size={24} className="mx-auto mt-20 animate-spin text-accent" />
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {pages.map((page) => (
              <PagePreviewCard key={page.id} page={page} items={itemsByPageId[page.id] || []} stamp={stampsByPageId[page.id]} active={false} onSelect={() => onSelect(page.id)} t={t} />
            ))}
            <button
              type="button"
              onClick={onCreate}
              className="flex aspect-[1.4] flex-col items-center justify-center rounded-2xl border border-dashed border-border-color bg-bg-secondary/20 text-accent transition-colors hover:border-border-hover hover:bg-bg-secondary/40"
            >
              <Plus size={24} />
              <span className="mt-3 text-sm font-semibold">{t('journalPage.newPage')}</span>
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function PageSidebar({
  pages,
  activePageId,
  itemsByPageId,
  stampsByPageId,
  onCreate,
  onSelect,
  t,
}: {
  pages: JournalPage[]
  activePageId: string | null
  itemsByPageId: Record<string, JournalItemWithNote[]>
  stampsByPageId: Record<string, Stamp | null>
  onCreate: () => void
  onSelect: (pageId: string) => void
  t: Translate
}) {
  const pageTransition = usePageTransition()
  return (
    <motion.aside {...pageTransition} className="hidden w-72 shrink-0 overflow-y-auto border-r border-border-color bg-bg-secondary/10 p-3 md:block">
      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        <div>
          <h3 className="text-sm font-bold text-text-primary">{t('journalPage.pages')}</h3>
          <p className="text-xs text-text-muted">{t('journalPage.totalPages', { count: pages.length })}</p>
        </div>
        <button type="button" onClick={onCreate} className="rounded-lg p-2 text-accent hover:bg-bg-tertiary" title={t('journalPage.newPage')}>
          <Plus size={16} />
        </button>
      </div>
      <div className="space-y-3">
        {pages.map((page) => (
          <PagePreviewCard
            key={page.id}
            page={page}
            items={itemsByPageId[page.id] || []}
            stamp={stampsByPageId[page.id]}
            active={page.id === activePageId}
            compact
            onSelect={() => onSelect(page.id)}
            t={t}
          />
        ))}
      </div>
    </motion.aside>
  )
}

function PagePreviewCard({
  page,
  items,
  stamp,
  active,
  compact = false,
  onSelect,
  t,
}: {
  page: JournalPage
  items: JournalItemWithNote[]
  stamp?: Stamp | null
  active: boolean
  compact?: boolean
  onSelect: () => void
  t: Translate
}) {
  const canvasSize = getJournalCanvasSize(items)
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-2xl border bg-bg-card p-3 text-left shadow-sm transition-colors ${
        active ? 'border-accent ring-2 ring-accent-soft/30' : 'border-border-color hover:border-border-hover'
      }`}
    >
      <div className="relative aspect-[1.4] overflow-hidden rounded-xl border border-border-color" style={getPageBackground(page.background || 'paper')}>
        {items.map((item) => (
          <span
            key={item.id}
            className="absolute overflow-hidden rounded-md border shadow-sm"
            style={{
              left: `${(item.x / canvasSize.width) * 100}%`,
              top: `${(item.y / canvasSize.height) * 100}%`,
              width: `${(item.width / canvasSize.width) * 100}%`,
              height: `${(item.height / canvasSize.height) * 100}%`,
              transform: `rotate(${item.rotation}deg)`,
              backgroundColor: item.item_type === 'illustration' ? 'var(--color-bg-card)' : getPreviewStickerBackground(item.color),
              borderColor: 'color-mix(in srgb, var(--color-accent) 24%, transparent)',
            }}
          >
            {item.item_type === 'illustration' ? (
              <span className="flex h-full w-full items-center justify-center bg-bg-tertiary text-text-muted">
                <ImageIcon size={compact ? 12 : 16} />
              </span>
            ) : (
              <span className="flex h-full flex-col gap-1 p-1.5">
                <span className="h-1.5 w-2/3 rounded-full bg-text-primary/35" />
                <span className="h-1 w-full rounded-full bg-text-secondary/25" />
                <span className="h-1 w-4/5 rounded-full bg-text-secondary/20" />
              </span>
            )}
          </span>
        ))}
        <StampOverlay stamp={stamp || null} />
        <span className="absolute right-3 top-3 rounded-full bg-bg-card/90 px-2 py-0.5 text-xs font-semibold text-accent">
          {page.page_index + 1}
        </span>
      </div>
      <p className="mt-3 truncate text-sm font-semibold text-text-primary">{page.title || t('journalPage.pageNumber', { number: page.page_index + 1 })}</p>
      {!compact && <p className="mt-1 line-clamp-1 text-xs text-text-muted">{page.description || page.date_label || t('common.noDescription')}</p>}
    </button>
  )
}

function getPreviewStickerBackground(color: string | null): string {
  const paletteIndex = ['#fff1f5', '#eef6ff', '#fff7d6', '#f3f0ff', '#edf7ed'].indexOf(color || '#fff1f5')
  return paletteIndex >= 0 ? `var(--journal-sticker-${paletteIndex + 1})` : color || 'var(--journal-sticker-1)'
}

const PAGE_BACKGROUNDS = [
  { id: 'paper', labelKey: 'journalEditor.background.paper' },
  { id: 'grid', labelKey: 'journalEditor.background.grid' },
  { id: 'blush', labelKey: 'journalEditor.background.blush' },
  { id: 'blue', labelKey: 'journalEditor.background.blue' },
  { id: 'mint', labelKey: 'journalEditor.background.mint' },
  { id: 'postcard', labelKey: 'journalEditor.background.loose' },
] as const
