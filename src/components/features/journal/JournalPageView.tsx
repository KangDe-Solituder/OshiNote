import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Check, LayoutGrid, Loader2, Palette, Plus, Trash2, X } from 'lucide-react'
import { Button } from '../../ui/Button'
import { useJournalStore } from '../../../stores/journalStore'
import { useNoteStore } from '../../../stores/noteStore'
import type { JournalItemWithNote } from '../../../types'
import { autoArrangeNotes, clampLayout, type JournalLayoutInput } from '../../../features/journal/journalLayout'
import { JournalCanvas } from './JournalCanvas'
import { JournalNotePicker } from './JournalNotePicker'
import { JournalStickerPopover } from './JournalStickerPopover'
import { usePanelTransition, useUiMotionSeconds } from '../themes/uiMotion'

interface JournalPageViewProps {
  oshiId: string
  bookId: string
  bookTitle: string
  onBack: () => void
}

export function JournalPageView({ oshiId, bookId, bookTitle, onBack }: JournalPageViewProps) {
  const motionSeconds = useUiMotionSeconds()
  const panelTransition = usePanelTransition()
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [showNotePicker, setShowNotePicker] = useState(false)
  const [showPageEditor, setShowPageEditor] = useState(false)
  const [pageDraft, setPageDraft] = useState({ title: '', background: 'paper' })
  const {
    pages,
    activePageId,
    items,
    unplacedNotes,
    loading,
    error,
    openBook,
    setActivePage,
    updatePage,
    createPage,
    deletePage,
    placeNote,
    loadUnplacedNotes,
    updateItemLayout,
    updateItemStyle,
    removeItem,
    refreshItems,
  } = useJournalStore()
  const toggleFavorite = useNoteStore((state) => state.toggleFavorite)
  const updateNote = useNoteStore((state) => state.updateNote)

  useEffect(() => {
    openBook(bookId, oshiId)
  }, [bookId, openBook, oshiId])

  const activePage = useMemo(
    () => pages.find((page) => page.id === activePageId) || pages[0] || null,
    [activePageId, pages]
  )
  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) || null,
    [items, selectedItemId]
  )

  useEffect(() => {
    if (!activePage) return
    setPageDraft({
      title: activePage.title || `Page ${activePage.page_index + 1}`,
      background: activePage.background || 'paper',
    })
  }, [activePage])

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
    const layouts = autoArrangeNotes(items.map((item) => item.note))
    await Promise.all(items.map((item) => {
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
    setShowNotePicker(true)
  }

  async function handlePlaceNote(noteId: string) {
    await placeNote(noteId, oshiId)
    const placedItem = useJournalStore.getState().items.find((item) => item.note.id === noteId)
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
    if (!activePage || pages.length <= 1) return
    if (!confirm(`Delete "${activePage.title || `Page ${activePage.page_index + 1}`}"? Its placed stickers will be removed from this journal page.`)) return
    setSelectedItemId(null)
    await deletePage(activePage.id, bookId)
  }

  async function handleSavePage() {
    if (!activePage) return
    await updatePage(activePage.id, {
      title: pageDraft.title.trim() || `Page ${activePage.page_index + 1}`,
      background: pageDraft.background,
    })
    setShowPageEditor(false)
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="shrink-0 border-b border-border-color bg-bg-secondary/10">
        <div className="flex items-center gap-2 px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button type="button" onClick={onBack} className="rounded-lg p-1.5 text-text-muted hover:bg-bg-tertiary hover:text-text-primary" title="Back to bookshelf">
              <ArrowLeft size={17} />
            </button>
            <span className="truncate text-sm font-semibold text-text-primary">{bookTitle}</span>
            <span className="text-xs text-text-muted">/</span>
            <span className="truncate text-xs text-text-muted">{activePage?.title || 'Journal'}</span>
            {loading && <Loader2 size={15} className="animate-spin text-accent" />}
            {error && <span className="truncate text-xs text-red-500">{error}</span>}
          </div>
          <Button variant="secondary" size="sm" onClick={() => setShowPageEditor(!showPageEditor)}>
            <Palette size={15} />
            Page
          </Button>
          <Button variant="secondary" size="sm" onClick={handleOpenNotePicker}>
            <Plus size={15} />
            Place Note
          </Button>
          <Button variant="secondary" size="sm" onClick={handleAutoArrange} disabled={items.length === 0}>
            <LayoutGrid size={15} />
            Arrange
          </Button>
          <Button variant="secondary" size="sm" onClick={() => createPage(bookId)}>
            <Plus size={15} />
            Page
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDeletePage}
            disabled={pages.length <= 1}
            title={pages.length <= 1 ? 'A journal needs at least one page' : 'Delete current page'}
          >
            <Trash2 size={15} />
            Delete Page
          </Button>
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
                placeholder="Page title"
              />
              <div className="flex flex-wrap gap-1">
                {PAGE_BACKGROUNDS.map((background) => (
                  <button
                    key={background.id}
                    type="button"
                    onClick={() => setPageDraft({ ...pageDraft, background: background.id })}
                    className={`rounded-lg border px-3 py-2 text-xs transition-colors ${pageDraft.background === background.id ? 'border-accent bg-accent-soft text-accent' : 'border-border-color bg-bg-primary text-text-secondary hover:border-border-hover'}`}
                  >
                    {background.label}
                  </button>
                ))}
              </div>
              <button type="button" onClick={handleSavePage} className="rounded-lg p-2 text-accent hover:bg-bg-tertiary" title="Save page"><Check size={16} /></button>
              <button type="button" onClick={() => setShowPageEditor(false)} className="rounded-lg p-2 text-text-muted hover:bg-bg-tertiary hover:text-text-primary" title="Cancel"><X size={16} /></button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="relative flex min-w-0 flex-1">
          <JournalCanvas
            page={activePage}
            items={items}
            selectedItemId={selectedItemId}
            loading={loading}
            onSelectItem={(item) => setSelectedItemId(item?.id || null)}
            onCommitLayout={handleCommitLayout}
          />
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

      {pages.length > 0 && (
        <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-t border-border-color bg-bg-secondary/10 px-4 py-3">
          {pages.map((page) => (
            <motion.button
              key={page.id}
              type="button"
              onClick={() => {
                setSelectedItemId(null)
                setActivePage(page.id, oshiId)
              }}
              className={`min-w-20 rounded-lg border px-3 py-2 text-sm transition-colors ${
                page.id === activePageId
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-border-color bg-bg-primary text-text-secondary hover:border-border-hover'
              }`}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: motionSeconds, ease: 'easeOut' }}
            >
              P.{page.page_index + 1}
            </motion.button>
          ))}
        </div>
      )}
    </div>
  )
}

const PAGE_BACKGROUNDS = [
  { id: 'paper', label: 'Paper' },
  { id: 'grid', label: 'Grid' },
  { id: 'blush', label: 'Blush' },
  { id: 'blue', label: 'Blue' },
  { id: 'mint', label: 'Mint' },
]
