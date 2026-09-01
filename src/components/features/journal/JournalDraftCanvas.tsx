import { ArrowUp, ImageIcon, Inbox, Minus, Plus, RotateCcw, StickyNote, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import type { Illustration, JournalDraftItem, JournalImage, JournalPageOrientation, Note, StampInput } from '../../../types'
import { clampLayout, getJournalPageSize, type JournalLayoutInput } from '../../../features/journal/journalLayout'
import { getDraftItemConstraints } from '../../../features/journal/journalItemSizing'
import { getMaterializedTemplateSlots } from '../../../features/journal/journalPageTemplates'
import { parseStylePayload, patchStylePayload } from '../../../features/journal/journalItemStyles'
import { asNumber, safeJsonParse, isRecord } from '../../../utils/safeJson'
import { useI18n } from '../../../i18n/useI18n'
import { getPageBackground } from './journalCanvasStyle'
import { CanvasItemFrame } from './CanvasItemFrame'
import { JournalItemDetailPanel } from './JournalItemDetailPanel'
import { JournalWorkBoard } from './JournalWorkBoard'
import { getItemLayout } from './journalDraftCanvasGeometry'
import { StampOverlay } from '../stamps/StampOverlay'
import { StampPlacementLayer } from '../stamps/StampPlacementLayer'
import { useJournalWheelZoom } from './journalCanvasZoom'
import { useJournalDragPan } from './journalCanvasPan'

interface JournalDraftCanvasProps {
  background: string
  orientation: JournalPageOrientation
  templateId?: string | null
  items: JournalDraftItem[]
  notesById: Map<string, Note>
  illustrationsById: Map<string, Illustration>
  journalImagesById: Map<string, JournalImage>
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
  onStageItem: (itemId: string) => void
  onDragStartStaged: (item: JournalDraftItem, event: React.PointerEvent<HTMLElement>) => void
  onImportFiles: (files: FileList | File[]) => void
  importing?: boolean
  onStampPlace: (stamp: StampInput) => void
  onStampPlacementComplete: () => void
  onStampPlacementCancel: () => void
}

export type DragPayload =
  | { kind: 'note'; id: string }
  | { kind: 'illustration'; id: string }
  | { kind: 'material'; id: string }
  | { kind: 'journal-image'; id: string }
  | { kind: 'staged'; id: string }

export function JournalDraftCanvas({
  background,
  orientation,
  templateId,
  items,
  notesById,
  illustrationsById,
  journalImagesById,
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
  onStageItem,
  onDragStartStaged,
  onImportFiles,
  importing,
  onStampPlace,
  onStampPlacementComplete,
  onStampPlacementCancel,
}: JournalDraftCanvasProps) {
  const { t } = useI18n()
  const pageSize = getJournalPageSize(orientation)
  const viewportRef = useJournalWheelZoom(zoom, onZoomChange)
  const pageRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const [detailItemId, setDetailItemId] = useState<string | null>(null)
  const canvasItems = useMemo(() => items.filter((item) => !item.staged), [items])
  const stagedItems = useMemo(() => items.filter((item) => item.staged), [items])
  const selectedItem = canvasItems.find((item) => item.draftId === selectedItemId) || null
  const detailItem = canvasItems.find((item) => item.draftId === detailItemId) || null
  const filledTemplateSlotIds = new Set(canvasItems.map((item) => item.templateSlotId).filter(Boolean))
  const emptyTemplateSlots = getMaterializedTemplateSlots(templateId, orientation).filter((templateSlot) => !filledTemplateSlotIds.has(templateSlot.id))

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setDetailItemId(null)
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedItemId) {
        const target = document.activeElement as HTMLElement | null
        const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)
        if (!typing) removeSelectedItem(selectedItemId)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItemId])

  useEffect(() => {
    if (detailItemId && !canvasItems.some((item) => item.draftId === detailItemId)) setDetailItemId(null)
  }, [detailItemId, canvasItems])

  // Click anywhere outside the detail panel dismisses it, matching the context-menu popover.
  useEffect(() => {
    if (!detailItemId) return
    function handlePointerDown(event: globalThis.PointerEvent) {
      const target = event.target as HTMLElement | null
      if (target?.closest('[data-journal-detail-panel="true"]')) return
      setDetailItemId(null)
    }
    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [detailItemId])

  // The work board reveals when the pointer nears the canvas top edge (like the side rail)
  // and retracts shortly after the pointer leaves it. Held-pointer drags keep it open so
  // items can be dropped onto the tray. The canvas rect is cached and the board rect is
  // only measured when relevant, so pointermove stays layout-free on the hot path.
  const boardRef = useRef<HTMLDivElement>(null)
  const boardCloseTimer = useRef<number | null>(null)
  const rootRectRef = useRef<DOMRect | null>(null)
  const [boardOpen, setBoardOpen] = useState(false)

  useEffect(() => {
    function updateRootRect() {
      rootRectRef.current = rootRef.current?.getBoundingClientRect() || null
    }

    const root = rootRef.current
    updateRootRect()
    const resizeObserver = root ? new ResizeObserver(updateRootRect) : null
    if (root) resizeObserver?.observe(root)
    window.addEventListener('resize', updateRootRect)
    // Capture scroll events from nested route containers because scrolling can
    // move the canvas without changing its dimensions.
    window.addEventListener('scroll', updateRootRect, true)
    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', updateRootRect)
      window.removeEventListener('scroll', updateRootRect, true)
    }
  }, [])

  useEffect(() => {
    function handlePointerMove(event: globalThis.PointerEvent) {
      const rootRect = rootRectRef.current
      if (!rootRect) return

      // Cheap gate first: only measure the board when near the top or while it is open.
      const dy = event.clientY - rootRect.top
      const withinCanvasX = event.clientX >= rootRect.left && event.clientX <= rootRect.right
      if (dy > 120 && boardCloseTimer.current === null && !boardOpen) return
      if (!withinCanvasX && !boardOpen) return

      const boardRect = boardRef.current?.getBoundingClientRect()
      const insideBoard = boardRect
        ? event.clientX >= boardRect.left && event.clientX <= boardRect.right
          && event.clientY >= boardRect.top - 8 && event.clientY <= boardRect.bottom + 8
        : false
      const nearTop = withinCanvasX && dy >= 0 && dy <= 32

      if (nearTop || insideBoard) {
        if (boardCloseTimer.current !== null) {
          window.clearTimeout(boardCloseTimer.current)
          boardCloseTimer.current = null
        }
        rootRectRef.current = rootRef.current?.getBoundingClientRect() || rootRect
        setBoardOpen(true)
        return
      }
      if (event.buttons === 0 && boardCloseTimer.current === null) {
        boardCloseTimer.current = window.setTimeout(() => {
          setBoardOpen(false)
          boardCloseTimer.current = null
        }, 260)
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      if (boardCloseTimer.current !== null) window.clearTimeout(boardCloseTimer.current)
    }
  }, [boardOpen])

  const { panning, panHandlers } = useJournalDragPan(viewportRef, Boolean(stampPlacementDraft))

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    const raw = event.dataTransfer.getData('application/x-oshinote-journal-resource')
    const payload = safeJsonParse<DragPayload | null>(raw, null, isDragPayload)
    if (!payload) return
    const rect = event.currentTarget.getBoundingClientRect()
    onDropResource(payload, { x: (event.clientX - rect.left) / zoom, y: (event.clientY - rect.top) / zoom })
  }

  function removeSelectedItem(itemId: string) {
    onRemoveItem(itemId)
    if (detailItemId === itemId) setDetailItemId(null)
  }

  return (
    <div ref={rootRef} className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <JournalWorkBoard
        boardRef={boardRef}
        open={boardOpen}
        items={stagedItems}
        notesById={notesById}
        illustrationsById={illustrationsById}
        journalImagesById={journalImagesById}
        onDragStartItem={onDragStartStaged}
        onRemoveItem={onRemoveItem}
        onImportFiles={onImportFiles}
        importing={importing}
      />
      <div
        ref={viewportRef}
        className={clsx('journal-canvas-viewport relative flex min-h-0 min-w-0 flex-1 items-start justify-center overflow-auto p-6', panning && 'cursor-grabbing')}
        {...panHandlers}
      >
      <div data-journal-canvas-ui="true" className="fixed right-6 top-24 z-[70] flex h-10 items-center gap-1 rounded-2xl border border-border-color bg-bg-card/90 p-1 shadow-sm backdrop-blur">
        <button type="button" onClick={() => onZoomChange(Math.max(0.45, zoom - 0.1))} className="rounded-xl p-2 text-text-muted hover:bg-bg-secondary hover:text-accent" title={t('journalEditor.zoomOut')}><Minus size={15} /></button>
        <span className="min-w-12 text-center text-xs font-semibold text-text-secondary">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => onZoomChange(Math.min(1.25, zoom + 0.1))} className="rounded-xl p-2 text-text-muted hover:bg-bg-secondary hover:text-accent" title={t('journalEditor.zoomIn')}><Plus size={15} /></button>
      </div>

      <div style={{ width: pageSize.width * zoom, height: pageSize.height * zoom }}>
        <div
          ref={pageRef}
          data-journal-draft-page="true"
          className="journal-paper-page relative cursor-grab overflow-hidden"
          style={{ width: pageSize.width, height: pageSize.height, transform: `scale(${zoom})`, transformOrigin: 'top left', ...getPageBackground(background) }}
          onClick={(event) => {
            if (event.currentTarget === event.target) {
              onSelectItem(null)
              setDetailItemId(null)
            }
          }}
          onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' }}
          onDrop={handleDrop}
        >
          {canvasItems.every((item) => item.itemType === 'material') && emptyTemplateSlots.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center text-sm text-text-muted">{t('journalCreate.dragHint')}</div>
          )}

          {emptyTemplateSlots.map((templateSlot) => {
            const Icon = templateSlot.kind === 'note' ? StickyNote : ImageIcon
            return (
              <div
                key={templateSlot.id}
                className="pointer-events-none absolute flex items-center justify-center rounded-xl border-2 border-dashed border-accent/45 bg-bg-primary/20 text-accent/65"
                style={{ left: templateSlot.layout.x, top: templateSlot.layout.y, width: templateSlot.layout.width, height: templateSlot.layout.height, transform: `rotate(${templateSlot.layout.rotation}deg)`, zIndex: Math.max(1, templateSlot.layout.zIndex - 10) }}
              >
                <span className="flex items-center gap-2 rounded-full bg-bg-card/70 px-3 py-1.5 text-xs font-semibold shadow-sm backdrop-blur-sm"><Icon size={15} />{templateSlot.kind === 'note' ? t('journalTemplates.slot.note') : t('journalTemplates.slot.image')}</span>
              </div>
            )
          })}

          {canvasItems.map((item) => (
            <CanvasItemFrame
              key={item.draftId}
              item={item}
              note={item.sourceId ? notesById.get(item.sourceId) : undefined}
              illustration={item.sourceId ? illustrationsById.get(item.sourceId) : undefined}
              journalImage={item.sourceId ? journalImagesById.get(item.sourceId) : undefined}
              selected={item.draftId === selectedItemId}
              orientation={orientation}
              zoom={zoom}
              pageRef={pageRef}
              onSelect={onSelectItem}
              onOpenDetail={(itemId) => { onSelectItem(itemId); setDetailItemId(itemId) }}
              onUpdateItem={onUpdateItem}
              onStageItem={onStageItem}
            />
          ))}

          <div className="pointer-events-none absolute inset-0">
            <StampOverlay stamp={stamp} />
            <StampPlacementLayer active={Boolean(stampPlacementDraft)} stamp={stampPlacementDraft} soundEnabled={stampSoundEnabled} onPlace={onStampPlace} onComplete={onStampPlacementComplete} onCancel={onStampPlacementCancel} />
          </div>
        </div>
      </div>

      {selectedItem && (
        <div data-journal-canvas-ui="true" className="fixed bottom-5 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-border-color bg-bg-card/95 p-1.5 shadow-xl backdrop-blur">
          <button className={toolButtonClass} type="button" onClick={() => resizeSelected(selectedItem, -18, -18, orientation, onUpdateItem)}><Minus size={15} /></button>
          <button className={toolButtonClass} type="button" onClick={() => resizeSelected(selectedItem, 18, 18, orientation, onUpdateItem)}><Plus size={15} /></button>
          <button className={toolButtonClass} type="button" onClick={() => rotateSelected(selectedItem, -5, orientation, onUpdateItem)}>-5</button>
          <button className={toolButtonClass} type="button" onClick={() => onUpdateItem(selectedItem.draftId, getItemLayout({ ...selectedItem, rotation: 0 }))}><RotateCcw size={15} /></button>
          <button className={toolButtonClass} type="button" onClick={() => rotateSelected(selectedItem, 5, orientation, onUpdateItem)}>+5</button>
          <button className={toolButtonClass} type="button" onClick={() => onBringForward(selectedItem.draftId)}><ArrowUp size={15} /></button>
          <button className={toolButtonClass} type="button" onClick={() => onStageItem(selectedItem.draftId)} title={t('journal.returnToBoard')}><Inbox size={15} /></button>
          {selectedItem.itemType === 'material' && (
            <label className="flex h-9 items-center gap-2 rounded-xl px-2 text-xs font-semibold text-text-muted">
              {t('journalCreate.glassStrength')}
              <input type="range" min={0} max={100} step={5} value={getMaterialGlassStrength(selectedItem)} onChange={(event) => updateMaterialGlassStrength(selectedItem, Number(event.target.value), onUpdateItem)} className="w-24 accent-[var(--color-accent)]" />
            </label>
          )}
          <button className={`${toolButtonClass} text-red-500`} type="button" onClick={() => removeSelectedItem(selectedItem.draftId)}><Trash2 size={15} /></button>
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
          onClose={() => setDetailItemId(null)}
        />
      )}
      </div>
    </div>
  )
}

