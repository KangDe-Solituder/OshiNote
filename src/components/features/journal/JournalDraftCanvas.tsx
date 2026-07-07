import { ArrowUp, Camera, Flower2, Heart, ImageIcon, Minus, Music2, Plus, RotateCcw, Sparkles, Star, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties, type DragEvent, type PointerEvent } from 'react'
import clsx from 'clsx'
import type { Illustration, JournalDraftItem, JournalPageOrientation, Note, StampInput } from '../../../types'
import { clampLayout, getJournalPageSize, type JournalLayoutInput } from '../../../features/journal/journalLayout'
import { getPageBackground } from './journalCanvasStyle'
import { getJournalMaterialDefinition, parseMaterialStyle } from '../../../features/journal/journalMaterials'
import { Button } from '../../ui/Button'
import { StampOverlay } from '../stamps/StampOverlay'
import { StampPlacementLayer } from '../stamps/StampPlacementLayer'
import { useI18n } from '../../../i18n/useI18n'
import { releaseMediaUrl, resolveMediaUrlWithFallback } from '../../../services/media/illustrationMedia'

interface JournalDraftCanvasProps {
  background: string
  orientation: JournalPageOrientation
  items: JournalDraftItem[]
  notesById: Map<string, Note>
  illustrationsById: Map<string, Illustration>
  selectedItemId: string | null
  zoom: number
  stamp: StampInput | null
  stampPlacementDraft: StampInput | null
  stampSoundEnabled: boolean
  onZoomChange: (zoom: number) => void
  onSelectItem: (itemId: string | null) => void
  onUpdateItem: (itemId: string, layout: JournalLayoutInput & { zIndex?: number; stylePayload?: string }) => void
  onRemoveItem: (itemId: string) => void
  onBringForward: (itemId: string) => void
  onDropResource: (payload: DragPayload, point: { x: number; y: number }) => void
  onStampPlace: (stamp: StampInput) => void
  onStampPlacementComplete: () => void
  onStampPlacementCancel: () => void
}

export type DragPayload =
  | { kind: 'note'; id: string }
  | { kind: 'illustration'; id: string }
  | { kind: 'material'; id: string }

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
type FrameDragMode = 'move' | 'resize' | 'rotate'

interface FrameDragState {
  pointerId: number
  mode: FrameDragMode
  handle?: ResizeHandle
  startClientX: number
  startClientY: number
  startLayout: JournalLayoutInput & { zIndex?: number }
  moved: boolean
  startAngle?: number
  center?: { x: number; y: number }
}

type NoteCardStyle = {
  titleVisible: boolean
  titleText: string
  bodyText: string
  fontFamily: string
  fontSize: number
  fontWeight: number
  lineHeight: number
  textColor: string
  backgroundColor: string
  padding: number
  radius: number
  showTags: boolean
}

type ImageItemStyle = {
  fit: 'contain' | 'cover'
  frame: 'none' | 'simple' | 'paper' | 'polaroid'
  borderWidth: number
  borderColor: string
  radius: number
  shadow: number
  backgroundColor: string
}

const RESIZE_HANDLES: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const FONT_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'serif', label: 'Serif' },
  { value: 'sans', label: 'Sans' },
  { value: 'mono', label: 'Mono' },
  { value: 'casual', label: 'Casual' },
]
const TAPE_COLORS = ['#d9c4ff', '#f6b8d2', '#b8ddff', '#f8dfa0', '#b8ead8', '#f0c9ad']
const STICKER_COLORS = ['#ef6f9f', '#f0b84a', '#7ab7e8', '#e58fbd', '#8a83d6', '#688ea8']
const PAPER_COLORS = ['#fff1f5', '#eef6ff', '#fff7d6', '#f3f0ff', '#edf7ed', '#fffdf8']

