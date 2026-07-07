import { ArrowLeft, Check, ChevronLeft, ChevronRight, GripHorizontal, GripVertical, ImageIcon, Loader2, Palette, PackageOpen, Pin, PinOff, Search, Sparkles, Stamp as StampIcon, StickyNote } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../../ui/Button'
import { Modal } from '../../ui/Modal'
import { SelectMenu } from '../../ui/SelectMenu'
import { PAGE_HEADER_CLASS } from '../../layout/pageShell'
import { useUiMotionSeconds } from '../../features/themes/uiMotion'
import { useI18n } from '../../../i18n/useI18n'
import type { Illustration, JournalDraftItem, JournalPageOrientation, Note, Oshi, Stamp, StampInput } from '../../../types'
import { fetchAllOshis } from '../../../features/oshis/oshiService'
import { fetchNotesByOshi } from '../../../features/notes/noteService'
import { fetchIllustrations } from '../../../features/illustrations/illustrationService'
import { createJournalPageFromDraft } from '../../../features/journal/journalService'
import { getJournalPageSize } from '../../../features/journal/journalLayout'
import { JOURNAL_BACKGROUND_PRESETS } from '../../../features/journal/journalBackgrounds'
import { JOURNAL_MATERIAL_KINDS, JOURNAL_MATERIALS, getJournalMaterialDefinition, getMaterialSnapshot } from '../../../features/journal/journalMaterials'
import type { JournalMaterialKind } from '../../../types'
import { JournalMaterialTile } from './JournalMaterialTile'
import { JournalDraftCanvas, type DragPayload } from './JournalDraftCanvas'
import { getPageBackground } from './journalCanvasStyle'
import { StampControl } from '../stamps/StampControl'

type StepId = 'setup' | 'notes' | 'images' | 'materials' | 'stamp' | 'review'
type NoteFilter = 'all' | 'favorite' | 'tagged' | 'untagged'
type ImageFilter = 'all' | 'official' | 'fanart' | 'favorite'
type DrawerDock = 'left' | 'right' | 'top' | 'bottom'
type DragGhost = { payload: DragPayload; x: number; y: number } | null

const STEPS: { id: StepId; icon: typeof Palette; labelKey: string }[] = [
  { id: 'setup', icon: Palette, labelKey: 'journalCreate.step.setup' },
  { id: 'notes', icon: StickyNote, labelKey: 'journalCreate.step.notes' },
  { id: 'images', icon: ImageIcon, labelKey: 'journalCreate.step.images' },
  { id: 'materials', icon: PackageOpen, labelKey: 'journalCreate.step.decorations' },
  { id: 'stamp', icon: StampIcon, labelKey: 'journalCreate.step.stamp' },
  { id: 'review', icon: Sparkles, labelKey: 'journalCreate.step.review' },
]

const NOTE_PAGE_SIZE = 20
const IMAGE_PAGE_SIZE = 20
const MATERIAL_PAGE_SIZE = 12
const DRAFT_STEPS = STEPS.filter((step) => step.id !== 'setup')
const DRAWER_DOCK_STORAGE_KEY = 'oshinote.journalCreate.drawerDock'

