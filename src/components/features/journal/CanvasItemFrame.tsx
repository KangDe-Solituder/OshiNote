import { parseStylePayload, patchStylePayload } from '../../../features/journal/journalItemStyles'
import { readRegion } from '../../../features/journal/journalRegions'
import { isRecord } from '../../../utils/safeJson'
import { useI18n } from '../../../i18n/useI18n'
import { isItemLocked, isAspectLocked } from '../../../features/journal/journalEditing'
import clsx from 'clsx'
import { useRef, useState, type PointerEvent, type RefObject } from 'react'
import type { Illustration, JournalDraftItem, JournalImage, JournalPageOrientation, Note } from '../../../types'
import type { JournalLayoutInput } from '../../../features/journal/journalLayout'
import { getJournalMaterialDefinition } from '../../../features/journal/journalMaterials'
import { getDraftItemConstraints } from '../../../features/journal/journalItemSizing'
import { JournalDraftItemRenderer } from './JournalDraftItemRenderer'
import {
  RESIZE_HANDLES,
  angleFromCenter,
  getDraggedLayout,
  getHandleClass,
  getResizeCursor,
  getItemCenter,
  getItemLayout,
  type FrameDragMode,
  type FrameDragState,
  type ResizeHandle,
} from './journalDraftCanvasGeometry'

export interface CanvasItemFrameProps {
  item: JournalDraftItem
  note?: Note
  illustration?: Illustration
  journalImage?: JournalImage
  selected: boolean
  orientation: JournalPageOrientation
  zoom: number
  pageRef: RefObject<HTMLDivElement | null>
  showHandles?: boolean
  onGroupMoveStart?: (id: string) => boolean
  onGroupMove?: (dx: number, dy: number, commit: boolean, cancel?: boolean) => void
  onSelect: (itemId: string, additive?: boolean) => void
  onOpenDetail: (itemId: string) => void
  onUpdateItem: (itemId: string, layout: JournalLayoutInput & { zIndex?: number; stylePayload?: string }) => void
  onStageItem?: (itemId: string) => void
}