export function JournalDraftCanvas({
  background,
  orientation,
  items,
  notesById,
  illustrationsById,
  selectedItemId,
  zoom,
  stamp,
  stampPlacementDraft,
  stampSoundEnabled,
  onZoomChange,
  onSelectItem,
  onUpdateItem,
  onRemoveItem,
  onBringForward,
  onDropResource,
  onStampPlace,
  onStampPlacementComplete,
  onStampPlacementCancel,
}: JournalDraftCanvasProps) {
  const { t } = useI18n()
  const pageSize = getJournalPageSize(orientation)
  const pageRef = useRef<HTMLDivElement>(null)
  const [detailItemId, setDetailItemId] = useState<string | null>(null)
  const selectedItem = items.find((item) => item.draftId === selectedItemId) || null
  const detailItem = items.find((item) => item.draftId === detailItemId) || null

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setDetailItemId(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (detailItemId && !items.some((item) => item.draftId === detailItemId)) setDetailItemId(null)
  }, [detailItemId, items])

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    const raw = event.dataTransfer.getData('application/x-oshinote-journal-resource')
    if (!raw) return
    try {
      const payload = JSON.parse(raw) as DragPayload
      const rect = event.currentTarget.getBoundingClientRect()
      onDropResource(payload, {
        x: (event.clientX - rect.left) / zoom,
        y: (event.clientY - rect.top) / zoom,
      })
    } catch {
      // Ignore malformed drag payloads.
    }
  }

  function closeItemDetail() {
    setDetailItemId(null)
  }

  function removeSelectedItem(itemId: string) {
    onRemoveItem(itemId)
    if (detailItemId === itemId) setDetailItemId(null)
  }

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 items-start justify-center overflow-auto bg-[var(--journal-canvas-bg)] p-6">
      <div className="fixed right-6 top-24 z-[70] flex h-10 items-center gap-1 rounded-2xl border border-border-color bg-bg-card/90 p-1 shadow-sm backdrop-blur">
        <button type="button" onClick={() => onZoomChange(Math.max(0.45, zoom - 0.1))} className="rounded-xl p-2 text-text-muted hover:bg-bg-secondary hover:text-accent" title={t('journalEditor.zoomOut')}>
          <Minus size={15} />
        </button>
        <span className="min-w-12 text-center text-xs font-semibold text-text-secondary">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => onZoomChange(Math.min(1.25, zoom + 0.1))} className="rounded-xl p-2 text-text-muted hover:bg-bg-secondary hover:text-accent" title={t('journalEditor.zoomIn')}>
          <Plus size={15} />
        </button>
      </div>

      <div style={{ width: pageSize.width * zoom, height: pageSize.height * zoom }}>
        <div
          ref={pageRef}
          data-journal-draft-page="true"
          className="relative overflow-hidden rounded-xl border border-border-color shadow-[0_18px_42px_rgba(40,46,70,0.18)]"
          style={{
            width: pageSize.width,
            height: pageSize.height,
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
            ...getPageBackground(background),
          }}
          onClick={(event) => {
            if (event.currentTarget === event.target) {
              onSelectItem(null)
              closeItemDetail()
            }
          }}
          onDragOver={(event) => {
            event.preventDefault()
            event.dataTransfer.dropEffect = 'copy'
          }}
          onDrop={handleDrop}
        >
          {items.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center text-sm text-text-muted">
              {t('journalCreate.dragHint')}
            </div>
          )}

          {items.map((item) => (
            <CanvasItemFrame
              key={item.draftId}
              item={item}
              note={item.sourceId ? notesById.get(item.sourceId) : undefined}
              illustration={item.sourceId ? illustrationsById.get(item.sourceId) : undefined}
              selected={item.draftId === selectedItemId}
              orientation={orientation}
              zoom={zoom}
              pageRef={pageRef}
              onSelect={onSelectItem}
              onOpenDetail={(itemId) => {
                onSelectItem(itemId)
                setDetailItemId(itemId)
              }}
              onUpdateItem={onUpdateItem}
            />
          ))}

          <div className="pointer-events-none absolute inset-0">
            <StampOverlay stamp={stamp} />
            <StampPlacementLayer
              active={Boolean(stampPlacementDraft)}
              stamp={stampPlacementDraft}
              soundEnabled={stampSoundEnabled}
              onPlace={onStampPlace}
              onComplete={onStampPlacementComplete}
              onCancel={onStampPlacementCancel}
            />
          </div>
        </div>
      </div>

      {selectedItem && (
        <div className="fixed bottom-5 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-border-color bg-bg-card/95 p-1.5 shadow-xl backdrop-blur">
          <button className={toolButtonClass} type="button" onClick={() => resizeSelected(selectedItem, -18, -18, orientation, onUpdateItem)}>
            <Minus size={15} />
          </button>
          <button className={toolButtonClass} type="button" onClick={() => resizeSelected(selectedItem, 18, 18, orientation, onUpdateItem)}>
            <Plus size={15} />
          </button>
          <button className={toolButtonClass} type="button" onClick={() => rotateSelected(selectedItem, -5, orientation, onUpdateItem)}>-5</button>
          <button className={toolButtonClass} type="button" onClick={() => onUpdateItem(selectedItem.draftId, getItemLayout({ ...selectedItem, rotation: 0 }))}>
            <RotateCcw size={15} />
          </button>
          <button className={toolButtonClass} type="button" onClick={() => rotateSelected(selectedItem, 5, orientation, onUpdateItem)}>+5</button>
          <button className={toolButtonClass} type="button" onClick={() => onBringForward(selectedItem.draftId)}>
            <ArrowUp size={15} />
          </button>
          {selectedItem.itemType === 'material' && (
            <label className="flex h-9 items-center gap-2 rounded-xl px-2 text-xs font-semibold text-text-muted">
              {t('journalCreate.glassStrength')}
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={getMaterialGlassStrength(selectedItem)}
                onChange={(event) => updateMaterialGlassStrength(selectedItem, Number(event.target.value), onUpdateItem)}
                className="w-24 accent-[var(--color-accent)]"
              />
            </label>
          )}
          <button className={`${toolButtonClass} text-red-500`} type="button" onClick={() => removeSelectedItem(selectedItem.draftId)}>
            <Trash2 size={15} />
          </button>
        </div>
      )}

      {detailItem && (
        <JournalItemDetailPanel
          item={detailItem}
          note={detailItem.sourceId ? notesById.get(detailItem.sourceId) : undefined}
          illustration={detailItem.sourceId ? illustrationsById.get(detailItem.sourceId) : undefined}
          orientation={orientation}
          onUpdateItem={onUpdateItem}
          onRemoveItem={removeSelectedItem}
          onClose={closeItemDetail}
        />
      )}
    </div>
  )
}

