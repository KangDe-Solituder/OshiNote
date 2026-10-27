import type { JournalDraftItem, Note } from '../../types'
import { parseStylePayload } from './journalItemStyles'
import { isRecord } from '../../utils/safeJson'

export type RegionKind = 'strips' | 'notes'
export type RegionStyle = 'loose' | 'box' | 'string' | 'board' | 'grid'
export interface RegionEntry {
  id: string
  kind: 'note' | 'image'
  title: string
  text: string
  date: string
  path?: string
  sticker?: string
  stickerAnchor?: number
}
export interface JournalRegion {
  id?: string
  external?: boolean
  version: 1
  kind: RegionKind
  style: RegionStyle
  title: string
  color: string
  palette: 'pastel' | 'warm' | 'cool'
  count: number
  limit: number
  lines: number
  holes: 'left' | 'right' | 'none'
  sort: 'asc' | 'desc' | 'added'
  scatter: number
  seed: number
  stickers: boolean
  entries: RegionEntry[]
}
export const REGION_CAPACITY = 24
export const REGION_PALETTES = {
  pastel: ['#fbe5ee', '#dff0fa', '#fff4cb', '#e4f1e5', '#eee4f9', '#fae4d7'],
  warm: ['#f8dfd8', '#f7e8c3', '#f5ddd9', '#efe2cc', '#faeadb', '#ecdccf'],
  cool: ['#dfeefa', '#e6e4fa', '#dff2eb', '#e2ecf1', '#ede3f4', '#dfeaf8'],
}
export function newRegion(kind: RegionKind): JournalRegion {
  return { version: 1, kind, style: 'loose', title: '', color: kind === 'strips' ? '#f1e7ed' : '#eee8f3', palette: 'pastel', count: 6, limit: kind === 'strips' ? 72 : 60, lines: 2, holes: 'left', sort: 'asc', scatter: 55, seed: 1, stickers: true, entries: [] }
}
const number = (value: unknown, fallback: number, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback
function choice<T extends string>(value: unknown, values: readonly T[], fallback: T): T { return values.includes(value as T) ? value as T : fallback }
export function readRegion(payload: string | null | undefined): JournalRegion | null {
  const value = parseStylePayload(payload).region
  if (!isRecord(value) || value.version !== 1 || !['strips', 'notes'].includes(String(value.kind))) return null
  const defaults = newRegion(value.kind as RegionKind)
  const entries: RegionEntry[] = []
  for (const entry of Array.isArray(value.entries) ? value.entries : []) {
    if (!isRecord(entry) || typeof entry.id !== 'string' || !['note', 'image'].includes(String(entry.kind)) || entries.some(e => e.id === entry.id && e.kind === entry.kind)) continue
    entries.push({ id: entry.id, kind: entry.kind as RegionEntry['kind'], title: typeof entry.title === 'string' ? entry.title : '', text: typeof entry.text === 'string' ? entry.text : '', date: typeof entry.date === 'string' ? entry.date : '', path: typeof entry.path === 'string' ? entry.path : undefined, sticker: typeof entry.sticker === 'string' ? entry.sticker : undefined, stickerAnchor: typeof entry.stickerAnchor === 'number' ? number(entry.stickerAnchor, 0, 0, 5) : undefined })
  }
  return { ...defaults, id: typeof value.id === 'string' ? value.id : undefined, external: value.external === true, entries, title: typeof value.title === 'string' ? value.title : '', color: typeof value.color === 'string' && /^#[\da-f]{6}$/i.test(value.color) ? value.color : defaults.color,
    style: choice(value.style, ['loose', 'box', 'string', 'board', 'grid'], 'loose'), palette: choice(value.palette, ['pastel', 'warm', 'cool'], 'pastel'), holes: choice(value.holes, ['left', 'right', 'none'], 'left'), sort: choice(value.sort, ['asc', 'desc', 'added'], 'asc'), count: Math.max(entries.length, number(value.count, 6, 1, REGION_CAPACITY)), limit: number(value.limit, defaults.limit, 0, 240), lines: number(value.lines, 2, 1, 2), scatter: number(value.scatter, 55, 0, 100), seed: number(value.seed, 1, 0, 100000), stickers: value.stickers !== false }
}
export function writeRegion(item: JournalDraftItem, region: JournalRegion): JournalDraftItem {
  return { ...item, templateGenerated: false, stylePayload: JSON.stringify({ ...parseStylePayload(item.stylePayload), region }) }
}
export function createRegionItem(kind: RegionKind, draftId: string): JournalDraftItem {
  return { draftId, itemType: 'material', materialId: 'memo-cream', x: 40, y: 45, width: kind === 'strips' ? 530 : 340, height: kind === 'strips' ? 600 : 420, rotation: 0, zIndex: 1, stylePayload: JSON.stringify({ region: newRegion(kind) }) }
}
export function noteRegionEntry(note: Note): RegionEntry {
  return { id: note.id, kind: 'note', title: note.title, text: note.plain_text, date: note.created_at }
}
export function addRegionEntries(region: JournalRegion, entries: RegionEntry[]): JournalRegion {
  const merged = [...region.entries]
  for (const entry of entries) if (!merged.some(e => e.id === entry.id && e.kind === entry.kind) && merged.length < REGION_CAPACITY) merged.push(entry)
  return { ...region, entries: merged, count: Math.max(region.count, merged.length) }
}
export function orderedRegionEntries(region: JournalRegion): RegionEntry[] {
  return region.sort === 'added' ? region.entries : region.entries.map((entry, index) => ({ entry, index })).sort((a, b) => (region.sort === 'asc' ? 1 : -1) * a.entry.date.localeCompare(b.entry.date) || a.index - b.index).map(row => row.entry)
}
export function excerpt(text: string, limit: number): string {
  const chars = Array.from(text.replace(/\s+/g, ' ').trim())
  return limit === 0 ? '' : chars.slice(0, limit).join('') + (chars.length > limit ? '…' : '')
}
/** Stable jitter: an unrelated edit must not move the paper. */
function jitter(key: string, seed: number) {
  let hash = seed
  for (const char of key) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return ((hash >>> 0) % 1000) / 500 - 1
}
export interface RegionCard { entry?: RegionEntry; x: number; y: number; width: number; height: number; rotation: number; color: string; index: number }
export function layoutRegion(region: JournalRegion, width: number, height: number): RegionCard[] {
  const entries = orderedRegionEntries(region)
  const n = region.kind === 'strips' ? Math.max(region.count, entries.length) : Math.max(1, entries.length)
  const gap = 10, margin = 22, top = 44, innerW = Math.max(40, width - margin * 2), innerH = Math.max(40, height - top - 20)
  return Array.from({ length: n }, (_, index) => {
    const entry = entries[index], random = jitter(entry?.id || String(index), region.seed), loosen = region.scatter / 100
    let w = innerW - 12, h = Math.max(24, (innerH - (n - 1) * gap) / n), x = margin + 6 + random * 4 * loosen, y = top + index * (h + gap), rotation = random * 1.6 * loosen
    if (region.kind === 'notes') {
      if (region.style === 'loose' || region.style === 'box') {
        const usableH = innerH
        w = innerW * (n === 1 ? 0.88 : 0.80)
        h = Math.max(24, Math.min(w * 0.72, usableH / (1 + (n - 1) * 0.30)))
        if (region.style === 'box') h = Math.min(h, height * .18 + 40)
        const lastY = region.style === 'box' ? height * .82 - top - Math.min(h * .65, 48) : usableH - h - 8
        const step = n > 1 ? Math.max(0, lastY / (n - 1)) : 0
        x = margin + (index % 2 ? innerW - w : 0) + random * 3 * loosen
        y = top + (n === 1 && region.style === 'box' ? Math.max(0, lastY) : index * step); rotation = (index % 2 ? 1 : -1) * (1.4 + Math.abs(random) * 2) * loosen
      } else {
        const cols = n === 1 ? 1 : 2, rows = Math.ceil(n / cols)
        w = (innerW - (cols - 1) * 12) / cols; h = (innerH - (rows - 1) * 14) / rows
        x = margin + (index % cols) * (w + 12); y = top + Math.floor(index / cols) * (h + 14)
        rotation = region.style === 'grid' ? 0 : random * 5 * loosen
      }
    }
    return { entry, index, x, y, width: w, height: h, rotation, color: REGION_PALETTES[region.palette][index % 6] }
  })
}
/** Inverse rotation makes drops agree with the visible, rotated container. */
export function regionAtPoint(items: JournalDraftItem[], point: { x: number; y: number }): JournalDraftItem | undefined {
  return [...items].sort((a, b) => b.zIndex - a.zIndex).find(item => {
    if (item.staged || !readRegion(item.stylePayload) || parseStylePayload(item.stylePayload).locked === true) return false
    const angle = -item.rotation * Math.PI / 180, dx = point.x - item.x - item.width / 2, dy = point.y - item.y - item.height / 2
    return Math.abs(dx * Math.cos(angle) - dy * Math.sin(angle)) <= item.width / 2 && Math.abs(dx * Math.sin(angle) + dy * Math.cos(angle)) <= item.height / 2
  })
}