interface JournalCreationFlowDraft {
  oshiId: string
  title: string
  dateLabel: string
  description: string
  background: string
  orientation: JournalPageOrientation
  items: JournalDraftItem[]
  stamp: Stamp | StampInput | null
}

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
  const [background, setBackground] = useState(initialDraft?.background || 'sakura')
  const [orientation, setOrientation] = useState<JournalPageOrientation>(initialDraft?.orientation || 'portrait')
  const [items, setItems] = useState<JournalDraftItem[]>(initialDraft?.items || [])
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [stampDraft, setStampDraft] = useState<StampInput | null>(() => initialDraft?.stamp ? stampToInput(initialDraft.stamp) : null)
  const [stampPlacementDraft, setStampPlacementDraft] = useState<StampInput | null>(null)
  const [zoom, setZoom] = useState(0.72)
  const [drawerDock, setDrawerDock] = useState<DrawerDock>(() => readStoredDrawerDock())
  const [drawerPinned, setDrawerPinned] = useState(false)
  const [drawerHovered, setDrawerHovered] = useState(false)
  const [narrowViewport, setNarrowViewport] = useState(false)
  const [noteQuery, setNoteQuery] = useState('')
  const [noteFilter, setNoteFilter] = useState<NoteFilter>('all')
  const [notePage, setNotePage] = useState(1)
  const [imageQuery, setImageQuery] = useState('')
  const [imageFilter, setImageFilter] = useState<ImageFilter>('all')
  const [imagePage, setImagePage] = useState(1)
  const [materialKind, setMaterialKind] = useState<'all' | JournalMaterialKind>('all')
  const [materialPage, setMaterialPage] = useState(1)
  const [loadingResources, setLoadingResources] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [confirmBackOpen, setConfirmBackOpen] = useState(false)
  const [draftBackSaved, setDraftBackSaved] = useState(false)
  const [dragGhost, setDragGhost] = useState<DragGhost>(null)

  useEffect(() => {
    let alive = true
    fetchAllOshis()
      .then((rows) => {
        if (!alive) return
        setOshis(rows)
        if (!selectedOshiId && rows[0]) setSelectedOshiId(rows[0].id)
      })
      .catch(() => {
        if (alive) setOshis([])
      })
    return () => { alive = false }
  }, [selectedOshiId])

  useEffect(() => {
    let alive = true
    if (!selectedOshiId) {
      setNotes([])
      setIllustrations([])
      if (!editMode) {
        setItems([])
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
      .finally(() => {
        if (alive) setLoadingResources(false)
      })
    return () => { alive = false }
  }, [editMode, selectedOshiId])

  useEffect(() => { setNotePage(1) }, [noteQuery, noteFilter])
  useEffect(() => { setImagePage(1) }, [imageQuery, imageFilter])
  useEffect(() => { setMaterialPage(1) }, [materialKind])
  useEffect(() => {
    setDraftBackSaved(false)
  }, [items, stampDraft])
  useEffect(() => {
    localStorage.setItem(DRAWER_DOCK_STORAGE_KEY, drawerDock)
  }, [drawerDock])
  useEffect(() => {
    function syncViewport() {
      setNarrowViewport(window.innerWidth < 768)
    }
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
  const effectiveDrawerDock: DrawerDock = narrowViewport ? 'bottom' : drawerDock

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
      if (distance < 8) return
      const pageElement = document.querySelector<HTMLElement>('[data-journal-draft-page="true"]')
      if (!pageElement) return
      const rect = pageElement.getBoundingClientRect()
      const x = Math.min(Math.max(nextEvent.clientX, rect.left), rect.right)
      const y = Math.min(Math.max(nextEvent.clientY, rect.top), rect.bottom)
      addDraftItem(payload, {
        x: (x - rect.left) / zoom,
        y: (y - rect.top) / zoom,
      })
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
    const draftItem: JournalDraftItem = {
      ...base,
      draftId: createDraftId(),
      x: Math.max(24, Math.min(x, pageSize.width - base.width - 24)),
      y: Math.max(24, Math.min(y, pageSize.height - base.height - 24)),
      zIndex: Math.max(0, ...items.map((item) => item.zIndex)) + 1,
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
        stylePayload: JSON.stringify({
          noteCard: {
            titleVisible: true,
            titleText: note?.title || '',
            bodyText: (note?.plain_text || '').slice(0, 200),
            fontFamily: 'system',
            fontSize: 14,
            fontWeight: 500,
            lineHeight: 1.45,
            textColor: '#1f2f4d',
            backgroundColor: '#fff7d6',
            padding: 16,
            radius: 16,
            showTags: true,
          },
        }),
        width: 260,
        height: 178,
        rotation: -2,
      }
    }
    if (payload.kind === 'illustration') {
      return {
        itemType: 'illustration',
        sourceId: payload.id,
        stylePayload: JSON.stringify({
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
        width: 300,
        height: 230,
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
      const page = await createJournalPageFromDraft({
        ...draft,
        bookId: targetBookId,
        stamp: stampDraft,
      })
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
          <button type="button" onClick={onCancelEdit} className="rounded-lg p-2 text-text-muted transition-colors hover:bg-bg-secondary hover:text-text-primary" title={t('journalEditor.back')}>
            <ArrowLeft size={22} />
          </button>
        ) : (
          <Link to="/journal" className="rounded-lg p-2 text-text-muted transition-colors hover:bg-bg-secondary hover:text-text-primary" title={t('journalEditor.back')}>
            <ArrowLeft size={22} />
          </Link>
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
          <motion.div
            key="setup"
            className="min-h-0 flex-1"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: motionSeconds, ease: 'easeOut' }}
          >
            <SetupStep
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
              onOrientationChange={setOrientation}
              onNext={() => setStepIndex(1)}
            />
          </motion.div>
        ) : (
          <motion.div
            key="draft"
            className="relative flex min-h-0 flex-1 overflow-hidden"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: motionSeconds, ease: 'easeOut' }}
          >
            <StepRail
              stepId={step.id}
              onStepChange={(nextStep) => setStepIndex(STEPS.findIndex((item) => item.id === nextStep))}
              onHoverChange={setDrawerHoverOpen}
            />
            <EdgeDrawer
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
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: effectiveDrawerDock === 'right' ? 10 : -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: effectiveDrawerDock === 'right' ? -10 : 10 }}
                  transition={{ duration: motionSeconds, ease: 'easeOut' }}
                >
                  {step.id === 'notes' && (
                    <NotesDrawer
                      notes={notes}
                      loading={loadingResources}
                      query={noteQuery}
                      filter={noteFilter}
                      page={notePage}
                      placedIds={placedNoteIds}
                      onQueryChange={setNoteQuery}
                      onFilterChange={setNoteFilter}
                      onPageChange={setNotePage}
                      onPointerPlace={startPointerResourceDrag}
                    />
                  )}
                  {step.id === 'images' && (
                    <ImagesDrawer
                      illustrations={illustrations}
                      loading={loadingResources}
                      query={imageQuery}
                      filter={imageFilter}
                      page={imagePage}
                      placedIds={placedIllustrationIds}
                      onQueryChange={setImageQuery}
                      onFilterChange={setImageFilter}
                      onPageChange={setImagePage}
                      onPointerPlace={startPointerResourceDrag}
                    />
                  )}
                  {step.id === 'materials' && (
                    <MaterialsDrawer
                      kind={materialKind}
                      page={materialPage}
                      onKindChange={setMaterialKind}
                      onPageChange={setMaterialPage}
                      onPointerPlace={startPointerResourceDrag}
                    />
                  )}
                  {step.id === 'stamp' && (
                    <StampDrawer
                      value={stampDraft}
                      placing={Boolean(stampPlacementDraft)}
                      onClear={() => {
                        setStampDraft(null)
                        setStampPlacementDraft(null)
                      }}
                      onStartPlacement={(stamp) => setStampPlacementDraft(stamp)}
                      onCancelPlacement={() => setStampPlacementDraft(null)}
                    />
                  )}
                  {step.id === 'review' && (
                    <ReviewDrawer
                      title={title}
                      dateLabel={dateLabel}
                      description={description}
                      background={background}
                      orientation={orientation}
                      itemCount={items.length}
                      stamp={stampDraft}
                      creating={creating}
                      canCreate={canSubmit}
                      onCreate={handleSubmit}
                      submitLabel={editMode ? t('journalEditor.setup.save') : t('journalCreate.create')}
                      submittingLabel={editMode ? t('journalEditor.setup.saving') : t('journalCreate.creating')}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </EdgeDrawer>

            <JournalDraftCanvas
              background={background}
              orientation={orientation}
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
              onStampPlace={(stamp) => setStampDraft(stamp)}
              onStampPlacementComplete={() => setStampPlacementDraft(null)}
              onStampPlacementCancel={() => setStampPlacementDraft(null)}
            />

            <div className="absolute bottom-5 right-6 z-[75] flex gap-2">
              <Button variant="secondary" size="sm" onClick={handleBackStep}>
                {t('journalCreate.back')}
              </Button>
              <Button variant="primary" size="sm" onClick={handleSubmit} disabled={!canSubmit}>
                {creating ? (editMode ? t('journalEditor.setup.saving') : t('journalCreate.creating')) : (editMode ? t('journalEditor.setup.save') : t('journalCreate.create'))}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal open={confirmBackOpen} onClose={() => setConfirmBackOpen(false)} title={t('journalCreate.backConfirm.title')}>
        <div className="grid gap-4">
          <p className="text-sm leading-relaxed text-text-secondary">{t('journalCreate.backConfirm.body')}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmBackOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setDraftBackSaved(true)
                setConfirmBackOpen(false)
                setStepIndex(0)
              }}
            >
              {t('journalCreate.backConfirm.save')}
            </Button>
          </div>
        </div>
      </Modal>
      <DragGhostPreview ghost={dragGhost} notesById={notesById} illustrationsById={illustrationsById} />
    </div>
  )
}