function CanvasItemFrame({
  item,
  note,
  illustration,
  selected,
  orientation,
  zoom,
  pageRef,
  onSelect,
  onOpenDetail,
  onUpdateItem,
}: {
  item: JournalDraftItem
  note?: Note
  illustration?: Illustration
  selected: boolean
  orientation: JournalPageOrientation
  zoom: number
  pageRef: React.RefObject<HTMLDivElement | null>
  onSelect: (itemId: string) => void
  onOpenDetail: (itemId: string) => void
  onUpdateItem: JournalDraftCanvasProps['onUpdateItem']
}) {
  const dragRef = useRef<FrameDragState | null>(null)
  const material = item.itemType === 'material' ? getJournalMaterialDefinition(item.materialId) : null
  const constraints = getDraftConstraints(item, material?.kind)

  function startDrag(event: PointerEvent<HTMLDivElement>, mode: FrameDragMode, handle?: ResizeHandle) {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    onSelect(item.draftId)
    const center = getItemCenter(item)
    let startAngle = 0
    if (mode === 'rotate') {
      const rect = pageRef.current?.getBoundingClientRect()
      if (rect) startAngle = angleFromCenter(event.clientX, event.clientY, { x: rect.left + center.x * zoom, y: rect.top + center.y * zoom })
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      mode,
      handle,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startLayout: getItemLayout(item),
      moved: false,
      startAngle,
      center,
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const layout = getDraggedLayout(drag, event, zoom, orientation, constraints, pageRef.current)
    if (Math.abs(event.clientX - drag.startClientX) + Math.abs(event.clientY - drag.startClientY) > 2) drag.moved = true
    event.currentTarget.style.left = `${layout.x}px`
    event.currentTarget.style.top = `${layout.y}px`
    event.currentTarget.style.width = `${layout.width}px`
    event.currentTarget.style.height = `${layout.height}px`
    event.currentTarget.style.transform = `rotate(${layout.rotation}deg)`
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
    if (!drag.moved) return
    const layout = getDraggedLayout(drag, event, zoom, orientation, constraints, pageRef.current)
    onUpdateItem(item.draftId, layout)
  }

  return (
    <div
      onClick={(event) => {
        event.stopPropagation()
        onSelect(item.draftId)
      }}
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onOpenDetail(item.draftId)
      }}
      onPointerDown={(event) => startDrag(event, 'move')}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { dragRef.current = null }}
      className={clsx(
        'absolute touch-none text-left focus:outline-none',
        selected && 'outline outline-2 outline-accent/90',
        selected && material?.kind !== 'tape' && 'shadow-[0_10px_26px_rgba(45,108,223,0.12)]'
      )}
      style={{
        left: item.x,
        top: item.y,
        width: item.width,
        height: item.height,
        zIndex: item.zIndex,
        transform: `rotate(${item.rotation}deg)`,
      }}
    >
      <DraftItemBody item={item} note={note} illustration={illustration} />
      {selected && (
        <>
          {RESIZE_HANDLES.map((handle) => (
            <button
              key={handle}
              type="button"
              className={clsx('absolute z-20 h-3 w-3 rounded-full border border-accent bg-bg-primary shadow-sm', getHandleClass(handle))}
              onPointerDown={(event) => startDrag(event as unknown as PointerEvent<HTMLDivElement>, 'resize', handle)}
              aria-label={`resize ${handle}`}
            />
          ))}
          <button
            type="button"
            className="absolute left-1/2 top-0 z-20 h-4 w-4 -translate-x-1/2 -translate-y-8 rounded-full border border-accent bg-bg-primary shadow-sm before:absolute before:left-1/2 before:top-full before:h-5 before:w-px before:-translate-x-1/2 before:bg-accent"
            onPointerDown={(event) => startDrag(event as unknown as PointerEvent<HTMLDivElement>, 'rotate')}
            aria-label="rotate"
          />
        </>
      )}
    </div>
  )
}

function DraftItemBody({ item, note, illustration }: { item: JournalDraftItem; note?: Note; illustration?: Illustration }) {
  const material = item.itemType === 'material' ? getJournalMaterialDefinition(item.materialId) : null
  const stylePayload = {
    ...(material?.defaultStyle || {}),
    ...parseMaterialStyle(item.stylePayload),
  }
  if (item.itemType === 'note') return <DraftNoteBody item={item} note={note} />
  if (item.itemType === 'illustration') return <DraftIllustrationBody item={item} illustration={illustration} />
  if (material) return <DraftMaterialBody materialId={material.id} stylePayload={stylePayload} />
  return null
}

function DraftNoteBody({ item, note }: { item: JournalDraftItem; note?: Note }) {
  const { t } = useI18n()
  const noteCard = getNoteCardStyle(item, note, t('common.untitled'), t('common.noContent'))
  const tags = noteCard.showTags ? (note?.tags || []).slice(0, 3) : []
  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden border border-black/10 shadow-sm"
      style={{
        backgroundColor: noteCard.backgroundColor,
        color: noteCard.textColor,
        padding: noteCard.padding,
        borderRadius: noteCard.radius,
        fontFamily: getFontFamily(noteCard.fontFamily),
        fontSize: noteCard.fontSize,
        fontWeight: noteCard.fontWeight,
        lineHeight: noteCard.lineHeight,
      }}
    >
      {noteCard.titleVisible && (
        <h4 className="mb-2 shrink-0 whitespace-pre-wrap break-words text-[1.08em] font-semibold leading-snug">
          {noteCard.titleText}
        </h4>
      )}
      <p className="min-h-0 flex-1 whitespace-pre-wrap break-words">
        {noteCard.bodyText}
      </p>
      {tags.length > 0 && (
        <div className="mt-2 flex shrink-0 flex-wrap gap-1 overflow-hidden text-[0.78em]">
          {tags.map((tag) => <span key={tag} className="rounded-full bg-white/55 px-2 py-0.5 text-text-muted">{tag}</span>)}
        </div>
      )}
    </div>
  )
}

