import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Loader2,
  Palette,
  RotateCcw,
  Save,
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { PAGE_HEADER_CLASS } from '../components/layout/pageShell'
import { useJournalStore } from '../stores/journalStore'
import { useNoteStore } from '../stores/noteStore'
import type { JournalDraftItem, JournalItemWithNote, JournalPage, Oshi, Stamp, StampInput } from '../types'
import { autoArrangeNotes, clampLayout, type JournalLayoutInput } from '../features/journal/journalLayout'
import {
  createJournalItemForIllustration,
  createJournalItemForMaterial,
  createJournalItemForNote,
  createStandalonePostcard,
  fetchJournalPageById,
  removeJournalItem,
  updateJournalItemStyle,
  updateJournalPage,
} from '../features/journal/journalService'
import { fetchAllOshis } from '../features/oshis/oshiService'
import { JournalCanvas } from '../components/features/journal/JournalCanvas'
import { JournalCreationFlow } from '../components/features/journal/JournalCreationFlow'
import { JournalInspector } from '../components/features/journal/JournalInspector'
import { useUiMotionSeconds } from '../components/features/themes/uiMotion'
import { SelectMenu } from '../components/ui/SelectMenu'
import { useI18n } from '../i18n/useI18n'
import { StampControl } from '../components/features/stamps/StampControl'
import { fetchStampForTarget, persistStampForTarget } from '../features/stamps/stampService'
import { useStampSettingsStore } from '../stores/stampSettingsStore'
import { JOURNAL_BACKGROUND_PRESETS } from '../features/journal/journalBackgrounds'

interface PageDraft {
  title: string
  description: string
  date_label: string
  background: string
}