function DragGhostPreview({
  ghost,
  notesById,
  illustrationsById,
}: {
  ghost: DragGhost
  notesById: Map<string, Note>
  illustrationsById: Map<string, Illustration>
}) {
  const { t } = useI18n()
  if (!ghost) return null
  const style = {
    left: ghost.x,
    top: ghost.y,
  }
  if (ghost.payload.kind === 'material') {
    const material = getJournalMaterialDefinition(ghost.payload.id)
    if (!material) return null
    return createPortal(
      <div className="pointer-events-none fixed z-[120] h-20 w-24 -translate-x-1/2 -translate-y-1/2 rotate-[-4deg] opacity-90 drop-shadow-xl" style={style}>
        <JournalMaterialTile fill material={material} />
      </div>,
      document.body
    )
  }
  if (ghost.payload.kind === 'illustration') {
    const illustration = illustrationsById.get(ghost.payload.id)
    return createPortal(
      <div className="pointer-events-none fixed z-[120] flex h-20 w-28 -translate-x-1/2 -translate-y-1/2 rotate-2 items-center gap-2 rounded-xl border border-border-color bg-bg-card/95 p-3 text-accent shadow-xl" style={style}>
        <ImageIcon size={22} />
        <span className="min-w-0 truncate text-sm font-semibold text-text-primary">{illustration?.title || t('common.untitled')}</span>
      </div>,
      document.body
    )
  }
  const note = notesById.get(ghost.payload.id)
  return createPortal(
    <div className="pointer-events-none fixed z-[120] h-20 w-32 -translate-x-1/2 -translate-y-1/2 rotate-[-2deg] rounded-xl border border-border-color bg-[#fff7d6] p-3 shadow-xl" style={style}>
      <p className="truncate text-sm font-semibold text-text-primary">{note?.title || t('common.untitled')}</p>
      <p className="mt-1 line-clamp-2 text-xs text-text-muted">{note?.plain_text || t('common.noContent')}</p>
    </div>,
    document.body
  )
}

