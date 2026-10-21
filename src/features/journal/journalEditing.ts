import type { JournalDraftItem, JournalPageOrientation } from '../../types'
import { getJournalPageSize, JOURNAL_PAGE } from './journalLayout'
import { parseStylePayload } from './journalItemStyles'
import { getDraftItemConstraints } from './journalItemSizing'
import { getJournalMaterialDefinition } from './journalMaterials'

export function isItemLocked(item: JournalDraftItem): boolean { return parseStylePayload(item.stylePayload).locked === true }
export function isAspectLocked(item: JournalDraftItem): boolean {
  const setting = parseStylePayload(item.stylePayload).aspectLocked
  return typeof setting === 'boolean' ? setting : item.itemType === 'image' || item.itemType === 'illustration' || getJournalMaterialDefinition(item.materialId)?.kind === 'sticker'
}

export function getDraftSizeLimits(item: JournalDraftItem, orientation: JournalPageOrientation) {
  const page = getJournalPageSize(orientation)
  const constraints = getDraftItemConstraints(item)
  let minWidth = constraints?.minWidth ?? 180, minHeight = constraints?.minHeight ?? 130
  let maxWidth = page.width - JOURNAL_PAGE.padding, maxHeight = page.height - JOURNAL_PAGE.padding
  if (isAspectLocked(item)) {
    const ratio = item.width / item.height
    maxWidth = Math.min(maxWidth, maxHeight * ratio)
    maxHeight = maxWidth / ratio
    minWidth = Math.min(maxWidth, Math.max(minWidth, minHeight * ratio))
    minHeight = minWidth / ratio
  }
  return { minWidth, minHeight, maxWidth, maxHeight }
}

/** Property edits preserve the position; only a move changes the position. */
export function resizeDraftItem(item: JournalDraftItem, size: { width?: number; height?: number }, orientation: JournalPageOrientation): JournalDraftItem {
  const page = getJournalPageSize(orientation)
  const limits = getDraftItemConstraints(item)
  const minW = limits?.minWidth ?? 180, minH = limits?.minHeight ?? 130
  const maxW = page.width - JOURNAL_PAGE.padding, maxH = page.height - JOURNAL_PAGE.padding
  let width = size.width ?? item.width, height = size.height ?? item.height
  if (isAspectLocked(item)) {
    const ratio = item.width / item.height
    const scale = size.width !== undefined ? width / item.width : height / item.height
    const minScale = Math.max(minW / item.width, minH / item.height)
    const maxScale = Math.min(maxW / item.width, maxH / item.height)
    const bounded = Math.min(maxScale, Math.max(Math.min(minScale, maxScale), scale))
    height = item.height * bounded
    width = height * ratio
  } else {
    width = Math.max(minW, Math.min(maxW, width))
    height = Math.max(minH, Math.min(maxH, height))
  }
  return { ...item, width, height }
}

export type ArrangeAction = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'horizontal' | 'vertical' | 'width'
export function arrangeDraftItems(items: JournalDraftItem[], action: ArrangeAction, orientation: JournalPageOrientation): JournalDraftItem[] {
  const selected = items.filter(item => !isItemLocked(item))
  if (selected.length < 2) return items
  const left = Math.min(...selected.map(i => i.x)), right = Math.max(...selected.map(i => i.x + i.width))
  const top = Math.min(...selected.map(i => i.y)), bottom = Math.max(...selected.map(i => i.y + i.height))
  const updated = new Map<string, JournalDraftItem>()
  if (action === 'horizontal' || action === 'vertical') {
    if (selected.length < 3) return items
    const horizontal = action === 'horizontal'
    const sorted = [...selected].sort((a, b) => horizontal ? a.x - b.x : a.y - b.y)
    const total = sorted.reduce((sum, item) => sum + (horizontal ? item.width : item.height), 0)
    const gap = ((horizontal ? right - left : bottom - top) - total) / (sorted.length - 1)
    let cursor = horizontal ? left : top
    for (const item of sorted) { updated.set(item.draftId, { ...item, [horizontal ? 'x' : 'y']: cursor }); cursor += (horizontal ? item.width : item.height) + gap }
  } else for (const item of selected) {
    let next = { ...item }
    if (action === 'width') next = resizeDraftItem(item, { width: selected[0].width }, orientation)
    if (action === 'left') next.x = left
    if (action === 'center') next.x = (left + right - item.width) / 2
    if (action === 'right') next.x = right - item.width
    if (action === 'top') next.y = top
    if (action === 'middle') next.y = (top + bottom - item.height) / 2
    if (action === 'bottom') next.y = bottom - item.height
    updated.set(item.draftId, next)
  }
  return items.map(item => updated.get(item.draftId) || item)
}

export type LayerAction = 'up' | 'down' | 'top' | 'bottom'

export function reorderDraftLayer(items: JournalDraftItem[], id: string, action: LayerAction): JournalDraftItem[] {
  const ordered = items.filter((item) => !item.staged).sort((a, b) => a.zIndex - b.zIndex)
  const index = ordered.findIndex((item) => item.draftId === id)
  if (index < 0) return items
  const target = action === 'top' ? ordered.length - 1 : action === 'bottom' ? 0 : Math.max(0, Math.min(ordered.length - 1, index + (action === 'up' ? 1 : -1)))
  const [item] = ordered.splice(index, 1)
  ordered.splice(target, 0, item)
  const ranks = new Map(ordered.map((entry, rank) => [entry.draftId, rank + 1]))
  return items.map((entry) => ranks.has(entry.draftId) ? { ...entry, zIndex: ranks.get(entry.draftId)! } : entry)
}

// Clamp one shared delta, rather than each item separately, so spacing survives
// a drag against any page edge. Include rotation in the group's visible bounds.
export function moveDraftGroup(items: JournalDraftItem[], dx: number, dy: number, orientation: JournalPageOrientation): JournalDraftItem[] {
  if (!items.length) return []
  const page = getJournalPageSize(orientation)
  const bounds = items.map((item) => {
    const angle = item.rotation * Math.PI / 180
    const halfWidth = (Math.abs(Math.cos(angle)) * item.width + Math.abs(Math.sin(angle)) * item.height) / 2
    const halfHeight = (Math.abs(Math.sin(angle)) * item.width + Math.abs(Math.cos(angle)) * item.height) / 2
    return { left: item.x + item.width / 2 - halfWidth, right: item.x + item.width / 2 + halfWidth, top: item.y + item.height / 2 - halfHeight, bottom: item.y + item.height / 2 + halfHeight }
  })
  const padding = JOURNAL_PAGE.padding / 2
  const minX = Math.min(0, padding - Math.min(...bounds.map((b) => b.left)))
  const maxX = Math.max(0, page.width - padding - Math.max(...bounds.map((b) => b.right)))
  const minY = Math.min(0, padding - Math.min(...bounds.map((b) => b.top)))
  const maxY = Math.max(0, page.height - padding - Math.max(...bounds.map((b) => b.bottom)))
  const x = Math.max(minX, Math.min(maxX, dx))
  const y = Math.max(minY, Math.min(maxY, dy))
  return items.map((item) => ({ ...item, x: item.x + x, y: item.y + y }))
}