export function JournalEditorPage() {
  const { t } = useI18n()
  const { oshiId = '', pageId = '' } = useParams<{ oshiId: string; pageId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const motionSeconds = useUiMotionSeconds()
  const isDraftPage = !pageId
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [compositionOpen, setCompositionOpen] = useState(false)
  const [compositionInitialStep, setCompositionInitialStep] = useState<'setup' | 'draft'>('draft')
  const [pageDraft, setPageDraft] = useState<PageDraft>(createDefaultPageDraft())
  const [stampDraft, setStampDraft] = useState<Stamp | StampInput | null>(null)
  const [stampPlacementDraft, setStampPlacementDraft] = useState<StampInput | null>(null)
  const [oshis, setOshis] = useState<Oshi[]>([])
  const [selectedOshiId, setSelectedOshiId] = useState(oshiId)
  const [savingPage, setSavingPage] = useState(false)
  const {
    pages,
    activePageId,
    items,
    loading,
    error,
    openPageForEditing,
    closeBook,
    updatePage,
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
    fetchAllOshis()
      .then((rows) => {
        setOshis(rows)
        if (!selectedOshiId && rows[0]) setSelectedOshiId(rows[0].id)
      })
      .catch(() => setOshis([]))
  }, [selectedOshiId])

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
    setPageDraft(createDefaultPageDraft())
    setStampDraft(null)
    setStampPlacementDraft(null)
    return () => {
      cancelled = true
    }
  }, [closeBook, openPageForEditing, oshiId, pageId])

  useEffect(() => {
    if (pageId) {
      return
    }
    setSelectedOshiId(oshiId)
  }, [oshiId, pageId])

  useEffect(() => {
    if (!detailsOpen) setStampPlacementDraft(null)
  }, [detailsOpen])

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
    setSelectedOshiId(activePage.oshi_id)
    setPageDraft({
      title: activePage.title || '',
      description: activePage.description || '',
      date_label: activePage.date_label || '',
      background: activePage.background || 'paper',
    })
  }, [activePage])

  useEffect(() => {
    if (!activePage || searchParams.get('setup') !== '1') return
    setDetailsOpen(false)
    setSelectedItemId(null)
    setCompositionInitialStep('setup')
    setCompositionOpen(true)
  }, [activePage, searchParams])

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
      setDetailsOpen(true)
      return
    }
    setDetailsOpen(false)
    setSelectedItemId(null)
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

    const draftOriginIds = new Set(draft.items.map((item) => item.originItemId).filter(Boolean))
    const supportedExistingItems = canvasItems.filter((item) => isCompositionItem(item))
    await Promise.all(supportedExistingItems
      .filter((item) => !draftOriginIds.has(item.id))
      .map((item) => removeJournalItem(item.id)))

    for (const item of draft.items) {
      const layout = draftItemToLayout(item)
      if (item.originItemId) {
        await updateItemLayout(item.originItemId, layout)
        if (item.stylePayload !== undefined) {
          await updateItemStyle(item.originItemId, { style_payload: item.stylePayload })
        }
        continue
      }
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
    if (searchParams.get('setup') === '1') {
      navigate(`/journal/pages/${activePage.id}/edit`, { replace: true })
    }
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
  }

  async function handleSavePage() {
    const title = pageDraft.title.trim() || t('journalEditor.defaultPageTitle')
    const input = {
      title,
      description: pageDraft.description.trim(),
      date_label: pageDraft.date_label.trim(),
      background: pageDraft.background,
    }

    setSavingPage(true)
    try {
      if (!activePage) {
        if (!selectedOshiId) return
        const page = await createStandalonePostcard(selectedOshiId, title)
        await updateJournalPage(page.id, input)
        setStampDraft(await persistStampForTarget('journal_page', page.id, stampDraft))
        navigate(`/journal/pages/${page.id}/edit`, { replace: true })
        return
      }
      await updatePage(activePage.id, {
        title: input.title || t('journalEditor.defaultPageTitle'),
        description: input.description,
        date_label: input.date_label,
        background: input.background,
      })
      setStampDraft(await persistStampForTarget('journal_page', activePage.id, stampDraft))
    } finally {
      setSavingPage(false)
    }
  }

  async function handleClearPage() {
    setSelectedItemId(null)
    if (isDraftPage) {
      setPageDraft(createDefaultPageDraft())
      return
    }
    if (canvasItems.length === 0) return
    if (!confirm(t('journalEditor.clearConfirm'))) return
    await Promise.all(canvasItems.map((item) => removeItem(item.id)))
  }

  async function ensurePageForAdding(): Promise<{ pageId: string; oshiId: string } | null> {
    const targetOshiId = activePage?.oshi_id || selectedOshiId || oshiId
    if (!targetOshiId) return null
    if (activePage) return { pageId: activePage.id, oshiId: targetOshiId }

    const title = pageDraft.title.trim() || t('journalEditor.defaultPageTitle')
    const input = {
      title,
      description: pageDraft.description.trim(),
      date_label: pageDraft.date_label.trim(),
      background: pageDraft.background,
    }

    setSavingPage(true)
    try {
      const page = await createStandalonePostcard(targetOshiId, title)
      await updateJournalPage(page.id, input)
      await openPageForEditing(page.id, targetOshiId)
      navigate(`/journal/pages/${page.id}/edit`, { replace: true })
      return { pageId: page.id, oshiId: targetOshiId }
    } finally {
      setSavingPage(false)
    }
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
          if (searchParams.get('setup') === '1') {
            navigate(`/journal/pages/${activePage.id}/edit`, { replace: true })
          }
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

        <button
          type="button"
          onClick={() => setDetailsOpen((open) => !open)}
          className="rounded-xl p-2.5 text-text-muted transition-colors hover:bg-bg-secondary hover:text-accent"
          title={detailsOpen ? t('journalEditor.hideDetails') : t('journalEditor.showDetails')}
        >
          {detailsOpen ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
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
              if (item) setDetailsOpen(true)
            }}
            onCommitLayout={handleCommitLayout}
            onStampPlace={handleStampPlace}
            onStampPlacementComplete={() => setStampPlacementDraft(null)}
            onStampPlacementCancel={() => setStampPlacementDraft(null)}
          />
        </main>

        <aside
          className="relative min-h-0 shrink-0 border-l border-border-color bg-bg-secondary/20 transition-[width] ease-out"
          style={{
            width: detailsOpen ? 380 : 0,
            transitionDuration: `${motionSeconds}s`,
          }}
        >
          <button
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
            className="absolute left-0 top-7 z-[80] flex h-11 w-8 -translate-x-full items-center justify-center rounded-l-2xl border border-r-0 border-border-color bg-bg-primary text-text-muted shadow-sm transition-colors hover:text-accent"
            title={detailsOpen ? t('journalEditor.hideDetails') : t('journalEditor.showDetails')}
            aria-label={detailsOpen ? t('journalEditor.hideDetails') : t('journalEditor.showDetails')}
          >
            {detailsOpen ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>

          <div className="h-full w-[380px] overflow-y-auto p-5">
            <div className="space-y-4">
              <PageSetupPanel
                draft={pageDraft}
                oshis={oshis}
                selectedOshiId={selectedOshiId}
                onOshiChange={setSelectedOshiId}
                onChange={setPageDraft}
                onSave={handleSavePage}
                disabled={savingPage || (!activePage && !selectedOshiId)}
                saving={savingPage}
                oshiLocked={!isDraftPage}
                stampDraft={stampDraft}
                onStampClear={() => {
                  setStampDraft(null)
                  setStampPlacementDraft(null)
                }}
                stampPlacing={Boolean(stampPlacementDraft)}
                onStartStampPlacement={setStampPlacementDraft}
                onCancelStampPlacement={() => setStampPlacementDraft(null)}
              />
              <section className="overflow-hidden rounded-2xl border border-border-color bg-bg-primary/75 shadow-sm shadow-black/5">
                <JournalInspector
                  oshiId={oshiId}
                  selectedItem={selectedItem}
                  items={canvasItems}
                  orientation={activePage?.orientation || 'portrait'}
                  onUpdateLayout={handleInspectorLayout}
                  onUpdateStyle={updateItemStyle}
                  onRemove={handleRemove}
                  onToggleFavorite={handleToggleFavorite}
                  onUpdateNote={handleUpdateNote}
                />
              </section>
            </div>
          </div>
        </aside>

      </div>
    </div>
  )
}

