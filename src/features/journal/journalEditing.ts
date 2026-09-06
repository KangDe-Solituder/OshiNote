import type { JournalDraftItem, JournalPageOrientation } from '../../types'
import { getJournalPageSize, JOURNAL_PAGE } from './journalLayout'

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