export function CanvasItemFrame({ item, note, illustration, journalImage, selected, showHandles = true, onGroupMoveStart, onGroupMove, orientation, zoom, pageRef, onSelect, onOpenDetail, onUpdateItem, onStageItem }: CanvasItemFrameProps) {
  const { t } = useI18n()
  const [textEdit, setTextEdit] = useState<{ title: string; body: string } | null>(null)
  function beginTextEdit() {
    if (isItemLocked(item) || readRegion(item.stylePayload) || !(item.itemType === 'note' || getJournalMaterialDefinition(item.materialId)?.kind === 'paper')) return
    const raw = parseStylePayload(item.stylePayload).noteCard
    const card = isRecord(raw) ? raw : {}
    setTextEdit({ title: typeof card.titleText === 'string' ? card.titleText : note?.title || '', body: typeof card.bodyText === 'string' ? card.bodyText : note?.plain_text || '' })
  }
  function saveText() {
    if (!textEdit) return
    const raw = parseStylePayload(item.stylePayload).noteCard
    onUpdateItem(item.draftId, { ...getItemLayout(item), stylePayload: patchStylePayload(item.stylePayload, { noteCard: { ...(isRecord(raw) ? raw : {}), titleText: textEdit.title, bodyText: textEdit.body } }) })
    setTextEdit(null)
  }
  const movingGroup = useRef(false)
  const dragRef = useRef<FrameDragState | null>(null)
  const material = item.itemType === 'material' ? getJournalMaterialDefinition(item.materialId) : null
  const constraints = getDraftItemConstraints(item)

  function startDrag(event: PointerEvent<HTMLDivElement>, mode: FrameDragMode, handle?: ResizeHandle) {
    if (event.button !== 0 || textEdit) return
    event.preventDefault()
    event.stopPropagation()
    if (mode === 'move' && (event.ctrlKey || event.metaKey)) {
      onSelect(item.draftId, true)
      return
    }
    onSelect(item.draftId)
    if (isItemLocked(item)) return
    movingGroup.current = mode === 'move' && Boolean(onGroupMoveStart?.(item.draftId))
    const center = getItemCenter(item)
    let startAngle = 0
    if (mode === 'rotate') {
      const rect = pageRef.current?.getBoundingClientRect()
      if (rect) startAngle = angleFromCenter(event.clientX, event.clientY, { x: rect.left + center.x * zoom, y: rect.top + center.y * zoom })
    }
    // Capture on the frame even when a child resize/rotation handle is pressed.
    const frame = event.currentTarget.closest<HTMLDivElement>('[data-journal-item-frame="true"]')!
    frame.setPointerCapture(event.pointerId)
    frame.style.cursor = mode === 'resize' ? getResizeCursor(handle || 'se', item.rotation) : mode === 'rotate' ? 'grabbing' : 'move'
    dragRef.current = {
      pointerId: event.pointerId,
      mode,
      handle,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startLayout: getItemLayout(item),
      moved: false,
      aspectLocked: isAspectLocked(item),
      startAngle,
      center,
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (movingGroup.current) {
      drag.moved = drag.moved || Math.abs(event.clientX - drag.startClientX) + Math.abs(event.clientY - drag.startClientY) > 2
      onGroupMove?.((event.clientX - drag.startClientX) / zoom, (event.clientY - drag.startClientY) / zoom, false)
      return
    }
    const rect = pageRef.current?.getBoundingClientRect() || null
    const layout = getDraggedLayout(drag, event, zoom, orientation, constraints, rect)
    if (Math.abs(event.clientX - drag.startClientX) + Math.abs(event.clientY - drag.startClientY) > 2) drag.moved = true
    event.currentTarget.style.left = `${layout.x}px`
    event.currentTarget.style.top = `${layout.y}px`
    event.currentTarget.style.width = `${layout.width}px`
    event.currentTarget.style.height = `${layout.height}px`
    event.currentTarget.style.transform = `rotate(${layout.rotation}deg) translateZ(0)`
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    event.currentTarget.style.cursor = ''
    event.currentTarget.releasePointerCapture(event.pointerId)
    if (movingGroup.current) {
      movingGroup.current = false
      onGroupMove?.((event.clientX - drag.startClientX) / zoom, (event.clientY - drag.startClientY) / zoom, drag.moved, !drag.moved)
      return
    }
    if (!drag.moved) return
    if (onStageItem && document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-journal-workboard="true"]')) {
      onStageItem(item.draftId)
      return
    }
    const rect = pageRef.current?.getBoundingClientRect() || null
    onUpdateItem(item.draftId, getDraggedLayout(drag, event, zoom, orientation, constraints, rect))
  }

  return (
    <div
      data-journal-item-frame="true"
      data-draft-id={item.draftId}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={event => { event.stopPropagation(); beginTextEdit() }}
      onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); onOpenDetail(item.draftId) }}
      onPointerDown={(event) => startDrag(event, 'move')}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={(event) => {
        if (movingGroup.current) onGroupMove?.(0, 0, false, true)
        else if (dragRef.current) {
          const layout = dragRef.current.startLayout
          Object.assign(event.currentTarget.style, { left: `${layout.x}px`, top: `${layout.y}px`, width: `${layout.width}px`, height: `${layout.height}px`, transform: `rotate(${layout.rotation}deg) translateZ(0)` })
        }
        movingGroup.current = false
        dragRef.current = null
        event.currentTarget.style.cursor = ''
      }}
      className={clsx('absolute cursor-default touch-none text-left focus:outline-none', selected && 'outline outline-2 outline-accent/90', selected && material?.kind !== 'tape' && 'shadow-[0_10px_26px_rgba(45,108,223,0.12)]')}
      style={{ left: item.x, top: item.y, width: item.width, height: item.height, zIndex: textEdit ? 100000 : item.zIndex, transform: `rotate(${item.rotation}deg) translateZ(0)` }}
    >
      <JournalDraftItemRenderer item={item} note={note} illustration={illustration} journalImage={journalImage} editing />
      {textEdit && <div data-journal-canvas-ui="true" className="absolute inset-0 z-30 flex min-h-28 flex-col gap-1 rounded-lg border-2 border-accent bg-bg-card p-2 shadow-xl" onPointerDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) saveText() }} onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); setTextEdit(null) } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); saveText() } }}>
        <input autoFocus aria-label={t('journalCreate.detail.paperTitle')} value={textEdit.title} onChange={event => setTextEdit({ ...textEdit, title: event.target.value })} className="min-w-0 rounded bg-bg-primary p-1 text-sm text-text-primary" />
        <textarea aria-label={t('journalCreate.detail.paperBody')} value={textEdit.body} onChange={event => setTextEdit({ ...textEdit, body: event.target.value })} className="min-h-8 flex-1 resize-none rounded bg-bg-primary p-1 text-sm text-text-primary" />
        <div className="flex justify-end gap-3 text-xs text-accent"><button onClick={() => setTextEdit(null)}>{t('common.cancel')}</button><button onClick={saveText}>{t('journalEditor.setup.save')}</button></div>
      </div>}
      {selected && showHandles && !textEdit && !isItemLocked(item) && (
        <>
          {RESIZE_HANDLES.map((handle) => (
            <button
              key={handle}
              type="button"
              className={clsx('absolute z-20 h-3 w-3 rounded-full border border-accent bg-bg-primary shadow-sm', getHandleClass(handle, item.rotation))}
              style={{ cursor: getResizeCursor(handle, item.rotation) }}
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