function DraftIllustrationBody({ item, illustration }: { item: JournalDraftItem; illustration?: Illustration }) {
  const [imageSrc, setImageSrc] = useState('')
  const imageStyle = getImageItemStyle(item)

  useEffect(() => {
    let alive = true
    let currentUrl = ''
    if (!illustration) {
      setImageSrc('')
      return
    }
    resolveMediaUrlWithFallback(illustration.thumbnail_path || illustration.original_path, illustration.original_path)
      .then((url) => {
        currentUrl = url
        if (alive) setImageSrc(url)
        else releaseMediaUrl(url)
      })
      .catch(() => {
        if (alive) setImageSrc('')
      })
    return () => {
      alive = false
      releaseMediaUrl(currentUrl)
    }
  }, [illustration])

  const frameStyle = getImageFrameStyle(imageStyle)
  const imagePadding = imageStyle.frame === 'paper' ? 8 : imageStyle.frame === 'polaroid' ? 10 : 0
  const bottomPadding = imageStyle.frame === 'polaroid' ? 30 : imagePadding

  return (
    <div className="h-full w-full overflow-hidden" style={frameStyle}>
      <div
        className="h-full w-full overflow-hidden"
        style={{
          padding: `${imagePadding}px ${imagePadding}px ${bottomPadding}px`,
          borderRadius: imageStyle.radius,
        }}
      >
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={illustration?.title || ''}
            className="h-full w-full"
            style={{ objectFit: imageStyle.fit }}
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-text-muted">
            <ImageIcon size={28} />
          </div>
        )}
      </div>
    </div>
  )
}

function DraftMaterialBody({ materialId, stylePayload }: { materialId: string; stylePayload: Record<string, unknown> }) {
  const material = getJournalMaterialDefinition(materialId)
  if (!material) return null
  const color = asString(stylePayload.color) || '#d9c4ff'
  const glassStrength = asNumber(stylePayload.glassStrength, 0)
  const glassStyle = getGlassStyle(glassStrength, color)

  if (material.kind === 'tape') {
    return <TapeShape color={color} styleId={asString(stylePayload.tapeStyle) || 'washi'} extraStyle={glassStyle} />
  }
  if (material.kind === 'paper') {
    return (
      <span className="pointer-events-none relative block h-full w-full overflow-hidden border border-black/10 shadow-sm" style={{ backgroundColor: color, borderRadius: 10, ...glassStyle }}>
        {stylePayload.line === true && <span className="absolute inset-x-4 bottom-4 top-7 bg-[linear-gradient(transparent_21px,rgba(100,110,140,0.18)_22px)] bg-[length:100%_22px]" />}
      </span>
    )
  }
  if (material.kind === 'label') {
    return (
      <span
        className={clsx('pointer-events-none relative block h-full w-full border border-black/10 shadow-sm', stylePayload.shape === 'ticket' ? 'rounded-md border-dashed' : 'rounded-full')}
        style={{ backgroundColor: color, ...glassStyle }}
      />
    )
  }
  const backing = stylePayload.backing === true
  const backingShape = asString(stylePayload.backingShape) || 'circle'
  return (
    <span className="pointer-events-none flex h-full w-full items-center justify-center" style={{ color }}>
      <span
        className={clsx(
          'flex h-full w-full items-center justify-center',
          backing && (backingShape === 'square' ? 'rounded-xl border border-black/10 bg-white/75 shadow-sm' : 'rounded-full border border-black/10 bg-white/75 shadow-sm')
        )}
        style={backing ? glassStyle : undefined}
      >
        <MaterialIcon icon={asString(stylePayload.icon)} size={58} />
      </span>
    </span>
  )
}

function JournalItemDetailPanel({
  item,
  note,
  illustration,
  orientation,
  onUpdateItem,
  onRemoveItem,
  onClose,
}: {
  item: JournalDraftItem
  note?: Note
  illustration?: Illustration
  orientation: JournalPageOrientation
  onUpdateItem: JournalDraftCanvasProps['onUpdateItem']
  onRemoveItem: (itemId: string) => void
  onClose: () => void
}) {
  const { t } = useI18n()
  return (
    <aside className="fixed bottom-5 right-5 top-20 z-[85] w-80 overflow-y-auto rounded-2xl border border-border-color bg-bg-card/95 p-4 shadow-2xl backdrop-blur">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t('journalCreate.detailPanel')}</p>
          <h2 className="mt-1 text-base font-bold text-text-primary">{getDetailTitle(item, note, illustration, t)}</h2>
        </div>
        <button type="button" className="rounded-lg p-2 text-text-muted hover:bg-bg-secondary hover:text-text-primary" onClick={onClose} title={t('common.cancel')}>
          <X size={16} />
        </button>
      </div>
      <div className="grid gap-4">
        {item.itemType === 'note' && <NoteDetailControls item={item} note={note} onUpdateItem={onUpdateItem} />}
        {item.itemType === 'illustration' && <ImageDetailControls item={item} orientation={orientation} onUpdateItem={onUpdateItem} />}
        {item.itemType === 'material' && <MaterialDetailControls item={item} orientation={orientation} onUpdateItem={onUpdateItem} />}
        <Button variant="ghost" size="sm" className="w-full text-red-500" onClick={() => onRemoveItem(item.draftId)}>
          <Trash2 size={15} />
          {t('journalInspector.removeFromPage')}
        </Button>
      </div>
    </aside>
  )
}