function SetupStep({
  oshis,
  selectedOshiId,
  onOshiChange,
  title,
  onTitleChange,
  dateLabel,
  onDateLabelChange,
  description,
  onDescriptionChange,
  background,
  onBackgroundChange,
  orientation,
  onOrientationChange,
  onNext,
}: {
  oshis: Oshi[]
  selectedOshiId: string
  onOshiChange: (oshiId: string) => void
  title: string
  onTitleChange: (value: string) => void
  dateLabel: string
  onDateLabelChange: (value: string) => void
  description: string
  onDescriptionChange: (value: string) => void
  background: string
  onBackgroundChange: (value: string) => void
  orientation: JournalPageOrientation
  onOrientationChange: (value: JournalPageOrientation) => void
  onNext: () => void
}) {
  const { t } = useI18n()
  return (
    <main className="min-h-0 flex-1 overflow-y-auto px-5 py-5 lg:px-8">
      <section className="mx-auto grid max-w-7xl gap-5">
        <div className="grid gap-5 rounded-2xl border border-border-color bg-bg-secondary/45 p-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="grid auto-rows-fr gap-x-4 gap-y-5 md:grid-cols-2">
          <label className="grid min-w-0 content-start gap-1.5 text-xs font-medium text-text-muted">
            {t('journalEditor.setup.oshi')}
            <SelectMenu
              value={selectedOshiId}
              onChange={onOshiChange}
              options={oshis.map((oshi) => ({ value: oshi.id, label: oshi.name }))}
              placeholder={t('journalEditor.setup.chooseOshi')}
              ariaLabel={t('journalEditor.setup.chooseOshi')}
              className="w-full"
              buttonClassName="h-14 w-full rounded-xl text-text-primary"
              menuClassName="w-full"
            />
          </label>
          <label className="grid min-w-0 content-start gap-1.5 text-xs font-medium text-text-muted">
            {t('journalEditor.setup.pageTitle')}
            <input value={title} onChange={(event) => onTitleChange(event.target.value)} className={`${fieldClassName} h-14 w-full`} placeholder={t('journalEditor.setup.pageTitlePlaceholder')} />
          </label>
          <label className="grid min-w-0 content-start gap-1.5 text-xs font-medium text-text-muted">
            {t('journalEditor.setup.dateLabel')}
            <input value={dateLabel} onChange={(event) => onDateLabelChange(event.target.value)} className={`${fieldClassName} h-14 w-full`} placeholder={t('journalEditor.setup.dateLabelPlaceholder')} />
          </label>
          <label className="grid min-w-0 content-start gap-1.5 text-xs font-medium text-text-muted">
            {t('journalEditor.setup.description')}
            <input value={description} onChange={(event) => onDescriptionChange(event.target.value)} className={`${fieldClassName} h-14 w-full`} placeholder={t('journalEditor.setup.descriptionPlaceholder')} />
          </label>
          </div>
          <div className="rounded-2xl border border-border-color bg-bg-primary/70 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{t('journalCreate.preview')}</p>
            <EmptyPagePreview background={background} orientation={orientation} />
          </div>
        </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{t('journalCreate.orientation')}</p>
            <div className="grid max-w-lg grid-cols-2 gap-2">
              {(['portrait', 'landscape'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onOrientationChange(value)}
                  className={clsx(
                    'h-12 rounded-xl border px-3 text-sm font-semibold transition-colors',
                    orientation === value ? 'border-accent bg-accent-soft text-accent' : 'border-border-color bg-bg-secondary text-text-secondary hover:border-border-hover'
                  )}
                >
                  {t(`journalCreate.orientation.${value}` as never)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {JOURNAL_BACKGROUND_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onBackgroundChange(preset.id)}
                className={clsx(
                  'overflow-hidden rounded-xl border bg-bg-secondary text-left transition-colors hover:border-border-hover',
                  background === preset.id ? 'border-accent ring-2 ring-accent-soft' : 'border-border-color'
                )}
              >
                <span className="block h-24" style={preset.previewStyle} />
                <span className="block p-3">
                  <span className="block text-sm font-semibold text-text-primary">{t(preset.labelKey)}</span>
                  <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-text-muted">{t(preset.descriptionKey)}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="flex justify-end">
            <Button variant="primary" size="sm" onClick={onNext} disabled={!selectedOshiId}>
              {t('journalCreate.next')}
            </Button>
          </div>
      </section>
    </main>
  )
}

function EmptyPagePreview({ background, orientation }: { background: string; orientation: JournalPageOrientation }) {
  const pageSize = getJournalPageSize(orientation)
  const width = orientation === 'landscape' ? 210 : 150
  const height = Math.round(width * pageSize.height / pageSize.width)
  return (
    <div
      className="mx-auto rounded-xl border border-border-color shadow-[0_14px_28px_rgba(40,46,70,0.14)]"
      style={{
        width,
        height,
        ...getPageBackground(background),
      }}
    />
  )
}

function StepRail({
  stepId,
  onStepChange,
  onHoverChange,
}: {
  stepId: StepId
  onStepChange: (stepId: StepId) => void
  onHoverChange: (value: boolean) => void
}) {
  const { t } = useI18n()
  return (
    <nav
      className="hidden w-20 shrink-0 border-r border-border-color bg-bg-secondary/45 px-2 py-4 md:block"
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      <div className="grid gap-2">
        {DRAFT_STEPS.map((step) => {
          const Icon = step.icon
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onStepChange(step.id)}
              className={clsx(
                'flex h-12 w-full items-center justify-center rounded-xl transition-colors',
                step.id === stepId ? 'bg-accent text-white' : 'text-text-muted hover:bg-bg-primary hover:text-accent'
              )}
              title={t(step.labelKey as never)}
            >
              <Icon size={18} />
            </button>
          )
        })}
      </div>
    </nav>
  )
}

function EdgeDrawer({
  open,
  pinned,
  dock,
  motionSeconds,
  label,
  children,
  onPinnedChange,
  onDockChange,
  onHoverChange,
}: {
  open: boolean
  pinned: boolean
  dock: DrawerDock
  motionSeconds: number
  label: string
  children: ReactNode
  onPinnedChange: (value: boolean) => void
  onDockChange: (value: DrawerDock) => void
  onHoverChange: (value: boolean) => void
}) {
  const { t } = useI18n()
  const dragRef = useRef<{ x: number; y: number; dragging: boolean } | null>(null)
  const [dockHint, setDockHint] = useState<DrawerDock | null>(null)
  const horizontal = dock === 'top' || dock === 'bottom'

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { x: event.clientX, y: event.clientY, dragging: false }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag) return
    if (Math.abs(event.clientX - drag.x) + Math.abs(event.clientY - drag.y) > 8) {
      drag.dragging = true
      setDockHint(getDockFromPoint(event.clientX, event.clientY))
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    dragRef.current = null
    setDockHint(null)
    event.currentTarget.releasePointerCapture(event.pointerId)
    if (!drag?.dragging) return
    const nextDock = getDockFromPoint(event.clientX, event.clientY)
    if (nextDock) onDockChange(nextDock)
  }

  return (
    <aside
      className={clsx(
        'pointer-events-none absolute z-[60] transition-[inset,opacity] duration-200',
        getDrawerOuterClass(dock)
      )}
      style={{ transitionDuration: `${motionSeconds}s` }}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      <div className={clsx(
        'pointer-events-auto border-border-color bg-bg-card/95 shadow-xl backdrop-blur transition-[opacity,transform] duration-200 ease-out',
        getDrawerPanelPositionClass(dock),
        horizontal ? 'h-[300px] max-h-[45vh] w-full border-b' : 'h-full w-80 border-r',
        dock === 'right' && 'border-l border-r-0',
        dock === 'bottom' && 'border-t border-b-0',
        open ? 'translate-x-0 translate-y-0 opacity-100' : getDrawerClosedClass(dock)
      )}
        style={{ transitionDuration: `${motionSeconds}s` }}
      >
        <div
          className="flex h-14 cursor-grab touch-none items-center justify-between gap-3 border-b border-border-color px-4 active:cursor-grabbing"
          title={t('journalCreate.drawer.drag')}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            dragRef.current = null
            setDockHint(null)
          }}
        >
          <span className="text-text-muted">{horizontal ? <GripHorizontal size={17} /> : <GripVertical size={17} />}</span>
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary">{label}</h2>
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onPinnedChange(!pinned)}
            className={clsx(
              'rounded-lg p-2 transition-colors hover:bg-bg-secondary hover:text-accent',
              pinned ? 'text-accent' : 'text-text-muted'
            )}
            title={pinned ? t('journalCreate.drawer.unpin') : t('journalCreate.drawer.pin')}
          >
            {pinned ? <PinOff size={16} /> : <Pin size={16} />}
          </button>
        </div>
        <div className="h-[calc(100%-3.5rem)] overflow-y-auto p-3">{children}</div>
      </div>
      <button
        type="button"
        onClick={() => onPinnedChange(!pinned)}
        className={clsx(
          'pointer-events-auto flex items-center justify-center border-border-color bg-bg-card text-xs font-semibold text-accent shadow-sm transition-transform duration-200',
          open && 'pointer-events-none opacity-0',
          getDrawerHandleClass(dock)
        )}
        style={{ transitionDuration: `${motionSeconds}s` }}
      >
        <span className={horizontal ? '' : '[writing-mode:vertical-rl]'}>{label}</span>
      </button>
      {dockHint ? <div className={clsx('pointer-events-none absolute rounded-2xl border-2 border-accent/70 bg-accent-soft/25 transition-opacity', getDockHintClass(dockHint))} /> : null}
    </aside>
  )
}

