import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  LayoutGrid,
  Loader2,
  RotateCcw,
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { PAGE_HEADER_CLASS } from '../components/layout/pageShell'
import { useJournalStore } from '../stores/journalStore'
import { useNoteStore } from '../stores/noteStore'
import type { JournalDraftItem, JournalItemWithNote, JournalPage, Stamp, StampInput } from '../types'
import { autoArrangeNotes, clampLayout, type JournalLayoutInput } from '../features/journal/journalLayout'
import {
  createCompositionDraft,
  createDraftSavePlan,
  draftItemToJournalLayout,
} from '../features/journal/journalDraftAdapters'
import {
  createJournalItemForIllustration,
  createJournalItemForMaterial,
  createJournalItemForNote,
  fetchJournalPageById,
  removeJournalItem,
  updateJournalItemStyle,
  updateJournalPage,
} from '../features/journal/journalService'
import { JournalCanvas } from '../components/features/journal/JournalCanvas'
import type { JournalPopoverAnchor } from '../components/features/journal/JournalCanvas'
import { JournalCreationFlow } from '../components/features/journal/JournalCreationFlow'
import { JournalStickerPopover } from '../components/features/journal/JournalStickerPopover'
import { useI18n } from '../i18n/useI18n'
import { fetchStampForTarget, persistStampForTarget } from '../features/stamps/stampService'
import { useStampSettingsStore } from '../stores/stampSettingsStore'