function createCompositionDraft(page: JournalPage, items: JournalItemWithNote[], stamp: Stamp | StampInput | null) {
  return {
    oshiId: page.oshi_id,
    title: page.title || '',
    dateLabel: page.date_label || '',
    description: page.description || '',
    background: page.background || 'paper',
    orientation: page.orientation || 'portrait',
    items: items.flatMap(itemToDraftItem),
    stamp,
  }
}

function itemToDraftItem(item: JournalItemWithNote): JournalDraftItem[] {
  if (!isCompositionItem(item)) return []
  const base = {
    draftId: `existing-${item.id}`,
    originItemId: item.id,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    rotation: item.rotation,
    zIndex: item.z_index,
  }
  if (item.item_type === 'note') {
    if (!item.note_id) return []
    return [{
      ...base,
      itemType: 'note',
      sourceId: item.note_id,
      stylePayload: item.style_payload && item.style_payload !== '{}' ? item.style_payload : JSON.stringify({
        noteCard: {
          titleVisible: true,
          titleText: item.note?.title || '',
          bodyText: (item.note?.plain_text || '').slice(0, 200),
          fontFamily: 'system',
          fontSize: 14,
          fontWeight: 500,
          lineHeight: 1.45,
          textColor: '#1f2f4d',
          backgroundColor: item.color || '#fff7d6',
          padding: 16,
          radius: 16,
          showTags: true,
        },
      }),
    }]
  }
  if (item.item_type === 'illustration') {
    if (!item.illustration_id) return []
    return [{
      ...base,
      itemType: 'illustration',
      sourceId: item.illustration_id,
      stylePayload: item.style_payload && item.style_payload !== '{}' ? item.style_payload : JSON.stringify({
        imageStyle: {
          fit: 'contain',
          frame: 'none',
          borderWidth: 0,
          borderColor: '#ffffff',
          radius: 12,
          shadow: 0,
          backgroundColor: 'transparent',
        },
      }),
    }]
  }
  return [{
    ...base,
    itemType: 'material',
    materialId: item.material_id || 'washi-lilac',
    materialSnapshot: item.material_snapshot,
    stylePayload: item.style_payload && item.style_payload !== '{}' ? item.style_payload : JSON.stringify({
      color: item.color || undefined,
      variant: item.sticker_style,
      glassStrength: 0,
    }),
  }]
}

function isCompositionItem(item: JournalItemWithNote) {
  return item.item_type === 'note' || item.item_type === 'illustration' || item.item_type === 'material' || item.item_type === 'tape'
}