function NoteDetailControls({ item, note, onUpdateItem }: { item: JournalDraftItem; note?: Note; onUpdateItem: JournalDraftCanvasProps['onUpdateItem'] }) {
  const { t } = useI18n()
  const noteCard = getNoteCardStyle(item, note, t('common.untitled'), t('common.noContent'))
  function update(change: Partial<NoteCardStyle>) {
    updateStylePayload(item, { noteCard: { ...noteCard, ...change } }, onUpdateItem)
  }
  return (
    <>
      <ToggleField label={t('journalCreate.detail.titleVisible')} checked={noteCard.titleVisible} onChange={(value) => update({ titleVisible: value })} />
      <TextField label={t('journalCreate.detail.titleText')} value={noteCard.titleText} onChange={(value) => update({ titleText: value })} />
      <TextAreaField label={t('journalCreate.detail.bodyText')} value={noteCard.bodyText} onChange={(value) => update({ bodyText: value.slice(0, 200) })} rows={5} />
      <SelectField label={t('journalCreate.detail.fontFamily')} value={noteCard.fontFamily} options={FONT_OPTIONS} onChange={(value) => update({ fontFamily: value })} />
      <RangeField label={t('journalCreate.detail.fontSize')} value={noteCard.fontSize} min={10} max={28} step={1} onChange={(value) => update({ fontSize: value })} />
      <RangeField label={t('journalCreate.detail.fontWeight')} value={noteCard.fontWeight} min={300} max={800} step={100} onChange={(value) => update({ fontWeight: value })} />
      <RangeField label={t('journalCreate.detail.lineHeight')} value={noteCard.lineHeight} min={1.1} max={1.9} step={0.1} onChange={(value) => update({ lineHeight: value })} />
      <ColorField label={t('journalCreate.detail.textColor')} value={noteCard.textColor} onChange={(value) => update({ textColor: value })} />
      <ColorField label={t('journalCreate.detail.backgroundColor')} value={noteCard.backgroundColor} onChange={(value) => update({ backgroundColor: value })} />
      <RangeField label={t('journalCreate.detail.padding')} value={noteCard.padding} min={6} max={28} step={1} onChange={(value) => update({ padding: value })} />
      <RangeField label={t('journalCreate.detail.radius')} value={noteCard.radius} min={0} max={28} step={1} onChange={(value) => update({ radius: value })} />
      <ToggleField label={t('journalCreate.detail.showTags')} checked={noteCard.showTags} onChange={(value) => update({ showTags: value })} />
    </>
  )
}

function ImageDetailControls({ item, orientation, onUpdateItem }: { item: JournalDraftItem; orientation: JournalPageOrientation; onUpdateItem: JournalDraftCanvasProps['onUpdateItem'] }) {
  const { t } = useI18n()
  const style = getImageItemStyle(item)
  function update(change: Partial<ImageItemStyle>) {
    updateStylePayload(item, { imageStyle: { ...style, ...change } }, onUpdateItem)
  }
  return (
    <>
      <SelectField label={t('journalCreate.detail.imageFit')} value={style.fit} options={[{ value: 'contain', label: 'Contain' }, { value: 'cover', label: 'Cover' }]} onChange={(value) => update({ fit: value as ImageItemStyle['fit'] })} />
      <SelectField label={t('journalCreate.detail.frame')} value={style.frame} options={[{ value: 'none', label: 'None' }, { value: 'simple', label: 'Simple' }, { value: 'paper', label: 'Paper' }, { value: 'polaroid', label: 'Polaroid' }]} onChange={(value) => update({ frame: value as ImageItemStyle['frame'] })} />
      <RangeField label={t('journalCreate.detail.borderWidth')} value={style.borderWidth} min={0} max={12} step={1} onChange={(value) => update({ borderWidth: value })} />
      <ColorField label={t('journalCreate.detail.borderColor')} value={style.borderColor} onChange={(value) => update({ borderColor: value })} />
      <RangeField label={t('journalCreate.detail.radius')} value={style.radius} min={0} max={32} step={1} onChange={(value) => update({ radius: value })} />
      <RangeField label={t('journalCreate.detail.shadow')} value={style.shadow} min={0} max={40} step={1} onChange={(value) => update({ shadow: value })} />
      <ColorField label={t('journalCreate.detail.backgroundColor')} value={style.backgroundColor} onChange={(value) => update({ backgroundColor: value })} />
      <LayoutNumberControls item={item} orientation={orientation} onUpdateItem={onUpdateItem} />
    </>
  )
}

