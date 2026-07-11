import { ArrowLeft, ImageIcon, Loader2, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../../ui/Button'
import { Modal } from '../../ui/Modal'
import { PAGE_HEADER_CLASS } from '../../layout/pageShell'
import { useUiMotionSeconds } from '../../features/themes/uiMotion'
import { useI18n } from '../../../i18n/useI18n'
import type { Illustration, JournalDraftItem, JournalPageOrientation, Note, Oshi, Stamp, StampInput } from '../../../types'
import { fetchAllOshis } from '../../../features/oshis/oshiService'
import { fetchNotesByOshi } from '../../../features/notes/noteService'
import { fetchIllustrations } from '../../../features/illustrations/illustrationService'
import { createJournalPageFromDraft } from '../../../features/journal/journalService'
import { getJournalPageSize } from '../../../features/journal/journalLayout'
import { getJournalMaterialDefinition, getMaterialSnapshot } from '../../../features/journal/journalMaterials'
import { createImageStylePayload, createNoteCardStylePayload } from '../../../features/journal/journalItemStyles'
import { getDefaultIllustrationItemSize } from '../../../features/journal/journalItemSizing'
import {
  applyJournalPageTemplate,
  getAvailableTemplateSlot,
  getJournalPageTemplateDefinition,
  placeDraftItemInTemplateSlot,
} from '../../../features/journal/journalPageTemplates'
import { JournalMaterialTile } from './JournalMaterialTile'
import { JournalDraftCanvas, type DragPayload } from './JournalDraftCanvas'
import { JournalSetupStep } from './JournalSetupStep'
import { JournalStepRail } from './JournalStepRail'
import { JournalEdgeDrawer } from './JournalEdgeDrawer'
import {
  JournalImagesDrawer,
  JournalMaterialsDrawer,
  JournalNotesDrawer,
  JournalReviewDrawer,
  JournalStampDrawer,
} from './JournalResourceDrawers'
import type {
  JournalCreationFlowDraft,
  JournalCreationStepId,
  JournalDrawerDock,
  JournalImageFilter,
  JournalMaterialFilter,
  JournalNoteFilter,
} from './journalCreationTypes'
import { readLocalStorage, writeLocalStorage } from '../../../utils/safeLocalStorage'

type DragGhost = { payload: DragPayload; x: number; y: number } | null

const STEPS: { id: JournalCreationStepId; labelKey: string }[] = [
  { id: 'setup', labelKey: 'journalCreate.step.setup' },
  { id: 'notes', labelKey: 'journalCreate.step.notes' },
  { id: 'images', labelKey: 'journalCreate.step.images' },
  { id: 'materials', labelKey: 'journalCreate.step.decorations' },
  { id: 'stamp', labelKey: 'journalCreate.step.stamp' },
  { id: 'review', labelKey: 'journalCreate.step.review' },
]

const DRAWER_DOCK_STORAGE_KEY = 'oshinote.journalCreate.drawerDock'

interface JournalCreationFlowProps {
  mode?: 'create' | 'edit'
  initialStep?: 'setup' | 'draft'
  initialDraft?: JournalCreationFlowDraft
  onSaveDraft?: (draft: JournalCreationFlowDraft) => Promise<void>
  onCancelEdit?: () => void
}

export function JournalCreationFlow({ mode = 'create', initialStep = 'draft', initialDraft, onSaveDraft, onCancelEdit }: JournalCreationFlowProps = {}) {
  const { t } = useI18n()
  const motionSeconds = useUiMotionSeconds()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editMode = mode === 'edit'
  const targetBookId = editMode ? null : searchParams.get('bookId')
  const queryOshiId = editMode ? '' : searchParams.get('oshiId') || ''
  const queryTemplate = editMode ? null : getJournalPageTemplateDefinition(searchParams.get('templateId'))
  const drawerHoverCloseTimerRef = useRef<number | null>(null)
  const [stepIndex, setStepIndex] = useState(editMode && initialStep !== 'setup' ? 1 : 0)
  const step = STEPS[stepIndex]
  const [oshis, setOshis] = useState<Oshi[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [illustrations, setIllustrations] = useState<Illustration[]>([])
  const [selectedOshiId, setSelectedOshiId] = useState(initialDraft?.oshiId || queryOshiId)
  const [title, setTitle] = useState(initialDraft?.title || '')
  const [dateLabel, setDateLabel] = useState(initialDraft?.dateLabel || String(new Date().getFullYear()))
  const [description, setDescription] = useState(initialDraft?.description || '')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(queryTemplate?.id || null)
  const [background, setBackground] = useState(initialDraft?.background || queryTemplate?.background || 'sakura')
  const [orientation, setOrientation] = useState<JournalPageOrientation>(initialDraft?.orientation || queryTemplate?.preferredOrientation || 'portrait')
  const [items, setItems] = useState<JournalDraftItem[]>(() => {
    const initialItems = initialDraft?.items || []
    return queryTemplate ? applyJournalPageTemplate(queryTemplate.id, initialItems).items : initialItems
  })
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [stampDraft, setStampDraft] = useState<StampInput | null>(() => initialDraft?.stamp ? stampToInput(initialDraft.stamp) : null)
  const [stampPlacementDraft, setStampPlacementDraft] = useState<StampInput | null>(null)
  const [zoom, setZoom] = useState(0.72)
  const [drawerDock, setDrawerDock] = useState<JournalDrawerDock>(() => readStoredDrawerDock())
  const [drawerPinned, setDrawerPinned] = useState(false)
  const [drawerHovered, setDrawerHovered] = useState(false)
  const [narrowViewport, setNarrowViewport] = useState(false)
  const [noteQuery, setNoteQuery] = useState('')
  const [noteFilter, setNoteFilter] = useState<JournalNoteFilter>('all')
  const [notePage, setNotePage] = useState(1)
  const [imageQuery, setImageQuery] = useState('')
  const [imageFilter, setImageFilter] = useState<JournalImageFilter>('all')
  const [imagePage, setImagePage] = useState(1)
  const [materialKind, setMaterialKind] = useState<JournalMaterialFilter>('all')
  const [materialPage, setMaterialPage] = useState(1)
  const [loadingResources, setLoadingResources] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [confirmBackOpen, setConfirmBackOpen] = useState(false)
  const [draftBackSaved, setDraftBackSaved] = useState(false)
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null | undefined>(undefined)
  const [dragGhost, setDragGhost] = useState<DragGhost>(null)

  useEffect(() => {
    let alive = true
    fetchAllOshis()
      .then((rows) => {
        if (!alive) return
        setOshis(rows)
        if (!selectedOshiId && rows[0]) setSelectedOshiId(rows[0].id)
      })
      .catch(() => { if (alive) setOshis([]) })
    return () => { alive = false }
  }, [selectedOshiId])

  useEffect(() => {
    let alive = true
    if (!selectedOshiId) {
      setNotes([])
      setIllustrations([])
      if (!editMode) {
        setItems((current) => current.filter((item) => item.itemType === 'material'))
        setSelectedItemId(null)
      }
      return
    }
    setLoadingResources(true)
    Promise.all([
      fetchNotesByOshi(selectedOshiId, { page: 1, pageSize: 200, archiveFilter: 'all' }),
      fetchIllustrations({ oshiId: selectedOshiId, includeArchived: false, sort: 'newest' }),
    ])
      .then(([noteResult, illustrationRows]) => {
        if (!alive) return
        setNotes(noteResult.notes)
        setIllustrations(illustrationRows)
        if (editMode) return
        setItems((current) => current.filter((item) => {
          if (item.itemType === 'note') return noteResult.notes.some((note) => note.id === item.sourceId)
          if (item.itemType === 'illustration') return illustrationRows.some((illustration) => illustration.id === item.sourceId)
          return true
        }))
      })
      .catch(() => {
        if (alive) {
          setNotes([])
          setIllustrations([])
        }
      })
      .finally(() => { if (alive) setLoadingResources(false) })
    return () => { alive = false }
  }, [editMode, selectedOshiId])

  useEffect(() => { setNotePage(1) }, [noteQuery, noteFilter])
  useEffect(() => { setImagePage(1) }, [imageQuery, imageFilter])
  useEffect(() => { setMaterialPage(1) }, [materialKind])
  useEffect(() => { setDraftBackSaved(false) }, [items, stampDraft])
  useEffect(() => { writeLocalStorage(DRAWER_DOCK_STORAGE_KEY, drawerDock) }, [drawerDock])
  useEffect(() => {
    function syncViewport() { setNarrowViewport(window.innerWidth < 768) }
    syncViewport()
    window.addEventListener('resize', syncViewport)
    return () => window.removeEventListener('resize', syncViewport)
  }, [])
  useEffect(() => () => {
    if (drawerHoverCloseTimerRef.current !== null) window.clearTimeout(drawerHoverCloseTimerRef.current)
  }, [])

  const notesById = useMemo(() => new Map(notes.map((note) => [note.id, note])), [notes])
  const illustrationsById = useMemo(() => new Map(illustrations.map((illustration) => [illustration.id, illustration])), [illustrations])
  const placedNoteIds = useMemo(() => new Set(items.filter((item) => item.itemType === 'note').map((item) => item.sourceId || '')), [items])
  const placedIllustrationIds = useMemo(() => new Set(items.filter((item) => item.itemType === 'illustration').map((item) => item.sourceId || '')), [items])
  const canSubmit = Boolean(selectedOshiId) && !creating
  const drawerOpen = drawerPinned || drawerHovered
  const effectiveDrawerDock: JournalDrawerDock = narrowViewport ? 'bottom' : drawerDock

  function setDrawerHoverOpen(value: boolean) {
    if (drawerHoverCloseTimerRef.current !== null) {
      window.clearTimeout(drawerHoverCloseTimerRef.current)
      drawerHoverCloseTimerRef.current = null
    }
    if (value) {
      setDrawerHovered(true)
      return
    }
    drawerHoverCloseTimerRef.current = window.setTimeout(() => {
      setDrawerHovered(false)
      drawerHoverCloseTimerRef.current = null
    }, 220)
  }

  function handleBackStep() {
    if (!draftBackSaved && (items.length > 0 || stampDraft)) {
      setConfirmBackOpen(true)
      return
    }
    setStepIndex(0)
  }

  function requestTemplateChange(templateId: string | null) {
    if (templateId === selectedTemplateId) return
    const hasUserContent = items.some((item) => !item.templateGenerated) || Boolean(stampDraft)
    if (hasUserContent) {
      setPendingTemplateId(templateId)
      return
    }
    applyTemplate(templateId)
  }

  function applyTemplate(templateId: string | null) {
    const application = applyJournalPageTemplate(templateId, items)
    setSelectedTemplateId(application.templateId)
    if (application.background) setBackground(application.background)
    if (application.orientation) setOrientation(application.orientation)
    setItems(application.items)
    setSelectedItemId(null)
  }

  function handleOrientationChange(nextOrientation: JournalPageOrientation) {
    if (nextOrientation === orientation) return
    if (selectedTemplateId) {
      const application = applyJournalPageTemplate(selectedTemplateId, items, createDraftId, nextOrientation)
      setItems(application.items)
    }
    setOrientation(nextOrientation)
    setSelectedItemId(null)
  }

  function startPointerResourceDrag(payload: DragPayload, event: PointerEvent<HTMLElement>) {
    if (event.button !== 0) return
    event.preventDefault()
    const startX = event.clientX
    const startY = event.clientY
    setDragGhost({ payload, x: event.clientX, y: event.clientY })

    function handlePointerMove(nextEvent: globalThis.PointerEvent) {
      setDragGhost({ payload, x: nextEvent.clientX, y: nextEvent.clientY })
    }

    function handlePointerUp(nextEvent: globalThis.PointerEvent) {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      setDragGhost(null)
      const distance = Math.abs(nextEvent.clientX - startX) + Math.abs(nextEvent.clientY - startY)
      if (distance < 8) {
        addDraftItem(payload)
        return
      }
      const pageElement = document.querySelector<HTMLElement>('[data-journal-draft-page="true"]')
      if (!pageElement) return
      const rect = pageElement.getBoundingClientRect()
      const x = Math.min(Math.max(nextEvent.clientX, rect.left), rect.right)
      const y = Math.min(Math.max(nextEvent.clientY, rect.top), rect.bottom)
      addDraftItem(payload, { x: (x - rect.left) / zoom, y: (y - rect.top) / zoom })
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp, { once: true })
  }

  function updateItem(itemId: string, change: Partial<Pick<JournalDraftItem, 'x' | 'y' | 'width' | 'height' | 'rotation' | 'zIndex' | 'stylePayload'>>) {
    setItems((current) => current.map((item) => item.draftId === itemId ? { ...item, ...change } : item))
  }

  function removeItem(itemId: string) {
    setItems((current) => current.filter((item) => item.draftId !== itemId))
    setSelectedItemId((current) => current === itemId ? null : current)
  }

  function bringForward(itemId: string) {
    setItems((current) => {
      const nextZ = Math.max(0, ...current.map((item) => item.zIndex)) + 1
      return current.map((item) => item.draftId === itemId ? { ...item, zIndex: nextZ } : item)
    })
  }

  function addDraftItem(payload: DragPayload, point?: { x: number; y: number }) {
    if ((payload.kind === 'note' && placedNoteIds.has(payload.id)) || (payload.kind === 'illustration' && placedIllustrationIds.has(payload.id))) return
    const base = getDraftItemBase(payload)
    if (!base) return
    const pageSize = getJournalPageSize(orientation)
    const x = point ? point.x - base.width / 2 : pageSize.width / 2 - base.width / 2
    const y = point ? point.y - base.height / 2 : pageSize.height / 2 - base.height / 2
    let draftItem: JournalDraftItem = {
      ...base,
      draftId: createDraftId(),
      x: Math.max(24, Math.min(x, pageSize.width - base.width - 24)),
      y: Math.max(24, Math.min(y, pageSize.height - base.height - 24)),
      zIndex: Math.max(0, ...items.map((item) => item.zIndex)) + 1,
    }
    if (payload.kind === 'note' || payload.kind === 'illustration') {
      const templateSlot = getAvailableTemplateSlot(selectedTemplateId, items, payload.kind, orientation, point)
      if (templateSlot && selectedTemplateId) {
        draftItem = placeDraftItemInTemplateSlot(draftItem, selectedTemplateId, templateSlot)
      }
    }
    setItems((current) => [...current, draftItem])
    setSelectedItemId(draftItem.draftId)
  }

  function getDraftItemBase(payload: DragPayload): Omit<JournalDraftItem, 'draftId' | 'x' | 'y' | 'zIndex'> | null {
    if (payload.kind === 'note') {
      const note = notesById.get(payload.id)
      return {
        itemType: 'note',
        sourceId: payload.id,
        stylePayload: createNoteCardStylePayload(note, { backgroundColor: '#fff7d6' }),
        width: 260,
        height: 178,
        rotation: -2,
      }
    }
    if (payload.kind === 'illustration') {
      const imageSize = getDefaultIllustrationItemSize(illustrationsById.get(payload.id))
      return {
        itemType: 'illustration',
        sourceId: payload.id,
        stylePayload: createImageStylePayload(),
        width: imageSize.width,
        height: imageSize.height,
        rotation: 2,
      }
    }
    const material = getJournalMaterialDefinition(payload.id)
    if (!material) return null
    return {
      itemType: 'material',
      materialId: material.id,
      materialSnapshot: getMaterialSnapshot(material),
      stylePayload: JSON.stringify(material.defaultStyle),
      width: material.defaultWidth,
      height: material.defaultHeight,
      rotation: material.defaultRotation,
    }
  }

  async function handleSubmit() {
    if (!selectedOshiId) return
    setCreating(true)
    setError('')
    try {
      const draft = {
        oshiId: selectedOshiId,
        title: title.trim() || t('journalEditor.defaultPageTitle'),
        description,
        dateLabel,
        background,
        orientation,
        items,
        stamp: stampDraft,
      }
      if (editMode) {
        await onSaveDraft?.(draft)
        return
      }
      const page = await createJournalPageFromDraft({ ...draft, bookId: targetBookId, stamp: stampDraft })
      navigate(`/journal/pages/${page.id}/edit`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg-primary">
      <header className={`${PAGE_HEADER_CLASS} gap-3`}>
        {editMode ? (
          <button type="button" onClick={onCancelEdit} className="rounded-lg p-2 text-text-muted transition-colors hover:bg-bg-secondary hover:text-text-primary" title={t('journalEditor.back')}><ArrowLeft size={22} /></button>
        ) : (
          <Link to="/journal" className="rounded-lg p-2 text-text-muted transition-colors hover:bg-bg-secondary hover:text-text-primary" title={t('journalEditor.back')}><ArrowLeft size={22} /></Link>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{t('nav.journalCreate')}</p>
          <h1 className="truncate text-2xl font-bold text-text-primary">{editMode ? t('journalCreate.editTitle') : t('journalCreate.title')}</h1>
        </div>
        {error && <span className="hidden max-w-72 truncate text-xs text-red-400 md:inline">{error}</span>}
        <Button variant="primary" size="sm" onClick={handleSubmit} disabled={!canSubmit}>
          {creating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {creating ? (editMode ? t('journalEditor.setup.saving') : t('journalCreate.creating')) : (editMode ? t('journalEditor.setup.save') : t('journalCreate.create'))}
        </Button>
      </header>

      <AnimatePresence mode="wait">
        {step.id === 'setup' ? (
          <motion.div key="setup" className="min-h-0 flex-1" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: motionSeconds, ease: 'easeOut' }}>
            <JournalSetupStep
              oshis={oshis}
              selectedOshiId={selectedOshiId}
              onOshiChange={setSelectedOshiId}
              title={title}
              onTitleChange={setTitle}
              dateLabel={dateLabel}
              onDateLabelChange={setDateLabel}
              description={description}
              onDescriptionChange={setDescription}
              background={background}
              onBackgroundChange={setBackground}
              orientation={orientation}
              onOrientationChange={handleOrientationChange}
              templateId={selectedTemplateId}
              editMode={editMode}
              onTemplateChange={requestTemplateChange}
              onNext={() => setStepIndex(1)}
            />
          </motion.div>
        ) : (
          <motion.div key="draft" className="relative flex min-h-0 flex-1 overflow-hidden" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: motionSeconds, ease: 'easeOut' }}>
            <JournalStepRail stepId={step.id} onStepChange={(nextStep) => setStepIndex(STEPS.findIndex((item) => item.id === nextStep))} onHoverChange={setDrawerHoverOpen} />
            <JournalEdgeDrawer
              open={drawerOpen}
              pinned={drawerPinned}
              dock={effectiveDrawerDock}
              motionSeconds={motionSeconds}
              onPinnedChange={setDrawerPinned}
              onDockChange={setDrawerDock}
              onHoverChange={setDrawerHoverOpen}
              label={t(step.labelKey as never)}
            >
              <AnimatePresence mode="wait">
                <motion.div key={step.id} initial={{ opacity: 0, x: effectiveDrawerDock === 'right' ? 10 : -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: effectiveDrawerDock === 'right' ? -10 : 10 }} transition={{ duration: motionSeconds, ease: 'easeOut' }}>
                  {step.id === 'notes' && <JournalNotesDrawer notes={notes} loading={loadingResources} query={noteQuery} filter={noteFilter} page={notePage} placedIds={placedNoteIds} onQueryChange={setNoteQuery} onFilterChange={setNoteFilter} onPageChange={setNotePage} onPointerPlace={startPointerResourceDrag} />}
                  {step.id === 'images' && <JournalImagesDrawer illustrations={illustrations} loading={loadingResources} query={imageQuery} filter={imageFilter} page={imagePage} placedIds={placedIllustrationIds} onQueryChange={setImageQuery} onFilterChange={setImageFilter} onPageChange={setImagePage} onPointerPlace={startPointerResourceDrag} />}
                  {step.id === 'materials' && <JournalMaterialsDrawer kind={materialKind} page={materialPage} onKindChange={setMaterialKind} onPageChange={setMaterialPage} onPointerPlace={startPointerResourceDrag} />}
                  {step.id === 'stamp' && <JournalStampDrawer value={stampDraft} placing={Boolean(stampPlacementDraft)} onClear={() => { setStampDraft(null); setStampPlacementDraft(null) }} onStartPlacement={setStampPlacementDraft} onCancelPlacement={() => setStampPlacementDraft(null)} />}
                  {step.id === 'review' && <JournalReviewDrawer title={title} dateLabel={dateLabel} description={description} background={background} orientation={orientation} templateId={selectedTemplateId} itemCount={items.length} stamp={stampDraft} creating={creating} canCreate={canSubmit} onCreate={handleSubmit} submitLabel={editMode ? t('journalEditor.setup.save') : t('journalCreate.create')} submittingLabel={editMode ? t('journalEditor.setup.saving') : t('journalCreate.creating')} />}
                </motion.div>
              </AnimatePresence>
            </JournalEdgeDrawer>

            <JournalDraftCanvas
              background={background}
              orientation={orientation}
              templateId={selectedTemplateId}
              items={items}
              notesById={notesById}
              illustrationsById={illustrationsById}
              selectedItemId={selectedItemId}
              zoom={zoom}
              stamp={stampDraft}
              stampPlacementDraft={stampPlacementDraft}
              stampSoundEnabled
              onZoomChange={setZoom}
              onSelectItem={setSelectedItemId}
              onUpdateItem={updateItem}
              onRemoveItem={removeItem}
              onBringForward={bringForward}
              onDropResource={addDraftItem}
              onStampPlace={setStampDraft}
              onStampPlacementComplete={() => setStampPlacementDraft(null)}
              onStampPlacementCancel={() => setStampPlacementDraft(null)}
            />

            <div className="absolute bottom-5 right-6 z-[75] flex gap-2">
              <Button variant="secondary" size="sm" onClick={handleBackStep}>{t('journalCreate.back')}</Button>
              <Button variant="primary" size="sm" onClick={handleSubmit} disabled={!canSubmit}>{creating ? (editMode ? t('journalEditor.setup.saving') : t('journalCreate.creating')) : (editMode ? t('journalEditor.setup.save') : t('journalCreate.create'))}</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal open={confirmBackOpen} onClose={() => setConfirmBackOpen(false)} title={t('journalCreate.backConfirm.title')}>
        <div className="grid gap-4">
          <p className="text-sm leading-relaxed text-text-secondary">{t('journalCreate.backConfirm.body')}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmBackOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" size="sm" onClick={() => { setDraftBackSaved(true); setConfirmBackOpen(false); setStepIndex(0) }}>{t('journalCreate.backConfirm.save')}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={pendingTemplateId !== undefined} onClose={() => setPendingTemplateId(undefined)} title={t('journalTemplates.switchConfirm.title')}>
        <div className="grid gap-4">
          <p className="text-sm leading-relaxed text-text-secondary">{t('journalTemplates.switchConfirm.body')}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setPendingTemplateId(undefined)}>{t('common.cancel')}</Button>
            <Button variant="primary" size="sm" onClick={() => { applyTemplate(pendingTemplateId ?? null); setPendingTemplateId(undefined) }}>{t('journalTemplates.switchConfirm.apply')}</Button>
          </div>
        </div>
      </Modal>
      <DragGhostPreview ghost={dragGhost} notesById={notesById} illustrationsById={illustrationsById} />
    </div>
  )
}

function DragGhostPreview({ ghost, notesById, illustrationsById }: { ghost: DragGhost; notesById: Map<string, Note>; illustrationsById: Map<string, Illustration> }) {
  const { t } = useI18n()
  if (!ghost) return null
  const style = { left: ghost.x, top: ghost.y }
  if (ghost.payload.kind === 'material') {
    const material = getJournalMaterialDefinition(ghost.payload.id)
    if (!material) return null
    return createPortal(<div className="pointer-events-none fixed z-[120] h-20 w-24 -translate-x-1/2 -translate-y-1/2 rotate-[-4deg] opacity-90 drop-shadow-xl" style={style}><JournalMaterialTile fill material={material} /></div>, document.body)
  }
  if (ghost.payload.kind === 'illustration') {
    const illustration = illustrationsById.get(ghost.payload.id)
    return createPortal(<div className="pointer-events-none fixed z-[120] flex h-20 w-28 -translate-x-1/2 -translate-y-1/2 rotate-2 items-center gap-2 rounded-xl border border-border-color bg-bg-card/95 p-3 text-accent shadow-xl" style={style}><ImageIcon size={22} /><span className="min-w-0 truncate text-sm font-semibold text-text-primary">{illustration?.title || t('common.untitled')}</span></div>, document.body)
  }
  const note = notesById.get(ghost.payload.id)
  return createPortal(<div className="pointer-events-none fixed z-[120] h-20 w-32 -translate-x-1/2 -translate-y-1/2 rotate-[-2deg] rounded-xl border border-border-color bg-[#fff7d6] p-3 shadow-xl" style={style}><p className="truncate text-sm font-semibold text-text-primary">{note?.title || t('common.untitled')}</p><p className="mt-1 line-clamp-2 text-xs text-text-muted">{note?.plain_text || t('common.noContent')}</p></div>, document.body)
}

function readStoredDrawerDock(): JournalDrawerDock {
  const value = readLocalStorage(DRAWER_DOCK_STORAGE_KEY)
  return value === 'right' || value === 'top' || value === 'bottom' || value === 'left' ? value : 'left'
}

function createDraftId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function stampToInput(stamp: Stamp | StampInput): StampInput {
  return {
    template_id: stamp.template_id,
    template_snapshot: stamp.template_snapshot,
    label: stamp.label,
    color: stamp.color,
    position: stamp.position,
    x: stamp.x,
    y: stamp.y,
    rotation: stamp.rotation,
    size: stamp.size,
    opacity: stamp.opacity,
  }
}