function NotesDrawer({
  notes,
  loading,
  query,
  filter,
  page,
  placedIds,
  onQueryChange,
  onFilterChange,
  onPageChange,
  onPointerPlace,
}: {
  notes: Note[]
  loading: boolean
  query: string
  filter: NoteFilter
  page: number
  placedIds: Set<string>
  onQueryChange: (query: string) => void
  onFilterChange: (filter: NoteFilter) => void
  onPageChange: (page: number) => void
  onPointerPlace: (payload: DragPayload, event: PointerEvent<HTMLElement>) => void
}) {
  const { t } = useI18n()
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return notes.filter((note) => {
      if (filter === 'favorite' && !note.favorite) return false
      if (filter === 'tagged' && note.tags.length === 0) return false
      if (filter === 'untagged' && note.tags.length > 0) return false
      if (!needle) return true
      return [note.title, note.plain_text, note.tags.join(' ')].some((value) => value.toLowerCase().includes(needle))
    })
  }, [filter, notes, query])
  const totalPages = Math.max(1, Math.ceil(filtered.length / NOTE_PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * NOTE_PAGE_SIZE, page * NOTE_PAGE_SIZE)

  return (
    <DrawerSection
      searchValue={query}
      searchPlaceholder={t('journalCreate.searchNotes')}
      onSearchChange={onQueryChange}
      filters={[
        ['all', t('journalCreate.filter.all')],
        ['favorite', t('journalCreate.filter.favorite')],
        ['tagged', t('journalCreate.filter.tagged')],
        ['untagged', t('journalCreate.filter.untagged')],
      ]}
      activeFilter={filter}
      onFilterChange={(value) => onFilterChange(value as NoteFilter)}
      page={page}
      totalPages={totalPages}
      onPageChange={onPageChange}
    >
      {loading ? <EmptyDrawerMessage>{t('common.loading')}</EmptyDrawerMessage> : pageItems.length === 0 ? <EmptyDrawerMessage>{t('journalCreate.emptyNotes')}</EmptyDrawerMessage> : pageItems.map((note) => {
        const placed = placedIds.has(note.id)
        return (
          <ResourceRow
            key={note.id}
            title={note.title || t('common.untitled')}
            meta={new Date(note.created_at).toLocaleDateString()}
            tags={note.tags}
            placed={placed}
            payload={{ kind: 'note', id: note.id }}
            onPointerPlace={onPointerPlace}
          />
        )
      })}
    </DrawerSection>
  )
}