function MaterialDetailControls({ item, orientation, onUpdateItem }: { item: JournalDraftItem; orientation: JournalPageOrientation; onUpdateItem: JournalDraftCanvasProps['onUpdateItem'] }) {
  const { t } = useI18n()
  const material = getJournalMaterialDefinition(item.materialId)
  const style = { ...(material?.defaultStyle || {}), ...parseMaterialStyle(item.stylePayload) }
  const isTape = material?.kind === 'tape'
  const isSticker = material?.kind === 'sticker'
  function update(change: Record<string, unknown>) {
    updateStylePayload(item, { ...style, ...change }, onUpdateItem)
  }
  return (
    <>
      {isTape && <SelectField label={t('journalInspector.tapeStyle')} value={asString(style.tapeStyle) || 'washi'} options={[
        { value: 'washi', label: t('journalInspector.tape.washi') },
        { value: 'grid', label: t('journalInspector.tape.grid') },
        { value: 'dots', label: t('journalInspector.tape.dots') },
        { value: 'stripe', label: t('journalInspector.tape.stripe') },
        { value: 'torn', label: t('journalInspector.tape.torn') },
      ]} onChange={(value) => update({ tapeStyle: value })} />}
      <SwatchField label={t('journalInspector.color')} value={asString(style.color) || '#d9c4ff'} colors={isTape ? TAPE_COLORS : isSticker ? STICKER_COLORS : PAPER_COLORS} onChange={(value) => update({ color: value })} />
      {isSticker && (
        <>
          <ToggleField label={t('journalCreate.detail.backing')} checked={style.backing === true} onChange={(value) => update({ backing: value })} />
          <SelectField label={t('journalCreate.detail.backingShape')} value={asString(style.backingShape) || 'circle'} options={[{ value: 'circle', label: 'Circle' }, { value: 'square', label: 'Square' }]} onChange={(value) => update({ backingShape: value })} />
        </>
      )}
      <RangeField label={t('journalCreate.glassStrength')} value={asNumber(style.glassStrength, 0)} min={0} max={100} step={5} onChange={(value) => update({ glassStrength: value })} />
      <LayoutNumberControls item={item} orientation={orientation} onUpdateItem={onUpdateItem} />
    </>
  )
}

function LayoutNumberControls({ item, orientation, onUpdateItem }: { item: JournalDraftItem; orientation: JournalPageOrientation; onUpdateItem: JournalDraftCanvasProps['onUpdateItem'] }) {
  const { t } = useI18n()
  function update(change: Partial<JournalLayoutInput>) {
    onUpdateItem(item.draftId, clampLayout({ ...getItemLayout(item), ...change }, getDraftConstraints(item, getJournalMaterialDefinition(item.materialId)?.kind), orientation))
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      <NumberField label={t('journalInspector.width')} value={Math.round(item.width)} onChange={(value) => update({ width: value })} />
      <NumberField label={t('journalInspector.height')} value={Math.round(item.height)} onChange={(value) => update({ height: value })} />
      <NumberField label={t('journalInspector.rotation')} value={Math.round(item.rotation)} onChange={(value) => update({ rotation: value })} />
    </div>
  )
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-text-muted">
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} className={detailInputClass} />
    </label>
  )
}

function TextAreaField({ label, value, rows, onChange }: { label: string; value: string; rows: number; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-text-muted">
      {label}
      <textarea value={value} rows={rows} onChange={(event) => onChange(event.target.value)} className={`${detailInputClass} resize-none`} />
    </label>
  )
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-text-muted">
      {label}
      <input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} className={detailInputClass} />
    </label>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-text-muted">
      {label}
      <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-xl border border-border-color bg-bg-primary p-1" />
    </label>
  )
}

function RangeField({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-text-muted">
      <span className="flex justify-between gap-2"><span>{label}</span><span>{value}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="accent-[var(--color-accent)]" />
    </label>
  )
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-border-color bg-bg-primary px-3 py-2 text-xs font-semibold text-text-secondary">
      {label}
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" />
    </label>
  )
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-text-muted">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className={detailInputClass}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

function SwatchField({ label, value, colors, onChange }: { label: string; value: string; colors: string[]; onChange: (value: string) => void }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-text-muted">{label}</p>
      <div className="flex flex-wrap gap-2">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={clsx('h-8 w-8 rounded-full border shadow-sm transition-transform hover:scale-105', value === color ? 'border-accent ring-2 ring-accent-soft' : 'border-border-color')}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>
    </div>
  )
}

function MaterialIcon({ icon, size = 42 }: { icon: string; size?: number }) {
  if (icon === 'heart') return <Heart size={size} fill="currentColor" />
  if (icon === 'star') return <Star size={size} fill="currentColor" />
  if (icon === 'flower') return <Flower2 size={size} />
  if (icon === 'music') return <Music2 size={size} />
  if (icon === 'camera') return <Camera size={size} />
  return <Sparkles size={size} />
}

function TapeShape({ color, styleId, extraStyle }: { color: string; styleId: string; extraStyle?: CSSProperties }) {
  const style = isTapeStyleId(styleId) ? styleId : 'washi'
  return (
    <span
      className={clsx('pointer-events-none relative block h-full w-full overflow-hidden border border-white/20', style === 'torn' ? 'rounded-[5px]' : 'rounded-md')}
      style={{
        backgroundColor: color,
        ...getTapePattern(style, color),
        ...extraStyle,
        clipPath: style === 'torn'
          ? 'polygon(0 9%, 4% 0, 9% 8%, 14% 0, 20% 10%, 27% 0, 34% 8%, 42% 0, 51% 9%, 60% 0, 69% 8%, 78% 0, 87% 9%, 94% 0, 100% 8%, 98% 91%, 94% 100%, 87% 92%, 78% 100%, 70% 91%, 60% 100%, 52% 92%, 43% 100%, 35% 91%, 27% 100%, 19% 92%, 11% 100%, 4% 91%, 0 100%)'
          : undefined,
      }}
    >
      <span className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.18),rgba(255,255,255,0.03)_28%,rgba(0,0,0,0.05)_70%,rgba(255,255,255,0.12))]" />
      <span className="absolute inset-0 opacity-35 mix-blend-soft-light bg-[radial-gradient(circle_at_18%_35%,rgba(255,255,255,0.9)_0_1px,transparent_1.5px),radial-gradient(circle_at_72%_64%,rgba(0,0,0,0.45)_0_1px,transparent_1.5px)] bg-[length:18px_14px,22px_16px]" />
    </span>
  )
}

