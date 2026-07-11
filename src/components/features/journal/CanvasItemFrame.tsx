import clsx from 'clsx'
import { useRef, type PointerEvent, type RefObject } from 'react'
import type { Illustration, JournalDraftItem, JournalPageOrientation, Note } from '../../../types'
import type { JournalLayoutInput } from '../../../features/journal/journalLayout'
import { getJournalMaterialDefinition } from '../../../features/journal/journalMaterials'
import { getDraftItemConstraints } from '../../../features/journal/journalItemSizing'
import { JournalDraftItemRenderer } from './JournalDraftItemRenderer'
import {
  RESIZE_HANDLES,
  angleFromCenter,
  getDraggedLayout,
  getHandleClass,
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
  selected: boolean
  orientation: JournalPageOrientation
  zoom: number
  pageRef: RefObject<HTMLDivElement | null>
  onSelect: (itemId: string) => void
  onOpenDetail: (itemId: string) => void
  onUpdateItem: (itemId: string, layout: JournalLayoutInput & { zIndex?: number; stylePayload?: string }) => void
}

export function CanvasItemFrame({ item, note, illustration, selected, orientation, zoom, pageRef, onSelect, onOpenDetail, onUpdateItem }: CanvasItemFrameProps) {
  const dragRef = useRef<FrameDragState | null>(null)
  const material = item.itemType === 'material' ? getJournalMaterialDefinition(item.materialId) : null
  const constraints = getDraftItemConstraints(item)

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
    const rect = pageRef.current?.getBoundingClientRect() || null
    const layout = getDraggedLayout(drag, event, zoom, orientation, constraints, rect)
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
    const rect = pageRef.current?.getBoundingClientRect() || null
    onUpdateItem(item.draftId, getDraggedLayout(drag, event, zoom, orientation, constraints, rect))
  }

  return (
    <div
      onClick={(event) => { event.stopPropagation(); onSelect(item.draftId) }}
      onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); onOpenDetail(item.draftId) }}
      onPointerDown={(event) => startDrag(event, 'move')}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { dragRef.current = null }}
      className={clsx('absolute touch-none text-left focus:outline-none', selected && 'outline outline-2 outline-accent/90', selected && material?.kind !== 'tape' && 'shadow-[0_10px_26px_rgba(45,108,223,0.12)]')}
      style={{ left: item.x, top: item.y, width: item.width, height: item.height, zIndex: item.zIndex, transform: `rotate(${item.rotation}deg)` }}
    >
      <JournalDraftItemRenderer item={item} note={note} illustration={illustration} />
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
