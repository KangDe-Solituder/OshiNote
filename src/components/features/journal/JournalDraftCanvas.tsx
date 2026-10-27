import { JournalRegionPockets } from './JournalRegionPockets'
import { moveDraftGroup, isItemLocked, resizeDraftItem, arrangeDraftItems, type ArrangeAction, type LayerAction } from '../../../features/journal/journalEditing'
import { ImageIcon, Inbox, Minus, Plus, RotateCcw, StickyNote, Trash2, SlidersHorizontal, Scan, Lock, Unlock } from 'lucide-react'
import clsx from 'clsx'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import type { Illustration, JournalDraftItem, JournalImage, JournalPageOrientation, Note, StampInput } from '../../../types'
import { getJournalPageSize, type JournalLayoutInput } from '../../../features/journal/journalLayout'
import { getMaterializedTemplateSlots } from '../../../features/journal/journalPageTemplates'
import { patchStylePayload } from '../../../features/journal/journalItemStyles'
import { safeJsonParse, isRecord } from '../../../utils/safeJson'
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
  busy?: boolean
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
  onUpdateItems: (items: JournalDraftItem[]) => void
  onRemoveItems: (ids: string[]) => void
  onStageItems: (ids: string[]) => void
  onFinalizeRegion: (itemId: string) => void
  onRemoveItem: (itemId: string) => void
  onChangeLayer: (itemId: string, action: LayerAction) => void
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
  | { kind: 'region'; id: string }
  | { kind: 'note'; id: string }
  | { kind: 'illustration'; id: string }
  | { kind: 'material'; id: string }
  | { kind: 'journal-image'; id: string }
  | { kind: 'staged'; id: string }