function getDraggedLayout(
  drag: FrameDragState,
  event: PointerEvent<HTMLDivElement>,
  zoom: number,
  orientation: JournalPageOrientation,
  constraints: Parameters<typeof clampLayout>[1],
  pageElement: HTMLDivElement | null
) {
  const dx = (event.clientX - drag.startClientX) / zoom
  const dy = (event.clientY - drag.startClientY) / zoom
  if (drag.mode === 'move') {
    return clampLayout({ ...drag.startLayout, x: drag.startLayout.x + dx, y: drag.startLayout.y + dy }, constraints, orientation)
  }
  if (drag.mode === 'rotate' && drag.center && pageElement) {
    const rect = pageElement.getBoundingClientRect()
    const center = { x: rect.left + drag.center.x * zoom, y: rect.top + drag.center.y * zoom }
    const nextAngle = angleFromCenter(event.clientX, event.clientY, center)
    const delta = nextAngle - (drag.startAngle || 0)
    return clampLayout({ ...drag.startLayout, rotation: drag.startLayout.rotation + delta }, constraints, orientation)
  }
  return clampLayout(resizeLayout(drag.startLayout, drag.handle || 'se', dx, dy), constraints, orientation)
}

function resizeLayout(layout: JournalLayoutInput & { zIndex?: number }, handle: ResizeHandle, dx: number, dy: number): JournalLayoutInput {
  let { x, y, width, height } = layout
  const { rotation } = layout
  if (handle.includes('e')) width += dx
  if (handle.includes('s')) height += dy
  if (handle.includes('w')) { x += dx; width -= dx }
  if (handle.includes('n')) { y += dy; height -= dy }
  return { x, y, width, height, rotation }
}

function getItemCenter(item: JournalDraftItem) {
  return { x: item.x + item.width / 2, y: item.y + item.height / 2 }
}

function angleFromCenter(clientX: number, clientY: number, center: { x: number; y: number }) {
  return Math.atan2(clientY - center.y, clientX - center.x) * 180 / Math.PI + 90
}

function getHandleClass(handle: ResizeHandle) {
  if (handle === 'nw') return '-left-1.5 -top-1.5 cursor-nwse-resize'
  if (handle === 'n') return 'left-1/2 -top-1.5 -translate-x-1/2 cursor-ns-resize'
  if (handle === 'ne') return '-right-1.5 -top-1.5 cursor-nesw-resize'
  if (handle === 'e') return '-right-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize'
  if (handle === 'se') return '-bottom-1.5 -right-1.5 cursor-nwse-resize'
  if (handle === 's') return '-bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize'
  if (handle === 'sw') return '-bottom-1.5 -left-1.5 cursor-nesw-resize'
  return '-left-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize'
}

function resizeSelected(item: JournalDraftItem, widthDelta: number, heightDelta: number, orientation: JournalPageOrientation, onUpdateItem: JournalDraftCanvasProps['onUpdateItem']) {
  const layout = clampLayout({
    x: item.x,
    y: item.y,
    width: item.width + widthDelta,
    height: item.height + heightDelta,
    rotation: item.rotation,
  }, getDraftConstraints(item, getJournalMaterialDefinition(item.materialId)?.kind), orientation)
  onUpdateItem(item.draftId, layout)
}

function rotateSelected(item: JournalDraftItem, delta: number, orientation: JournalPageOrientation, onUpdateItem: JournalDraftCanvasProps['onUpdateItem']) {
  const layout = clampLayout({
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    rotation: item.rotation + delta,
  }, getDraftConstraints(item, getJournalMaterialDefinition(item.materialId)?.kind), orientation)
  onUpdateItem(item.draftId, layout)
}

function updateStylePayload(item: JournalDraftItem, change: Record<string, unknown>, onUpdateItem: JournalDraftCanvasProps['onUpdateItem']) {
  const payload = {
    ...parseMaterialStyle(item.stylePayload),
    ...change,
  }
  onUpdateItem(item.draftId, {
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    rotation: item.rotation,
    stylePayload: JSON.stringify(payload),
  })
}

function getMaterialGlassStrength(item: JournalDraftItem): number {
  const payload = parseMaterialStyle(item.stylePayload)
  const value = typeof payload.glassStrength === 'number' ? payload.glassStrength : Number(payload.glassStrength)
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0
}

function updateMaterialGlassStrength(item: JournalDraftItem, glassStrength: number, onUpdateItem: JournalDraftCanvasProps['onUpdateItem']) {
  updateStylePayload(item, { glassStrength }, onUpdateItem)
}

function getItemLayout(item: JournalDraftItem): JournalLayoutInput {
  return {
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    rotation: item.rotation,
  }
}

function getDraftConstraints(item: JournalDraftItem, materialKind?: string) {
  if (materialKind === 'tape') return { minWidth: 90, minHeight: 18 }
  if (materialKind === 'sticker') return { minWidth: 30, minHeight: 30 }
  if (item.itemType === 'illustration') return { minWidth: 80, minHeight: 80 }
  if (item.itemType === 'note') return { minWidth: 120, minHeight: 90 }
  return undefined
}