function ImagesDrawer({
  illustrations,
  loading,
  query,
  filter,
  page,
  placedIds,
  onQueryChange,
  onFilterChange,
  onPageChange,
  onPointerPlace,
}: {
  illustrations: Illustration[]
  loading: boolean
  query: string
  filter: ImageFilter
  page: number
  placedIds: Set<string>
  onQueryChange: (query: string) => void
  onFilterChange: (filter: ImageFilter) => void
  onPageChange: (page: number) => void
  onPointerPlace: (payload: DragPayload, event: PointerEvent<HTMLElement>) => void
}) {
  const { t } = useI18n()
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return illustrations.filter((illustration) => {
      if (filter === 'official' && illustration.category !== 'official') return false
      if (filter === 'fanart' && illustration.category !== 'fanart') return false
      if (filter === 'favorite' && !illustration.favorite) return false
      if (!needle) return true
      return [illustration.title, illustration.artist, illustration.owner, illustration.tags.join(' ')].some((value) => value.toLowerCase().includes(needle))
    })
  }, [filter, illustrations, query])
  const totalPages = Math.max(1, Math.ceil(filtered.length / IMAGE_PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * IMAGE_PAGE_SIZE, page * IMAGE_PAGE_SIZE)

  return (
    <DrawerSection
      searchValue={query}
      searchPlaceholder={t('journalCreate.searchImages')}
      onSearchChange={onQueryChange}
      filters={[
        ['all', t('journalCreate.filter.all')],
        ['official', t('journalCreate.filter.official')],
        ['fanart', t('journalCreate.filter.fanart')],
        ['favorite', t('journalCreate.filter.favorite')],
      ]}
      activeFilter={filter}
      onFilterChange={(value) => onFilterChange(value as ImageFilter)}
      page={page}
      totalPages={totalPages}
      onPageChange={onPageChange}
    >
      {loading ? <EmptyDrawerMessage>{t('common.loading')}</EmptyDrawerMessage> : pageItems.length === 0 ? <EmptyDrawerMessage>{t('journalCreate.emptyIllustrations')}</EmptyDrawerMessage> : pageItems.map((illustration) => {
        const placed = placedIds.has(illustration.id)
        return (
          <ResourceRow
            key={illustration.id}
            title={illustration.title || illustration.original_filename || t('common.untitled')}
            meta={illustration.artist || illustration.owner || t('common.unknownArtist')}
            tags={illustration.tags}
            placed={placed}
            payload={{ kind: 'illustration', id: illustration.id }}
            leading={<ImageIcon size={18} />}
            onPointerPlace={onPointerPlace}
          />
        )
      })}
    </DrawerSection>
  )
}

