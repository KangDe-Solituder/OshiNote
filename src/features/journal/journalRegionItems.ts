import type { JournalDraftItem } from '../../types'
import { isRecord } from '../../utils/safeJson'
import { parseStylePayload } from './journalItemStyles'
import { getJournalMaterialDefinition } from './journalMaterials'
import { layoutRegion, readRegion, writeRegion, REGION_CAPACITY, type JournalRegion, type RegionEntry } from './journalRegions'

export interface RegionPaper {
  entry: RegionEntry
  kind: JournalRegion['kind']
  style: JournalRegion['style']
  holes: JournalRegion['holes']
  backing: string
  lines: number
  limit: number
  index: number
}
export function readRegionPaper(item: JournalDraftItem): RegionPaper | null {
  const value = parseStylePayload(item.stylePayload).regionPaper
  return isRecord(value) && isRecord(value.entry) ? value as unknown as RegionPaper : null
}
export function memberOf(item: JournalDraftItem): string | undefined {
  const id = parseStylePayload(item.stylePayload).regionMember
  return typeof id === 'string' ? id : undefined
}
export function detachRegionItem(item: JournalDraftItem): JournalDraftItem {
  const style = { ...parseStylePayload(item.stylePayload) }
  delete style.regionMember
  return { ...item, stylePayload: JSON.stringify(style) }
}
export function paperEntry(item: JournalDraftItem): RegionEntry | null {
  const style = parseStylePayload(item.stylePayload), paper = readRegionPaper(item)
  if (!paper && !(item.itemType === 'material' && getJournalMaterialDefinition(item.materialId)?.kind === 'paper' && !readRegion(item.stylePayload))) return null
  const text = isRecord(style.noteCard) ? style.noteCard : {}
  return { ...(paper?.entry || { id: item.draftId, kind: 'note' as const, date: '' }), id: paper?.entry.id || item.draftId, title: typeof text.titleText === 'string' ? text.titleText : paper?.entry.title || '', text: typeof text.bodyText === 'string' ? text.bodyText : paper?.entry.text || '' }
}
const uid = () => crypto.randomUUID()
function createPaper(regionId: string, entry?: RegionEntry): JournalDraftItem {
  const id = uid()
  return { draftId: id, itemType: 'material', materialId: 'memo-cream', x: 0, y: 0, width: 200, height: 100, rotation: 0, zIndex: 1,
    stylePayload: JSON.stringify({ regionMember: regionId, regionPaper: { entry: entry || { id, kind: 'note', title: '', text: '', date: '' } }, noteCard: { titleText: entry?.title || '', bodyText: entry?.text || '' } }) }
}
function worldPosition(zone: JournalDraftItem, x: number, y: number, width: number, height: number) {
  const angle = zone.rotation * Math.PI / 180, dx = x + width / 2 - zone.width / 2, dy = y + height / 2 - zone.height / 2
  return { x: zone.x + zone.width / 2 + dx * Math.cos(angle) - dy * Math.sin(angle) - width / 2, y: zone.y + zone.height / 2 + dx * Math.sin(angle) + dy * Math.cos(angle) - height / 2 }
}
/** Layout is run on collection or an explicit rule change, never on a child's edit. */
export function arrangeRegionItems(items: JournalDraftItem[], zoneId: string): JournalDraftItem[] {
  const zone = items.find(item => item.draftId === zoneId), region = readRegion(zone?.stylePayload)
  if (!zone || !region?.id) return items
  let members = items.filter(item => memberOf(item) === region.id && !item.staged)
  if (region.kind === 'strips') {
    // Only empty generated rows may be removed when reducing the count.
    const filled = members.filter(item => { const e = paperEntry(item); return e && (e.title || e.text || e.path) })
    const blanks = members.filter(item => !filled.includes(item))
    members = [...filled, ...blanks.slice(0, Math.max(0, region.count - filled.length))]
    while (members.length < region.count) members.push(createPaper(region.id))
  }
  const entries = members.map(item => ({ ...(paperEntry(item) || { kind: 'note' as const, title: '', text: '', date: '' }), id: item.draftId, date: paperEntry(item)?.date || (region.sort === 'desc' ? '' : '9999') }))
  const cards = layoutRegion({ ...region, count: members.length || region.count, entries }, zone.width, zone.height)
  const baseZ = Math.max(zone.zIndex, ...items.filter(item => !memberOf(item) && parseStylePayload(item.stylePayload).regionSticker !== region.id).map(item => item.zIndex))
  const updated = members.map(item => {
    const card = cards.find(card => card.entry?.id === item.draftId)!
    if (parseStylePayload(item.stylePayload).locked === true) return item
    const entry = paperEntry(item)!, style = parseStylePayload(item.stylePayload)
    return { ...item, ...worldPosition(zone, card.x, card.y, card.width, card.height), width: card.width, height: card.height, rotation: zone.rotation + card.rotation, zIndex: baseZ + card.index + 1,
      stylePayload: JSON.stringify({ ...style, color: card.color, regionPaper: { entry, kind: region.kind, style: region.style, holes: region.kind === 'strips' ? region.holes : 'none', backing: region.color, lines: region.lines, limit: region.limit, index: card.index } satisfies RegionPaper }) }
  })
  const stickers: JournalDraftItem[] = []
  if (region.kind === 'strips' && region.stickers) for (const paper of updated) {
    const entry = paperEntry(paper)!, index = readRegionPaper(paper)!.index
    if ((!entry.title && !entry.text && !entry.path) || entry.sticker === 'none') continue
    const existing = items.find(item => parseStylePayload(item.stylePayload).regionSticker === region.id && parseStylePayload(item.stylePayload).stickerEntry === entry.id)
    if (existing) { stickers.push(existing); continue }
    const anchor = entry.stickerAnchor ?? index % 6, size = Math.min(49, paper.height * .65)
    stickers.push({ draftId: uid(), itemType: 'material', materialId: entry.sticker || ['flower', 'star', 'music-note', 'angel-wings', 'arcane-books', 'heart'][index % 6],
      x: paper.x + (anchor % 2 ? paper.width - size + 17 : -17), y: paper.y + (anchor < 2 ? -12 : anchor < 4 ? (paper.height - size) / 2 : paper.height - size + 10), width: size, height: size, rotation: anchor % 2 ? 9 : -9, zIndex: baseZ + updated.length + index + 1,
      stylePayload: JSON.stringify({ regionSticker: region.id, stickerEntry: entry.id, outline: true, color: ['#e999ba', '#d3ac69', '#a99bcf'][index % 3] }) })
  }
  return [...items.filter(item => memberOf(item) !== region.id && parseStylePayload(item.stylePayload).regionSticker !== region.id).map(item => item.draftId === zoneId ? writeRegion(item, { ...region, count: members.length || region.count, entries: [] }) : item), ...updated, ...stickers]
}
/** Expand old nested snapshots once; persisted members keep stable IDs across reopen. */
export function materializeRegions(items: JournalDraftItem[]): JournalDraftItem[] {
  let result = items
  for (const item of items) {
    const region = readRegion(item.stylePayload)
    if (!region || region.external || item.staged) continue
    const id = region.id || uid()
    const zone = writeRegion(item, { ...region, id, external: true, entries: [] })
    result = [...result.map(row => row.draftId === item.draftId ? zone : row), ...region.entries.map(entry => createPaper(id, entry))]
    result = arrangeRegionItems(result, item.draftId)
  }
  return result
}
export function collectRegionEntry(items: JournalDraftItem[], zoneId: string, entry: RegionEntry, existingId?: string): JournalDraftItem[] {
  const zone = items.find(item => item.draftId === zoneId), region = readRegion(zone?.stylePayload)
  if (!region?.id) return items
  const members = items.filter(item => memberOf(item) === region.id)
  if (!existingId && members.some(item => readRegionPaper(item)?.entry.id === entry.id)) return items
  const blank = region.kind === 'strips' ? members.find(item => { const e = paperEntry(item); return e && !e.title && !e.text && !e.path }) : undefined
  if (!blank && members.length >= REGION_CAPACITY) return items
  const existing = items.find(item => item.draftId === existingId)
  const paper = existing || blank || createPaper(region.id, entry)
  const style = parseStylePayload(paper.stylePayload)
  const next = { ...paper, staged: false, templateSlotId: undefined, templateGenerated: false,
    stylePayload: JSON.stringify({ ...style, regionMember: region.id, regionPaper: { ...readRegionPaper(paper), entry }, noteCard: { ...(isRecord(style.noteCard) ? style.noteCard : {}), titleText: entry.title, bodyText: entry.text } }) }
  return arrangeRegionItems([...items.filter(item => item.draftId !== paper.draftId && (!blank || item.draftId !== blank.draftId)), next], zoneId)
}
/** Removing a collector leaves all paper on the page. */
export function removeRegionAware(items: JournalDraftItem[], ids: string[]): JournalDraftItem[] {
  const regions = new Set(items.filter(item => ids.includes(item.draftId)).map(item => readRegion(item.stylePayload)?.id).filter(Boolean))
  return items.filter(item => !ids.includes(item.draftId)).map(item => {
    if (regions.has(memberOf(item))) return detachRegionItem(item)
    const style = { ...parseStylePayload(item.stylePayload) }
    if (typeof style.regionSticker === 'string' && regions.has(style.regionSticker)) {
      delete style.regionSticker; delete style.stickerEntry
      return { ...item, stylePayload: JSON.stringify(style) }
    }
    return item
  })
}
/** Confirming strips leaves a plain backdrop and fully independent paper. */
export function finalizeStrips(items: JournalDraftItem[], zoneId: string): JournalDraftItem[] {
  const zone = items.find(item => item.draftId === zoneId), region = readRegion(zone?.stylePayload)
  if (!zone || region?.kind !== 'strips') return items
  const style = { ...parseStylePayload(zone.stylePayload), color: region.color, noteCard: { titleText: region.title, bodyText: '' } }
  delete (style as Record<string, unknown>).region
  return items.map(item => {
    if (item.draftId === zoneId) return { ...item, stylePayload: JSON.stringify(style) }
    if (memberOf(item) === region.id) return detachRegionItem(item)
    const payload = { ...parseStylePayload(item.stylePayload) }
    if (payload.regionSticker === region.id) { delete payload.regionSticker; delete payload.stickerEntry; return { ...item, stylePayload: JSON.stringify(payload) } }
    return item
  })
}
/** Sample the rotated paper in the collector's local coordinates (not its center alone). */
export function regionOverlap(zone: JournalDraftItem, paper: JournalDraftItem): number {
  const a = paper.rotation * Math.PI / 180, b = -zone.rotation * Math.PI / 180
  let inside = 0
  for (let x = 0; x < 10; x++) for (let y = 0; y < 10; y++) {
    const dx = ((x + .5) / 10 - .5) * paper.width, dy = ((y + .5) / 10 - .5) * paper.height
    const wx = paper.x + paper.width / 2 + dx * Math.cos(a) - dy * Math.sin(a) - zone.x - zone.width / 2
    const wy = paper.y + paper.height / 2 + dx * Math.sin(a) + dy * Math.cos(a) - zone.y - zone.height / 2
    if (Math.abs(wx * Math.cos(b) - wy * Math.sin(b)) <= zone.width / 2 && Math.abs(wx * Math.sin(b) + wy * Math.cos(b)) <= zone.height / 2) inside++
  }
  return inside / 100
}
export function regionForItem(items: JournalDraftItem[], paper: JournalDraftItem) {
  return [...items].sort((a, b) => b.zIndex - a.zIndex).find(zone => zone.draftId !== paper.draftId && !zone.staged && parseStylePayload(zone.stylePayload).locked !== true && readRegion(zone.stylePayload) && regionOverlap(zone, paper) >= .45)
}
export function updateRegionItems(items: JournalDraftItem[], next: JournalDraftItem): JournalDraftItem[] {
  const previous = items.find(item => item.draftId === next.draftId)
  if (!previous) return items
  const region = readRegion(next.stylePayload)
  const replaced = items.map(item => item.draftId === next.draftId ? next : item)
  if (region && !region.id) return replaced
  if (region) {
    if (next.staged) return replaced.map(item => memberOf(item) === region.id ? detachRegionItem(item) : item)
    if (previous.width !== next.width || previous.height !== next.height || JSON.stringify(readRegion(previous.stylePayload)) !== JSON.stringify(region)) return arrangeRegionItems(replaced, next.draftId)
    // Moving/rotating a collector preserves all individual offsets.
    const angle = (next.rotation - previous.rotation) * Math.PI / 180
    return replaced.map(item => {
      if (memberOf(item) !== region.id && parseStylePayload(item.stylePayload).regionSticker !== region.id) return item
      const dx = item.x + item.width / 2 - previous.x - previous.width / 2, dy = item.y + item.height / 2 - previous.y - previous.height / 2
      return { ...item, x: next.x + next.width / 2 + dx * Math.cos(angle) - dy * Math.sin(angle) - item.width / 2, y: next.y + next.height / 2 + dx * Math.sin(angle) + dy * Math.cos(angle) - item.height / 2, rotation: item.rotation + next.rotation - previous.rotation }
    })
  }
  if (memberOf(next)) {
    const parent = items.find(item => readRegion(item.stylePayload)?.id === memberOf(next))
    if (!parent || next.staged || regionOverlap(parent, next) < .45) return replaced.map(item => item.draftId === next.draftId ? detachRegionItem(item) : item)
  }
  return replaced
}