function getNoteCardStyle(item: JournalDraftItem, note: Note | undefined, untitled: string, empty: string): NoteCardStyle {
  const payload = parseMaterialStyle(item.stylePayload)
  const raw = isRecord(payload.noteCard) ? payload.noteCard : {}
  return {
    titleVisible: raw.titleVisible !== false,
    titleText: asString(raw.titleText) || note?.title || untitled,
    bodyText: (asString(raw.bodyText) || note?.plain_text || empty).slice(0, 200),
    fontFamily: asString(raw.fontFamily) || 'system',
    fontSize: asNumber(raw.fontSize, 14),
    fontWeight: asNumber(raw.fontWeight, 500),
    lineHeight: asNumber(raw.lineHeight, 1.45),
    textColor: asString(raw.textColor) || '#1f2f4d',
    backgroundColor: asString(raw.backgroundColor) || '#fff7d6',
    padding: asNumber(raw.padding, 16),
    radius: asNumber(raw.radius, 16),
    showTags: raw.showTags !== false,
  }
}

function getImageItemStyle(item: JournalDraftItem): ImageItemStyle {
  const payload = parseMaterialStyle(item.stylePayload)
  const raw = isRecord(payload.imageStyle) ? payload.imageStyle : {}
  const fit = raw.fit === 'cover' ? 'cover' : 'contain'
  const frame = raw.frame === 'simple' || raw.frame === 'paper' || raw.frame === 'polaroid' ? raw.frame : 'none'
  return {
    fit,
    frame,
    borderWidth: asNumber(raw.borderWidth, frame === 'none' ? 0 : 2),
    borderColor: asString(raw.borderColor) || '#ffffff',
    radius: asNumber(raw.radius, 12),
    shadow: asNumber(raw.shadow, frame === 'none' ? 0 : 16),
    backgroundColor: asString(raw.backgroundColor) || (frame === 'none' ? 'transparent' : '#ffffff'),
  }
}

function getImageFrameStyle(style: ImageItemStyle): CSSProperties {
  return {
    borderRadius: style.radius,
    border: style.borderWidth > 0 ? `${style.borderWidth}px solid ${style.borderColor}` : '0 solid transparent',
    backgroundColor: style.backgroundColor,
    boxShadow: style.shadow > 0 ? `0 ${Math.round(style.shadow / 2)}px ${style.shadow}px rgba(31,47,77,0.22)` : 'none',
  }
}

function getDetailTitle(item: JournalDraftItem, note: Note | undefined, illustration: Illustration | undefined, t: ReturnType<typeof useI18n>['t']) {
  if (item.itemType === 'note') return note?.title || t('journalEditor.addNote')
  if (item.itemType === 'illustration') return illustration?.title || illustration?.original_filename || t('journalEditor.addIllustration')
  const material = getJournalMaterialDefinition(item.materialId)
  return material ? t(material.nameKey) : t('journalEditor.addMaterials')
}

function getFontFamily(value: string) {
  if (value === 'serif') return 'Georgia, "Times New Roman", serif'
  if (value === 'sans') return 'Arial, "Helvetica Neue", sans-serif'
  if (value === 'mono') return '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
  if (value === 'casual') return '"Comic Sans MS", "Segoe Print", cursive'
  return 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
}

function getTapePattern(style: string, color: string): CSSProperties {
  if (style === 'grid') {
    return {
      backgroundImage: `linear-gradient(rgba(255,255,255,0.28) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.28) 1px, transparent 1px), linear-gradient(${color}, ${color})`,
      backgroundSize: '20px 20px, 20px 20px, auto',
    }
  }
  if (style === 'dots') {
    return {
      backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.5) 0 2px, transparent 2.5px), linear-gradient(${color}, ${color})`,
      backgroundSize: '18px 18px, auto',
    }
  }
  if (style === 'stripe') {
    return {
      backgroundImage: `repeating-linear-gradient(135deg, rgba(255,255,255,0.32) 0 8px, transparent 8px 18px), linear-gradient(${color}, ${color})`,
    }
  }
  return {
    backgroundImage: `linear-gradient(90deg, rgba(255,255,255,0.2), transparent 34%, rgba(0,0,0,0.05) 74%, rgba(255,255,255,0.12)), linear-gradient(${color}, ${color})`,
  }
}

function getGlassStyle(strength: number, color: string): CSSProperties | undefined {
  if (strength <= 0) return undefined
  const alpha = Math.min(0.42, strength / 240)
  return {
    backgroundColor: `color-mix(in srgb, ${color} ${Math.max(34, 100 - strength)}%, rgba(255,255,255,${alpha}))`,
    backdropFilter: `blur(${Math.round(strength / 14)}px) saturate(${100 + Math.round(strength * 0.45)}%)`,
  }
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asNumber(value: unknown, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isTapeStyleId(value: string) {
  return value === 'washi' || value === 'grid' || value === 'dots' || value === 'stripe' || value === 'torn'
}

const detailInputClass = 'min-w-0 rounded-xl border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-secondary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-soft disabled:opacity-50'
const toolButtonClass = 'flex h-9 min-w-9 items-center justify-center rounded-xl px-2 text-sm font-semibold text-text-muted transition-colors hover:bg-bg-secondary hover:text-accent'