export function JournalDraftCanvas({
  busy = false,
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
  onUpdateItems,
  onRemoveItems,
  onStageItems,
  onRemoveItem,
  onFinalizeRegion,
  onChangeLayer,
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
  const previousZoom = useRef(zoom)
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    let width = viewport.clientWidth, height = viewport.clientHeight, remainderX = 0, remainderY = 0
    const observer = new ResizeObserver(() => {
      const nextWidth = viewport.clientWidth, nextHeight = viewport.clientHeight
      const x = viewport.scrollLeft + (width - nextWidth) / 2 + remainderX
      const y = viewport.scrollTop + (height - nextHeight) / 2 + remainderY
      viewport.scrollLeft = x; viewport.scrollTop = y
      remainderX = x - viewport.scrollLeft; remainderY = y - viewport.scrollTop
      width = nextWidth; height = nextHeight
    })
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [viewportRef])
  function centerPage() {
    const viewport = viewportRef.current
    if (viewport) { viewport.scrollLeft = 600 + pageSize.width * zoom / 2 - viewport.clientWidth / 2; viewport.scrollTop = 600 + pageSize.height * zoom / 2 - viewport.clientHeight / 2 }
  }
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const oldZoom = previousZoom.current
    viewport.scrollLeft = 600 + (viewport.scrollLeft + viewport.clientWidth / 2 - 600) * zoom / oldZoom - viewport.clientWidth / 2
    viewport.scrollTop = 600 + (viewport.scrollTop + viewport.clientHeight / 2 - 600) * zoom / oldZoom - viewport.clientHeight / 2
    previousZoom.current = zoom
  }, [zoom, viewportRef])
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    viewport.scrollLeft = 600 + pageSize.width * previousZoom.current / 2 - viewport.clientWidth / 2
    viewport.scrollTop = 600 + pageSize.height * previousZoom.current / 2 - viewport.clientHeight / 2
  }, [orientation, pageSize.width, pageSize.height, viewportRef])
  const pageRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const canvasItems = useMemo(() => items.filter((item) => !item.staged), [items])
  const stagedItems = useMemo(() => items.filter((item) => item.staged), [items])
  const [selection, setSelection] = useState<string[]>([])
  const selectedIds = selectedItemId ? (selection.includes(selectedItemId) ? selection : [selectedItemId]).filter(id => canvasItems.some(item => item.draftId === id)) : []
  const groupDrag = useRef<JournalDraftItem[]>([])
  function selectItem(id: string, additive = false) {
    const next = additive
      ? selectedIds.includes(id) ? selectedIds.filter((selected) => selected !== id) : [...selectedIds, id]
      : selectedIds.includes(id) ? selectedIds : [id]
    setSelection(next)
    onSelectItem(next.includes(id) ? id : next.at(-1) || null)
  }
  function startGroupMove(id: string) {
    groupDrag.current = selectedIds.includes(id) ? canvasItems.filter((item) => selectedIds.includes(item.draftId) && !isItemLocked(item)) : []
    return groupDrag.current.length > 1
  }
  function moveGroup(dx: number, dy: number, commit: boolean, cancel = false) {
    const moved = cancel ? groupDrag.current : moveDraftGroup(groupDrag.current, dx, dy, orientation)
    for (const item of moved) {
      const frame = Array.from(pageRef.current?.querySelectorAll<HTMLElement>('[data-draft-id]') || []).find((node) => node.dataset.draftId === item.draftId)
      if (frame) { frame.style.left = `${item.x}px`; frame.style.top = `${item.y}px` }
    }
    if (commit) onUpdateItems(moved)
    if (commit || cancel) groupDrag.current = []
  }
  const layerItems = [...canvasItems].sort((a, b) => a.zIndex - b.zIndex)
  const layerOf = (id: string) => layerItems.findIndex((item) => item.draftId === id) + 1
  const selectedItem = canvasItems.find((item) => item.draftId === selectedItemId) || null
  const detailItem = inspectorOpen && selectedIds.length === 1 ? selectedItem : null
  const editableSelection = selectedIds.map(id => canvasItems.find(item => item.draftId === id)).filter((item): item is JournalDraftItem => !!item && !isItemLocked(item))
  const filledTemplateSlotIds = new Set(canvasItems.map((item) => item.templateSlotId).filter(Boolean))
  const emptyTemplateSlots = getMaterializedTemplateSlots(templateId, orientation).filter((templateSlot) => !filledTemplateSlotIds.has(templateSlot.id))

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (busy) return
      if (window.document.querySelector('[role="dialog"]')) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return
      if (event.key === 'Escape') { setSelection([]); onSelectItem(null) }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedItemId) { event.preventDefault(); onRemoveItems(editableSelection.map(item => item.draftId)) }
      const delta = event.shiftKey ? 10 : 1
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) && editableSelection.length && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        onUpdateItems(moveDraftGroup(editableSelection, event.key === 'ArrowLeft' ? -delta : event.key === 'ArrowRight' ? delta : 0, event.key === 'ArrowUp' ? -delta : event.key === 'ArrowDown' ? delta : 0, orientation))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [busy, selectedItemId, editableSelection, orientation, onRemoveItems, onSelectItem, onUpdateItems])

  function fitHeight(item: JournalDraftItem) {
    const frame = Array.from(pageRef.current?.querySelectorAll<HTMLElement>('[data-draft-id]') || []).find(node => node.dataset.draftId === item.draftId)
    const content = frame?.firstElementChild?.cloneNode(true) as HTMLElement | undefined
    if (!content) return
    Object.assign(content.style, { position: 'fixed', left: '-10000px', top: '0', width: item.width + 'px', height: 'auto', visibility: 'hidden', overflow: 'visible' })
    content.querySelectorAll<HTMLElement>('.h-full').forEach(node => { node.style.height = 'auto' })
    content.querySelectorAll<HTMLElement>('p').forEach(node => { node.style.flex = 'none' })
    window.document.body.append(content)
    const height = Math.ceil(content.getBoundingClientRect().height) + 2
    content.remove()
    onUpdateItems([resizeDraftItem(item, { height }, orientation)])
  }
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
      const nearTop = withinCanvasX && dy >= 0 && dy <= 32 && !(event.target instanceof Element && event.target.closest('[data-journal-canvas-ui]'))

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
  }

  return (
    <div ref={rootRef} className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col">
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
        className={clsx('journal-canvas-viewport relative min-h-0 min-w-0 flex-1 overflow-auto', panning && 'cursor-grabbing')}
        {...panHandlers}
        onClick={(event) => {
          if (stampPlacementDraft) return
          const target = event.target as HTMLElement
          if (target.closest('[data-journal-item-frame], [data-journal-canvas-ui], [data-journal-detail-panel], button, a, input, textarea, select, aside, [role="dialog"]')) return
          setSelection([])
          onSelectItem(null)
        }}
      >
      <div data-journal-workspace="true" style={{ width: pageSize.width * zoom + 1200, height: pageSize.height * zoom + 1200, padding: 600 }}>
      <div style={{ width: pageSize.width * zoom, height: pageSize.height * zoom }}>
        <div
          ref={pageRef}
          data-journal-draft-page="true"
          className="journal-paper-page relative cursor-grab overflow-hidden"
          style={{ width: pageSize.width, height: pageSize.height, transform: `scale(${zoom})`, transformOrigin: 'top left', ...getPageBackground(background) }}
          onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' }}
          onDrop={handleDrop}
        >
          {canvasItems.length === 0 && emptyTemplateSlots.length === 0 && (
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
              selected={selectedIds.includes(item.draftId)}
              showHandles={selectedIds.length <= 1}
              onGroupMoveStart={startGroupMove}
              onGroupMove={moveGroup}
              orientation={orientation}
              zoom={zoom}
              pageRef={pageRef}
              onSelect={selectItem}
              onOpenDetail={(itemId) => { setSelection([itemId]); onSelectItem(itemId); setInspectorOpen(true) }}
              onUpdateItem={onUpdateItem}
              onStageItem={onStageItem}
            />
          ))}

          <JournalRegionPockets items={canvasItems} />
          <div className="pointer-events-none absolute inset-0" style={{ zIndex: Math.max(0, ...canvasItems.map((item) => item.zIndex)) + 1 }}>
            <StampOverlay stamp={stamp} />
            <StampPlacementLayer active={Boolean(stampPlacementDraft)} stamp={stampPlacementDraft} soundEnabled={stampSoundEnabled} onPlace={onStampPlace} onComplete={onStampPlacementComplete} onCancel={onStampPlacementCancel} />
          </div>
        </div>
      </div>

      </div>
      </div>
      <div data-journal-canvas-ui="true" className="absolute right-3 top-3 z-[70] flex h-10 items-center gap-1 rounded-2xl border border-border-color bg-bg-card/90 p-1 shadow-sm backdrop-blur">
        <button type="button" title={t('journalRegions.centerPage')} onClick={centerPage} className="rounded-xl p-2 text-text-muted"><Scan size={15} /></button>
        <button type="button" onClick={() => setInspectorOpen(value => !value)} title={t('journalEdit.properties')} className="rounded-xl p-2 text-accent"><SlidersHorizontal size={15} /></button>
        <button type="button" onClick={() => onZoomChange(Math.max(0.45, zoom - 0.1))} className="rounded-xl p-2 text-text-muted hover:bg-bg-secondary hover:text-accent" title={t('journalEditor.zoomOut')}><Minus size={15} /></button>
        <span className="min-w-12 text-center text-xs font-semibold text-text-secondary">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => onZoomChange(Math.min(1.25, zoom + 0.1))} className="rounded-xl p-2 text-text-muted hover:bg-bg-secondary hover:text-accent" title={t('journalEditor.zoomIn')}><Plus size={15} /></button>
      </div>

      {selectedItem && (
        <div data-journal-canvas-ui="true" className="absolute bottom-5 left-1/2 z-[80] flex max-w-[95%] flex-wrap justify-center -translate-x-1/2 items-center gap-2 rounded-2xl border border-border-color bg-bg-card/95 p-1.5 shadow-xl backdrop-blur">
          {selectedIds.length > 1 ? <>
<span className="px-2 text-xs text-text-secondary">{t('journal.selectedCount', { count: selectedIds.length })}</span>
<select value="" aria-label={t('journalEdit.arrange')} onChange={event => onUpdateItems(arrangeDraftItems(editableSelection, event.target.value as ArrangeAction, orientation))} className="max-w-40 rounded-lg bg-bg-secondary p-2 text-xs text-text-primary">
<option value="" disabled>{t('journalEdit.arrange')}</option>
{(['left', 'center', 'right', 'top', 'middle', 'bottom', 'horizontal', 'vertical', 'width'] as const).map(action => <option key={action} value={action} disabled={editableSelection.length < ((action === 'horizontal' || action === 'vertical') ? 3 : 2)}>{t(('journalEdit.' + action) as never)}</option>)}
</select></> : <fieldset disabled={isItemLocked(selectedItem)} className="flex items-center gap-1 disabled:opacity-40">
          <button className={toolButtonClass} type="button" onClick={() => resizeSelected(selectedItem, -18, -18, orientation, onUpdateItem)}><Minus size={15} /></button>
          <button className={toolButtonClass} type="button" onClick={() => resizeSelected(selectedItem, 18, 18, orientation, onUpdateItem)}><Plus size={15} /></button>
          <button className={toolButtonClass} type="button" onClick={() => rotateSelected(selectedItem, -5, onUpdateItem)}>-5</button>
          <button className={toolButtonClass} type="button" onClick={() => onUpdateItem(selectedItem.draftId, getItemLayout({ ...selectedItem, rotation: 0 }))}><RotateCcw size={15} /></button>
          <button className={toolButtonClass} type="button" onClick={() => rotateSelected(selectedItem, 5, onUpdateItem)}>+5</button>


          </fieldset>}
          <button className={toolButtonClass} type="button" title={t('journalEdit.lock')} onClick={() => onUpdateItems(canvasItems.filter(item => selectedIds.includes(item.draftId)).map(item => ({ ...item, stylePayload: patchStylePayload(item.stylePayload, { locked: !isItemLocked(selectedItem) }) })))}>{isItemLocked(selectedItem) ? <Unlock size={15} /> : <Lock size={15} />}</button>
          <button className={toolButtonClass} type="button" onClick={() => onStageItems(editableSelection.map(item => item.draftId))} title={t('journal.returnToBoard')}><Inbox size={15} /></button>
          <button className={`${toolButtonClass} text-red-500`} type="button" title={t('journalInspector.removeFromPage')} onClick={() => onRemoveItems(editableSelection.map(item => item.draftId))}><Trash2 size={15} /></button>
        </div>
      )}

      {detailItem && (
        <JournalItemDetailPanel
          key={detailItem.draftId}
          onFitHeight={() => fitHeight(detailItem)}
          onFinalizeRegion={onFinalizeRegion}
          item={detailItem}
          layer={layerOf(detailItem.draftId)}
          onChangeLayer={(action) => onChangeLayer(detailItem.draftId, action)}
          note={detailItem.sourceId ? notesById.get(detailItem.sourceId) : undefined}
          illustration={detailItem.sourceId ? illustrationsById.get(detailItem.sourceId) : undefined}
          orientation={orientation}
          onUpdateItem={onUpdateItem}
          onRemoveItem={removeSelectedItem}
          onClose={() => setInspectorOpen(false)}
        />
      )}
    </div>
  )
}

function resizeSelected(item: JournalDraftItem, widthDelta: number, heightDelta: number, orientation: JournalPageOrientation, onUpdateItem: JournalDraftCanvasProps['onUpdateItem']) {
  onUpdateItem(item.draftId, getItemLayout(resizeDraftItem(item, { width: item.width + widthDelta, height: item.height + heightDelta }, orientation)))
}

function rotateSelected(item: JournalDraftItem, delta: number, onUpdateItem: JournalDraftCanvasProps['onUpdateItem']) {
  onUpdateItem(item.draftId, { ...getItemLayout(item), rotation: item.rotation + delta })
}

function isDragPayload(value: unknown): value is DragPayload {
  if (!isRecord(value) || typeof value.id !== 'string') return false
  return ['note', 'illustration', 'material', 'journal-image', 'staged', 'region'].includes(String(value.kind))
}

const toolButtonClass = 'flex h-9 min-w-9 items-center justify-center rounded-xl px-2 text-xs font-semibold text-text-muted transition-colors hover:bg-bg-secondary hover:text-accent'
