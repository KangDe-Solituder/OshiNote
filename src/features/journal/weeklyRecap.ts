import type { JournalDraftItem } from '../../types'
import { fetchCalendarNotes } from '../schedule/scheduleService'
import { fetchNotesByOshi } from '../notes/noteService'
import { fetchIllustrations } from '../illustrations/illustrationService'
import { createImageStylePayload, createNoteCardStylePayload } from './journalItemStyles'
import { getDefaultIllustrationItemSize } from './journalItemSizing'

const HANDOFF_KEY = 'oshinote.journalCreate.weeklyHandoff'
const MAX_WEEKLY_NOTES = 12
const MAX_WEEKLY_ILLUSTRATIONS = 8

export interface WeeklyRecapHandoff {
  oshiId: string
  title: string
  dateLabel: string
  background: string
  orientation: 'landscape'
  items: JournalDraftItem[]
}

export interface WeeklyRecapResult {
  handoff: WeeklyRecapHandoff
  noteCount: number
  illustrationCount: number
}

function createDraftId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * Aggregate this week's stream notes and collected illustrations into a staged
 * draft: every item lands on the work board so the user can compose freely.
 */
export async function buildWeeklyRecap(oshiId: string, weekStartKey: string, weekEndKey: string): Promise<WeeklyRecapResult> {
  const calendarNotes = await fetchCalendarNotes(oshiId, weekStartKey, weekEndKey)
  const noteIds = new Set(calendarNotes.map((note) => note.id))

  const [noteResult, illustrationRows] = await Promise.all([
    fetchNotesByOshi(oshiId, { page: 1, pageSize: 200, archiveFilter: 'all' }),
    fetchIllustrations({ oshiId, includeArchived: false, sort: 'newest' }),
  ])
  const notesById = new Map(noteResult.notes.map((note) => [note.id, note]))

  const items: JournalDraftItem[] = []
  let zIndex = 1
  for (const calendarNote of calendarNotes.slice(0, MAX_WEEKLY_NOTES)) {
    const note = notesById.get(calendarNote.id)
    items.push({
      draftId: createDraftId(),
      itemType: 'note',
      sourceId: calendarNote.id,
      stylePayload: createNoteCardStylePayload(note, { backgroundColor: '#fff7d6' }),
      staged: true,
      x: 0,
      y: 0,
      width: 260,
      height: 178,
      rotation: 0,
      zIndex: zIndex++,
    })
  }

  let illustrationCount = 0
  for (const illustration of illustrationRows) {
    if (illustrationCount >= MAX_WEEKLY_ILLUSTRATIONS) break
    const createdDay = (illustration.date || illustration.created_at).slice(0, 10)
    const inWeek = createdDay >= weekStartKey && createdDay <= weekEndKey
    if (!inWeek && !illustration.favorite) continue
    const imageSize = getDefaultIllustrationItemSize(illustration)
    items.push({
      draftId: createDraftId(),
      itemType: 'illustration',
      sourceId: illustration.id,
      stylePayload: createImageStylePayload(),
      staged: true,
      x: 0,
      y: 0,
      width: imageSize.width,
      height: imageSize.height,
      rotation: 0,
      zIndex: zIndex++,
    })
    illustrationCount += 1
  }

  const rangeLabel = `${weekStartKey.slice(5).replace('-', '/')}\u2013${weekEndKey.slice(5).replace('-', '/')}`
  return {
    handoff: {
      oshiId,
      title: '',
      dateLabel: rangeLabel,
      background: 'paper',
      orientation: 'landscape',
      items,
    },
    noteCount: noteIds.size,
    illustrationCount,
  }
}

export function stashWeeklyHandoff(handoff: WeeklyRecapHandoff): void {
  try {
    sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(handoff))
  } catch {
    // Session storage may be unavailable in restricted contexts.
  }
}

/** Read-and-clear the pending weekly recap handoff (consumed by the creation flow). */
export function consumeWeeklyHandoff(): WeeklyRecapHandoff | null {
  try {
    const raw = sessionStorage.getItem(HANDOFF_KEY)
    if (!raw) return null
    sessionStorage.removeItem(HANDOFF_KEY)
    const parsed = JSON.parse(raw) as WeeklyRecapHandoff
    return parsed && Array.isArray(parsed.items) ? parsed : null
  } catch {
    return null
  }
}