function MaterialsDrawer({
  kind,
  page,
  onKindChange,
  onPageChange,
  onPointerPlace,
}: {
  kind: 'all' | JournalMaterialKind
  page: number
  onKindChange: (kind: 'all' | JournalMaterialKind) => void
  onPageChange: (page: number) => void
  onPointerPlace: (payload: DragPayload, event: PointerEvent<HTMLElement>) => void
}) {
  const { t } = useI18n()
  const filtered = kind === 'all' ? JOURNAL_MATERIALS : JOURNAL_MATERIALS.filter((material) => material.kind === kind)
  const totalPages = Math.max(1, Math.ceil(filtered.length / MATERIAL_PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * MATERIAL_PAGE_SIZE, page * MATERIAL_PAGE_SIZE)
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {JOURNAL_MATERIAL_KINDS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onKindChange(item.id)}
            className={clsx(
              'h-8 rounded-full border px-3 text-xs font-semibold transition-colors',
              kind === item.id ? 'border-accent bg-accent-soft text-accent' : 'border-border-color bg-bg-secondary text-text-secondary hover:border-border-hover'
            )}
          >
            {t(item.labelKey)}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {pageItems.map((material) => (
          <div
            key={material.id}
            role="button"
            tabIndex={0}
            draggable
            onDragStart={(event) => setDragPayload(event.dataTransfer, { kind: 'material', id: material.id })}
            onPointerDown={(event) => onPointerPlace({ kind: 'material', id: material.id }, event)}
            className="cursor-grab rounded-xl border border-border-color bg-bg-secondary p-2 text-left transition-colors hover:border-border-hover active:cursor-grabbing"
          >
            <JournalMaterialTile material={material} compact />
            <span className="mt-2 block truncate text-xs font-semibold text-text-primary">{t(material.nameKey)}</span>
          </div>
        ))}
      </div>
      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  )
}

function StampDrawer({
  value,
  placing,
  onClear,
  onStartPlacement,
  onCancelPlacement,
}: {
  value: StampInput | null
  placing: boolean
  onClear: () => void
  onStartPlacement: (stamp: StampInput) => void
  onCancelPlacement: () => void
}) {
  const { t } = useI18n()
  return (
    <div className="grid gap-3">
      <p className="text-sm leading-relaxed text-text-muted">{t('journalCreate.stampPlacementHint')}</p>
      <StampControl
        value={value}
        onClear={onClear}
        onStartPlacement={onStartPlacement}
        onCancelPlacement={onCancelPlacement}
        placing={placing}
      />
      {value ? <p className="text-xs font-semibold text-accent">{t('journalCreate.stampPlaced')}</p> : <p className="text-xs text-text-muted">{t('journalCreate.stampNotPlaced')}</p>}
    </div>
  )
}