function resizeSelected(item: JournalDraftItem, widthDelta: number, heightDelta: number, orientation: JournalPageOrientation, onUpdateItem: JournalDraftCanvasProps['onUpdateItem']) {
  onUpdateItem(item.draftId, clampLayout({ ...getItemLayout(item), width: item.width + widthDelta, height: item.height + heightDelta }, getDraftItemConstraints(item), orientation))
}

function rotateSelected(item: JournalDraftItem, delta: number, orientation: JournalPageOrientation, onUpdateItem: JournalDraftCanvasProps['onUpdateItem']) {
  onUpdateItem(item.draftId, clampLayout({ ...getItemLayout(item), rotation: item.rotation + delta }, getDraftItemConstraints(item), orientation))
}

function getMaterialGlassStrength(item: JournalDraftItem): number {
  return Math.min(100, Math.max(0, asNumber(parseStylePayload(item.stylePayload).glassStrength, 0)))
}

function updateMaterialGlassStrength(item: JournalDraftItem, glassStrength: number, onUpdateItem: JournalDraftCanvasProps['onUpdateItem']) {
  onUpdateItem(item.draftId, { ...getItemLayout(item), stylePayload: patchStylePayload(item.stylePayload, { glassStrength }) })
}

function isDragPayload(value: unknown): value is DragPayload {
  if (!isRecord(value) || typeof value.id !== 'string') return false
  return value.kind === 'note' || value.kind === 'illustration' || value.kind === 'material'
}

const toolButtonClass = 'flex h-9 min-w-9 items-center justify-center rounded-xl px-2 text-xs font-semibold text-text-muted transition-colors hover:bg-bg-secondary hover:text-accent'
