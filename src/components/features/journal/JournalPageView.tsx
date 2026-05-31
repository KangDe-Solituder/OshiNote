import { useEffect, useMemo, useState } from 'react'
import { LayoutGrid, Loader2, Plus } from 'lucide-react'
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
  archiveId: string
}

export function JournalPageView({ oshiId, archiveId }: JournalPageViewProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [showNotePicker, setShowNotePicker] = useState(false)
  const {
    pages,
    activePageId,
    items,
    unplacedNotes,
    loading,
    error,
    loadArchiveJournal,
    setActivePage,
    createPage,
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
    loadArchiveJournal(archiveId)
  }, [archiveId, loadArchiveJournal])

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
    await loadUnplacedNotes(archiveId)
    setShowNotePicker(true)
  }

  async function handlePlaceNote(noteId: string) {
    await placeNote(noteId, archiveId)
  }

  async function handleUpdateNote(noteId: string, input: Parameters<typeof updateNote>[1]) {
    await updateNote(noteId, input)
    await refreshItems()
  }

  async function handleRemove(itemId: string) {
    await removeItem(itemId)
    if (selectedItemId === itemId) setSelectedItemId(null)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border-color bg-bg-secondary/10 px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="text-sm font-semibold text-text-primary">{activePage?.title || 'Journal'}</span>
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
        <Button variant="secondary" size="sm" onClick={() => createPage(archiveId)}>
          <Plus size={15} />
          Page
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
