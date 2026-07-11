import type { JournalDraftItem, JournalPageOrientation } from '../../../types'
import { clampLayout, type JournalLayoutInput } from '../../../features/journal/journalLayout'

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
export type FrameDragMode = 'move' | 'resize' | 'rotate'

export interface FrameDragState {
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

export const RESIZE_HANDLES: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

export function getDraggedLayout(
  drag: FrameDragState,
  pointer: { clientX: number; clientY: number },
  zoom: number,
  orientation: JournalPageOrientation,
  constraints: Parameters<typeof clampLayout>[1],
  pageRect: { left: number; top: number } | null
) {
  const dx = (pointer.clientX - drag.startClientX) / zoom
  const dy = (pointer.clientY - drag.startClientY) / zoom
  if (drag.mode === 'move') {
    return clampLayout({ ...drag.startLayout, x: drag.startLayout.x + dx, y: drag.startLayout.y + dy }, constraints, orientation)
  }
  if (drag.mode === 'rotate' && drag.center && pageRect) {
    const center = { x: pageRect.left + drag.center.x * zoom, y: pageRect.top + drag.center.y * zoom }
    const nextAngle = angleFromCenter(pointer.clientX, pointer.clientY, center)
    const delta = nextAngle - (drag.startAngle || 0)
    return clampLayout({ ...drag.startLayout, rotation: drag.startLayout.rotation + delta }, constraints, orientation)
  }
  return clampLayout(resizeLayout(drag.startLayout, drag.handle || 'se', dx, dy), constraints, orientation)
}

export function resizeLayout(layout: JournalLayoutInput & { zIndex?: number }, handle: ResizeHandle, dx: number, dy: number): JournalLayoutInput {
  let { x, y, width, height } = layout
  const { rotation } = layout
  if (handle.includes('e')) width += dx
  if (handle.includes('s')) height += dy
  if (handle.includes('w')) { x += dx; width -= dx }
  if (handle.includes('n')) { y += dy; height -= dy }
  return { x, y, width, height, rotation }
}

export function getItemCenter(item: JournalDraftItem) {
  return { x: item.x + item.width / 2, y: item.y + item.height / 2 }
}

export function angleFromCenter(clientX: number, clientY: number, center: { x: number; y: number }) {
  return Math.atan2(clientY - center.y, clientX - center.x) * 180 / Math.PI + 90
}

export function getHandleClass(handle: ResizeHandle) {
  if (handle === 'nw') return '-left-1.5 -top-1.5 cursor-nwse-resize'
  if (handle === 'n') return 'left-1/2 -top-1.5 -translate-x-1/2 cursor-ns-resize'
  if (handle === 'ne') return '-right-1.5 -top-1.5 cursor-nesw-resize'
  if (handle === 'e') return '-right-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize'
  if (handle === 'se') return '-bottom-1.5 -right-1.5 cursor-nwse-resize'
  if (handle === 's') return '-bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize'
  if (handle === 'sw') return '-bottom-1.5 -left-1.5 cursor-nesw-resize'
  return '-left-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize'
}

export function getItemLayout(item: JournalDraftItem): JournalLayoutInput {
  return {
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    rotation: item.rotation,
  }
}