function ReviewDrawer({
  title,
  dateLabel,
  description,
  background,
  orientation,
  itemCount,
  stamp,
  creating,
  canCreate,
  onCreate,
  submitLabel,
  submittingLabel,
}: {
  title: string
  dateLabel: string
  description: string
  background: string
  orientation: JournalPageOrientation
  itemCount: number
  stamp: StampInput | null
  creating: boolean
  canCreate: boolean
  onCreate: () => void
  submitLabel: string
  submittingLabel: string
}) {
  const { t } = useI18n()
  const preset = JOURNAL_BACKGROUND_PRESETS.find((item) => item.id === background)
  return (
    <div className="grid gap-3">
      <ReviewCard label={t('journalCreate.review.storage')} value={title || t('journalEditor.defaultPageTitle')} subValue={description || dateLabel} />
      <ReviewCard label={t('journalCreate.review.background')} value={preset ? t(preset.labelKey) : background} />
      <ReviewCard label={t('journalCreate.review.orientation')} value={t(`journalCreate.orientation.${orientation}` as never)} />
      <ReviewCard label={t('journalCreate.review.items')} value={String(itemCount)} />
      <ReviewCard label={t('journalCreate.review.stamp')} value={stamp ? t('journalCreate.stampPlaced') : t('journalCreate.stampNotPlaced')} />
      <Button variant="primary" size="sm" onClick={onCreate} disabled={!canCreate}>
        {creating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
        {creating ? submittingLabel : submitLabel}
      </Button>
    </div>
  )
}

function DrawerSection({
  searchValue,
  searchPlaceholder,
  filters,
  activeFilter,
  page,
  totalPages,
  children,
  onSearchChange,
  onFilterChange,
  onPageChange,
}: {
  searchValue: string
  searchPlaceholder: string
  filters: [string, string][]
  activeFilter: string
  page: number
  totalPages: number
  children: ReactNode
  onSearchChange: (value: string) => void
  onFilterChange: (value: string) => void
  onPageChange: (page: number) => void
}) {
  return (
    <div>
      <label className="relative mb-3 block">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input value={searchValue} onChange={(event) => onSearchChange(event.target.value)} className={`${fieldClassName} w-full pl-9`} placeholder={searchPlaceholder} />
      </label>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {filters.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onFilterChange(id)}
            className={clsx(
              'h-8 rounded-full border px-3 text-xs font-semibold transition-colors',
              activeFilter === id ? 'border-accent bg-accent-soft text-accent' : 'border-border-color bg-bg-secondary text-text-secondary hover:border-border-hover'
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid gap-2">{children}</div>
      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  )
}

function ResourceRow({
  title,
  meta,
  tags,
  placed,
  payload,
  leading,
  onPointerPlace,
}: {
  title: string
  meta: string
  tags: string[]
  placed: boolean
  payload: DragPayload
  leading?: ReactNode
  onPointerPlace: (payload: DragPayload, event: PointerEvent<HTMLElement>) => void
}) {
  const { t } = useI18n()
  return (
    <div
      role="button"
      tabIndex={placed ? -1 : 0}
      draggable={!placed}
      onDragStart={(event) => setDragPayload(event.dataTransfer, payload)}
      onPointerDown={(event) => {
        if (!placed) onPointerPlace(payload, event)
      }}
      className={clsx(
        'flex min-h-[76px] w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors',
        placed ? 'cursor-default border-accent bg-accent-soft/45 text-accent' : 'cursor-grab border-border-color bg-bg-primary/70 hover:border-border-hover active:cursor-grabbing'
      )}
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-bg-secondary text-accent">
        {placed ? <Check size={16} /> : leading || <StickyNote size={17} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-text-primary">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-text-muted">{placed ? t('journalCreate.placed') : meta}</span>
        <span className="mt-2 flex gap-1 overflow-hidden">
          {tags.slice(0, 3).map((tag) => <span key={tag} className="shrink-0 rounded-full bg-bg-secondary px-2 py-0.5 text-[11px] text-text-muted">{tag}</span>)}
        </span>
      </span>
    </div>
  )
}

function Pagination({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (page: number) => void }) {
  return (
    <div className="mt-3 flex items-center justify-between">
      <button type="button" className={pagerButtonClass} onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}>
        <ChevronLeft size={15} />
      </button>
      <span className="text-xs font-semibold text-text-muted">{page} / {totalPages}</span>
      <button type="button" className={pagerButtonClass} onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
        <ChevronRight size={15} />
      </button>
    </div>
  )
}

function ReviewCard({ label, value, subValue }: { label: string; value: string; subValue?: string }) {
  return (
    <div className="rounded-xl border border-border-color bg-bg-secondary/45 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-text-primary">{value}</p>
      {subValue ? <p className="mt-1 truncate text-xs text-text-muted">{subValue}</p> : null}
    </div>
  )
}

function EmptyDrawerMessage({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-border-color px-4 py-10 text-center text-sm text-text-muted">{children}</div>
}

function setDragPayload(dataTransfer: DataTransfer, payload: DragPayload) {
  dataTransfer.effectAllowed = 'copy'
  dataTransfer.setData('application/x-oshinote-journal-resource', JSON.stringify(payload))
  dataTransfer.setData('text/plain', payload.id)
}

function getDrawerOuterClass(dock: DrawerDock): string {
  if (dock === 'left') return 'bottom-0 left-0 top-0 md:left-20'
  if (dock === 'right') return 'bottom-0 right-0 top-0'
  if (dock === 'top') return 'left-0 right-0 top-0 md:left-20'
  return 'bottom-0 left-0 right-0 md:left-20'
}

function getDrawerPanelPositionClass(dock: DrawerDock): string {
  if (dock === 'left') return 'absolute bottom-0 left-0 top-0'
  if (dock === 'right') return 'absolute bottom-0 right-0 top-0'
  if (dock === 'top') return 'absolute left-0 right-0 top-0'
  return 'absolute bottom-0 left-0 right-0'
}

function getDrawerClosedClass(dock: DrawerDock): string {
  if (dock === 'left') return '-translate-x-full opacity-0'
  if (dock === 'right') return 'translate-x-full opacity-0'
  if (dock === 'top') return '-translate-y-full opacity-0'
  return 'translate-y-full opacity-0'
}

function getDrawerHandleClass(dock: DrawerDock): string {
  if (dock === 'left') return 'absolute left-0 top-20 h-28 w-8 rounded-r-xl border-y border-r'
  if (dock === 'right') return 'absolute right-0 top-20 h-28 w-8 rounded-l-xl border-y border-l'
  if (dock === 'top') return 'absolute left-1/2 top-0 h-8 w-28 -translate-x-1/2 rounded-b-xl border-x border-b'
  return 'absolute bottom-0 left-1/2 h-8 w-28 -translate-x-1/2 rounded-t-xl border-x border-t'
}

function getDockHintClass(dock: DrawerDock): string {
  if (dock === 'left') return 'bottom-4 left-4 top-4 w-10'
  if (dock === 'right') return 'bottom-4 right-4 top-4 w-10'
  if (dock === 'top') return 'left-4 right-4 top-4 h-10'
  return 'bottom-4 left-4 right-4 h-10'
}

function getDockFromPoint(clientX: number, clientY: number): DrawerDock | null {
  const width = window.innerWidth || 1
  const height = window.innerHeight || 1
  const xRatio = clientX / width
  const yRatio = clientY / height
  if (xRatio <= 0.2) return 'left'
  if (xRatio >= 0.8) return 'right'
  if (yRatio <= 0.2) return 'top'
  if (yRatio >= 0.8) return 'bottom'
  return null
}

function readStoredDrawerDock(): DrawerDock {
  if (typeof localStorage === 'undefined') return 'left'
  const value = localStorage.getItem(DRAWER_DOCK_STORAGE_KEY)
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

const fieldClassName = 'min-w-0 rounded-xl border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-secondary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-soft disabled:opacity-50'
const pagerButtonClass = 'flex h-8 w-8 items-center justify-center rounded-lg border border-border-color text-text-muted transition-colors hover:border-border-hover hover:text-accent disabled:cursor-not-allowed disabled:opacity-40'
