import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, LayoutGrid, Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '../../ui/Button'
import { useJournalStore } from '../../../stores/journalStore'
import { useNoteStore } from '../../../stores/noteStore'
import type { JournalItemWithNote } from '../../../types'
import { autoArrangeNotes, clampLayout, type JournalLayoutInput } from '../../../features/journal/journalLayout'
import { JournalCanvas } from './JournalCanvas'
import { JournalNotePicker } from './JournalNotePicker'
import { JournalStickerPopover } from './JournalStickerPopover'

interface JournalPageViewProps {
  oshiId: string
  bookId: string
  bookTitle: string
  onBack: () => void
}

export function JournalPageView({ oshiId, bookId, bookTitle, onBack }: JournalPageViewProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [showNotePicker, setShowNotePicker] = useState(false)
  const {
    pages,
    activePageId,
    items,
    unplacedNotes,
    loading,
    error,
    openBook,
    setActivePage,
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

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border-color bg-bg-secondary/10 px-4 py-3">
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
          {showNotePicker && (
            <JournalNotePicker
              notes={unplacedNotes}
              onPlaceNote={handlePlaceNote}
              onClose={() => setShowNotePicker(false)}
            />
          )}
          {selectedItem && (
            <JournalStickerPopover
              oshiId={oshiId}
              selectedItem={selectedItem}
              items={items}
              onUpdateLayout={handleInspectorLayout}
              onUpdateStyle={updateItemStyle}
              onRemove={handleRemove}
              onToggleFavorite={handleToggleFavorite}
              onUpdateNote={handleUpdateNote}
            />
          )}
        </div>
      </div>

      {pages.length > 0 && (
        <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-t border-border-color bg-bg-secondary/10 px-4 py-3">
          {pages.map((page) => (
            <button
              key={page.id}
              type="button"
              onClick={() => {
                setSelectedItemId(null)
                setActivePage(page.id)
              }}
              className={`min-w-20 rounded-lg border px-3 py-2 text-sm transition-colors ${
                page.id === activePageId
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-border-color bg-bg-primary text-text-secondary hover:border-border-hover'
              }`}
            >
              P.{page.page_index + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