function draftItemToLayout(item: JournalDraftItem) {
  return {
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    rotation: item.rotation,
    z_index: item.zIndex,
  }
}

function PageSetupPanel({
  draft,
  oshis,
  selectedOshiId,
  onOshiChange,
  onChange,
  onSave,
  disabled,
  saving,
  oshiLocked,
  stampDraft,
  onStampClear,
  stampPlacing,
  onStartStampPlacement,
  onCancelStampPlacement,
}: {
  draft: PageDraft
  oshis: Oshi[]
  selectedOshiId: string
  onOshiChange: (oshiId: string) => void
  onChange: (draft: PageDraft) => void
  onSave: () => void
  disabled: boolean
  saving: boolean
  oshiLocked: boolean
  stampDraft: Stamp | StampInput | null
  onStampClear: () => void
  stampPlacing: boolean
  onStartStampPlacement: (stamp: StampInput) => void
  onCancelStampPlacement: () => void
}) {
  const { t } = useI18n()
  return (
    <section className="rounded-2xl border border-border-color bg-bg-primary/75 p-4 shadow-sm shadow-black/5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-text-muted">{t('journalEditor.setup.kicker')}</p>
          <h2 className="text-sm font-semibold text-text-primary">{t('journalEditor.setup.title')}</h2>
        </div>
        <Button size="sm" onClick={onSave} disabled={disabled}>
          <Save size={15} />
          {saving ? t('journalEditor.setup.saving') : t('journalEditor.setup.save')}
        </Button>
      </div>

      <div className="space-y-3">
        <label className="grid gap-1.5 text-xs font-medium text-text-muted">
          {t('journalEditor.setup.oshi')}
          <SelectMenu
            value={selectedOshiId}
            onChange={onOshiChange}
            disabled={oshiLocked}
            options={oshis.map((oshi) => ({ value: oshi.id, label: oshi.name }))}
            placeholder={t('journalEditor.setup.chooseOshi')}
            ariaLabel={t('journalEditor.setup.chooseOshi')}
            className="w-full"
            buttonClassName="w-full rounded-xl text-text-primary"
            menuClassName="w-full"
          />
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-text-muted">
          {t('journalEditor.setup.pageTitle')}
          <input
            value={draft.title}
            onChange={(event) => onChange({ ...draft, title: event.target.value })}
            className={fieldClassName}
            placeholder={t('journalEditor.setup.pageTitlePlaceholder')}
          />
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-text-muted">
          {t('journalEditor.setup.dateLabel')}
          <input
            value={draft.date_label}
            onChange={(event) => onChange({ ...draft, date_label: event.target.value })}
            className={fieldClassName}
            placeholder={t('journalEditor.setup.dateLabelPlaceholder')}
          />
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-text-muted">
          {t('journalEditor.setup.description')}
          <textarea
            value={draft.description}
            onChange={(event) => onChange({ ...draft, description: event.target.value })}
            className={`${fieldClassName} min-h-24 resize-none`}
            placeholder={t('journalEditor.setup.descriptionPlaceholder')}
          />
        </label>
        <section>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-text-muted">
            <Palette size={14} />
            {t('journalEditor.setup.background')}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {JOURNAL_BACKGROUND_PRESETS.map((background) => (
              <button
                key={background.id}
                type="button"
                onClick={() => onChange({ ...draft, background: background.id })}
                className={`rounded-xl border px-2 py-2 text-xs transition-colors ${
                  draft.background === background.id
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-border-color bg-bg-secondary text-text-secondary hover:border-border-hover'
                }`}
              >
                {t(background.labelKey)}
              </button>
            ))}
          </div>
        </section>
        <StampControl
          value={stampDraft}
          onClear={onStampClear}
          onStartPlacement={onStartStampPlacement}
          onCancelPlacement={onCancelStampPlacement}
          placing={stampPlacing}
        />
      </div>
    </section>
  )
}

const fieldClassName = 'min-w-0 rounded-xl border border-border-color bg-bg-secondary px-3 py-2 text-sm text-text-secondary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-soft disabled:opacity-50'

function createDefaultPageDraft(): PageDraft {
  return { title: '', description: '', date_label: '', background: 'paper' }
}