export function JournalEditorPage() {
  const { t } = useI18n()
  const { oshiId = '', pageId = '' } = useParams<{ oshiId: string; pageId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isDraftPage = !pageId
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [popoverItemId, setPopoverItemId] = useState<string | null>(null)
  const [popoverAnchor, setPopoverAnchor] = useState<JournalPopoverAnchor | null>(null)
  const [zoom, setZoom] = useState(1)
  const [compositionOpen, setCompositionOpen] = useState(false)
  const [compositionInitialStep, setCompositionInitialStep] = useState<'setup' | 'draft'>('draft')
  const [stampDraft, setStampDraft] = useState<Stamp | StampInput | null>(null)
  const [stampPlacementDraft, setStampPlacementDraft] = useState<StampInput | null>(null)
  const {
    pages,
    activePageId,
    items,
    loading,
    error,
    openPageForEditing,
    closeBook,
    updateItemLayout,
    updateItemStyle,
    removeItem,
    refreshItems,
  } = useJournalStore()
  const stampSoundEnabled = useStampSettingsStore((s) => s.soundEnabled)
  const toggleFavorite = useNoteStore((state) => state.toggleFavorite)
  const updateNote = useNoteStore((state) => state.updateNote)
  const backTo = '/journal'

  useEffect(() => {
    let cancelled = false
    async function openTargetPage() {
      if (!pageId) return
      const targetOshiId = oshiId || (await fetchJournalPageById(pageId))?.oshi_id || ''
      if (!targetOshiId || cancelled) return
      await openPageForEditing(pageId, targetOshiId)
    }

    if (pageId) {
      openTargetPage()
      return () => {
        cancelled = true
      }
    }
    closeBook()
    setSelectedItemId(null)
    setPopoverItemId(null)
    setPopoverAnchor(null)
    setStampDraft(null)
    setStampPlacementDraft(null)
    return () => {
      cancelled = true
    }
  }, [closeBook, openPageForEditing, oshiId, pageId])

  const activePage = useMemo(
    () => pages.find((page) => page.id === activePageId) || null,
    [activePageId, pages]
  )
  const activePageStampTargetId = activePage?.id || ''
  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) || null,
    [items, selectedItemId]
  )
  const canvasItems = isDraftPage ? [] : items

  useEffect(() => {
    if (!activePage) return
    setStampPlacementDraft(null)
  }, [activePage])

  useEffect(() => {
    if (!activePage) return
    if (searchParams.get('view') === '1' || compositionOpen) return
    const requestedStep = searchParams.get('setup') === '1' ? 'setup' : 'draft'
    setSelectedItemId(null)
    setPopoverItemId(null)
    setPopoverAnchor(null)
    setCompositionInitialStep(requestedStep)
    setCompositionOpen(true)
  }, [activePage, compositionOpen, searchParams])

  useEffect(() => {
    let alive = true
    if (!activePageStampTargetId) {
      setStampDraft(null)
      setStampPlacementDraft(null)
      return
    }
    fetchStampForTarget('journal_page', activePageStampTargetId)
      .then((stamp) => {
        if (alive) {
          setStampDraft(stamp)
          setStampPlacementDraft(null)
        }
      })
      .catch(() => {
        if (alive) {
          setStampDraft(null)
          setStampPlacementDraft(null)
        }
      })
    return () => { alive = false }
  }, [activePageStampTargetId])

  async function handleCommitLayout(itemId: string, layout: JournalLayoutInput) {
    const item = items.find((candidate) => candidate.id === itemId)
    await updateItemLayout(itemId, {
      ...layout,
      z_index: item?.z_index,
    })
  }

  function handleStampPlace(value: StampInput) {
    setStampDraft(value)
  }

  async function handleInspectorLayout(item: JournalItemWithNote, layout: JournalLayoutInput & { z_index?: number }) {
    await updateItemLayout(item.id, layout)
  }

  async function handleAutoArrange() {
    const noteItems = canvasItems.filter((item) => item.note)
    const layouts = autoArrangeNotes(noteItems.map((item) => item.note!))
    await Promise.all(canvasItems.map((item) => {
      if (!item.note) return Promise.resolve()
      const layout = layouts.get(item.note.id)
      if (!layout) return Promise.resolve()
      return updateItemLayout(item.id, {
        ...clampLayout(layout),
        z_index: item.z_index,
      })
    }))
  }

  async function handleOpenCompositionEditor(initialStep: 'setup' | 'draft' = 'draft') {
    const preparedPage = await ensurePageForAdding()
    if (!preparedPage) {
      return
    }
    setSelectedItemId(null)
    setPopoverItemId(null)
    setPopoverAnchor(null)
    setCompositionInitialStep(initialStep)
    setCompositionOpen(true)
  }

  async function handleSaveCompositionDraft(draft: {
    oshiId: string
    title: string
    dateLabel: string
    description: string
    background: string
    orientation: JournalPage['orientation']
    items: JournalDraftItem[]
    stamp: Stamp | StampInput | null
  }) {
    if (!activePage) return
    await updateJournalPage(activePage.id, {
      title: draft.title.trim() || t('journalEditor.defaultPageTitle'),
      description: draft.description.trim(),
      date_label: draft.dateLabel.trim(),
      background: draft.background,
      orientation: draft.orientation,
    })

    const savePlan = createDraftSavePlan(draft.items, canvasItems)
    await Promise.all(savePlan.existingItemsToRemove.map((item) => removeJournalItem(item.id)))

    for (const item of savePlan.itemsToUpdate) {
      const layout = draftItemToJournalLayout(item)
      if (item.originItemId) {
        await updateItemLayout(item.originItemId, layout)
        if (item.stylePayload !== undefined) {
          await updateItemStyle(item.originItemId, { style_payload: item.stylePayload })
        }
      }
    }

    for (const item of savePlan.itemsToCreate) {
      const layout = draftItemToJournalLayout(item)
      if (item.itemType === 'note' && item.sourceId) {
        const created = await createJournalItemForNote(activePage.id, item.sourceId, layout)
        if (item.stylePayload !== undefined) await updateJournalItemStyle(created.id, { style_payload: item.stylePayload })
      } else if (item.itemType === 'illustration' && item.sourceId) {
        const created = await createJournalItemForIllustration(activePage.id, item.sourceId, layout)
        if (item.stylePayload !== undefined) await updateJournalItemStyle(created.id, { style_payload: item.stylePayload })
      } else if (item.itemType === 'material' && item.materialId) {
        await createJournalItemForMaterial(activePage.id, item.materialId, layout, item.stylePayload)
      }
    }

    setStampDraft(await persistStampForTarget('journal_page', activePage.id, draft.stamp))
    await openPageForEditing(activePage.id, activePage.oshi_id)
    setCompositionOpen(false)
    navigate(`/journal/pages/${activePage.id}/edit?view=1`, { replace: true })
  }

  async function handleToggleFavorite(noteId: string) {
    await toggleFavorite(noteId)
    await refreshItems()
  }

  async function handleUpdateNote(noteId: string, input: Parameters<typeof updateNote>[1]) {
    await updateNote(noteId, input)
    await refreshItems()
  }

  async function handleRemove(itemId: string) {
    await removeItem(itemId)
    if (selectedItemId === itemId) setSelectedItemId(null)
    if (popoverItemId === itemId) setPopoverItemId(null)
    if (popoverItemId === itemId) setPopoverAnchor(null)
  }

  async function handleClearPage() {
    setSelectedItemId(null)
    if (canvasItems.length === 0) return
    if (!confirm(t('journalEditor.clearConfirm'))) return
    await Promise.all(canvasItems.map((item) => removeItem(item.id)))
  }

  async function ensurePageForAdding(): Promise<{ pageId: string; oshiId: string } | null> {
    const targetOshiId = activePage?.oshi_id || oshiId
    if (!activePage || !targetOshiId) return null
    return { pageId: activePage.id, oshiId: targetOshiId }
  }

  if (isDraftPage) {
    return <JournalCreationFlow />
  }

  if (compositionOpen && activePage) {
    return (
      <JournalCreationFlow
        mode="edit"
        initialStep={compositionInitialStep}
        initialDraft={createCompositionDraft(activePage, canvasItems, stampDraft)}
        onSaveDraft={handleSaveCompositionDraft}
        onCancelEdit={() => {
          setCompositionOpen(false)
          navigate(`/journal/pages/${activePage.id}/edit?view=1`, { replace: true })
        }}
      />
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg-primary">
      <header className={`${PAGE_HEADER_CLASS} gap-3`}>
        <Link
          to={backTo}
          className="rounded-lg p-2 text-text-muted transition-colors hover:bg-bg-secondary hover:text-text-primary"
          title={t('journalEditor.back')}
        >
          <ArrowLeft size={22} />
        </Link>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{t('journalEditor.eyebrow')}</p>
          <h1 className="truncate text-2xl font-bold text-text-primary">
            {isDraftPage ? t('journalEditor.newTitle') : activePage?.title || t('journalEditor.defaultPageTitle')}
          </h1>
        </div>

        {loading && <Loader2 size={18} className="animate-spin text-accent" />}
        {error && <span className="hidden max-w-64 truncate text-xs text-red-400 sm:inline">{error}</span>}

        <Button variant="secondary" size="sm" onClick={handleClearPage} disabled={!isDraftPage && canvasItems.length === 0}>
          <RotateCcw size={15} />
          {t('journalEditor.clear')}
        </Button>

        <Button variant="secondary" size="sm" onClick={handleAutoArrange} disabled={canvasItems.length === 0}>
          <LayoutGrid size={15} />
          {t('journalEditor.autoArrange')}
        </Button>

        <Button variant="primary" size="sm" onClick={() => handleOpenCompositionEditor('draft')}>
          <LayoutGrid size={15} />
          {t('journalCreate.editPage')}
        </Button>
      </header>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <main className="min-w-0 flex-1">
          <JournalCanvas
            page={activePage}
            items={canvasItems}
            selectedItemId={selectedItemId}
            loading={loading}
            zoom={zoom}
            zoomControlsRightOffset={72}
            stamp={stampDraft}
            stampPlacementDraft={stampPlacementDraft}
            stampSoundEnabled={stampSoundEnabled}
            onZoomChange={setZoom}
            onSelectItem={(item) => {
              setSelectedItemId(item?.id || null)
              if (!item) {
                setPopoverItemId(null)
                setPopoverAnchor(null)
              }
            }}
            onOpenItemPopover={(item, anchor) => {
              setSelectedItemId(item.id)
              setPopoverItemId(item.id)
              setPopoverAnchor(anchor)
            }}
            onCommitLayout={handleCommitLayout}
            onStampPlace={handleStampPlace}
            onStampPlacementComplete={() => setStampPlacementDraft(null)}
            onStampPlacementCancel={() => setStampPlacementDraft(null)}
          />
        </main>
        {selectedItem && popoverItemId === selectedItem.id && (
          <JournalStickerPopover
            oshiId={oshiId}
            selectedItem={selectedItem}
            anchor={popoverAnchor}
            items={canvasItems}
            onUpdateLayout={handleInspectorLayout}
            onUpdateStyle={updateItemStyle}
            onRemove={handleRemove}
            onToggleFavorite={handleToggleFavorite}
            onUpdateNote={handleUpdateNote}
            onClose={() => {
              setPopoverItemId(null)
              setPopoverAnchor(null)
            }}
          />
        )}
      </div>
    </div>
  )
}
