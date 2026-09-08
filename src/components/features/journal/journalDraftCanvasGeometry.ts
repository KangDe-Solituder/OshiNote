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
  return resizeLayout(drag.startLayout, drag.handle || 'se', dx, dy, (size) => clampLayout(size, constraints, orientation))
}

export function resizeLayout(layout: JournalLayoutInput & { zIndex?: number }, handle: ResizeHandle, dx: number, dy: number, constrainSize?: (layout: JournalLayoutInput) => JournalLayoutInput): JournalLayoutInput {
  let { width, height } = layout
  const { rotation } = layout
  const radians = rotation * Math.PI / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const localX = cos * dx + sin * dy
  const localY = -sin * dx + cos * dy
  const horizontal = handle.includes('e') ? 1 : handle.includes('w') ? -1 : 0
  const vertical = handle.includes('s') ? 1 : handle.includes('n') ? -1 : 0
  if (horizontal) width += horizontal * localX
  if (vertical) height += vertical * localY
  const constrained = constrainSize?.({ ...layout, width, height })
  if (horizontal) width = constrained?.width ?? width
  if (vertical) height = constrained?.height ?? height
  // CSS rotates about the changing center. Move that center by half the actual
  // local size change so the opposite edge/corner stays fixed in page space.
  // Do not clamp x/y afterwards: doing so translates the supposedly fixed edge.
  const shiftX = horizontal * (width - layout.width) / 2
  const shiftY = vertical * (height - layout.height) / 2
  const x = layout.x + (layout.width - width) / 2 + cos * shiftX - sin * shiftY
  const y = layout.y + (layout.height - height) / 2 + sin * shiftX + cos * shiftY
  return { x, y, width, height, rotation }
}

export function getItemCenter(item: JournalDraftItem) {
  return { x: item.x + item.width / 2, y: item.y + item.height / 2 }
}

export function angleFromCenter(clientX: number, clientY: number, center: { x: number; y: number }) {
  return Math.atan2(clientY - center.y, clientX - center.x) * 180 / Math.PI + 90
}

// Screen-space drag direction of each handle, in degrees clockwise from east.
const HANDLE_ANGLES: Record<ResizeHandle, number> = { e: 0, se: 45, s: 90, sw: 135, w: 180, nw: 225, n: 270, ne: 315 }

const DIRECTION_CURSORS: Record<number, string> = {
  0: 'cursor-ew-resize',
  45: 'cursor-nwse-resize',
  90: 'cursor-ns-resize',
  135: 'cursor-nesw-resize',
  180: 'cursor-ew-resize',
  225: 'cursor-nwse-resize',
  270: 'cursor-ns-resize',
  315: 'cursor-nesw-resize',
}

/** Cursor keywords are not affected by CSS transforms, so the resize cursor must be rotated in software to stay aligned with the edge normal. */
export function getResizeCursorClass(handle: ResizeHandle, rotation: number): string {
  const angle = (((HANDLE_ANGLES[handle] + rotation) % 360) + 360) % 360
  const quantized = (Math.round(angle / 45) * 45) % 360
  return DIRECTION_CURSORS[quantized]
}

/** SVG cursor arrows follow the exact angle, unlike the eight native directions. */
export function getResizeCursor(handle: ResizeHandle, rotation: number): string {
  const angle = ((HANDLE_ANGLES[handle] + rotation) % 360 + 360) % 360
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g transform="rotate(${angle} 16 16)" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M5 16h22M10 11l-5 5 5 5M22 11l5 5-5 5" stroke="white" stroke-width="4"/><path d="M5 16h22M10 11l-5 5 5 5M22 11l5 5-5 5" stroke="#222" stroke-width="2"/></g></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 16 16, ${getResizeCursorClass(handle, rotation).replace('cursor-', '')}`
}

export function getHandleClass(handle: ResizeHandle, rotation = 0) {
  const cursor = getResizeCursorClass(handle, rotation)
  if (handle === 'nw') return `-left-1.5 -top-1.5 ${cursor}`
  if (handle === 'n') return `left-1/2 -top-1.5 -translate-x-1/2 ${cursor}`
  if (handle === 'ne') return `-right-1.5 -top-1.5 ${cursor}`
  if (handle === 'e') return `-right-1.5 top-1/2 -translate-y-1/2 ${cursor}`
  if (handle === 'se') return `-bottom-1.5 -right-1.5 ${cursor}`
  if (handle === 's') return `-bottom-1.5 left-1/2 -translate-x-1/2 ${cursor}`
  if (handle === 'sw') return `-bottom-1.5 -left-1.5 ${cursor}`
  return `-left-1.5 top-1/2 -translate-y-1/2 ${cursor}`
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
