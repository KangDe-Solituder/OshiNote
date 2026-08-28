import type { CalendarNote, OshiAnniversary, OshiSchedule, OshiScheduleOverride } from '../../types'

/** Occurrence resolution for one schedule on one day. */
export type OccurrenceState = 'scheduled' | 'recorded' | 'missed' | 'done' | 'cancelled'

export interface DayScheduleEntry {
  schedule: OshiSchedule
  date: string
  state: OccurrenceState
  matchedNote: CalendarNote | null
  override: OshiScheduleOverride | null
}

export function toLocalDateKey(date: Date): string {
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function dateKeyToDate(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1)
}

export function addDays(key: string, days: number): string {
  const date = dateKeyToDate(key)
  date.setDate(date.getDate() + days)
  return toLocalDateKey(date)
}

/** The note's stream day: its editable Date (created_at), stored as 'YYYY-MM-DD HH:MM:SS'. */
export function noteDateKey(note: Pick<CalendarNote, 'created_at'>): string {
  return note.created_at.slice(0, 10)
}

function noteTimeMinutes(note: Pick<CalendarNote, 'created_at'>): number | null {
  const time = note.created_at.slice(11, 16)
  if (!/^\d{2}:\d{2}$/.test(time)) return null
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export function timeToMinutes(time: string | null): number | null {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return null
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/** All dates in [startKey, endKey] on which a schedule occurs. */
export function expandOccurrences(schedule: OshiSchedule, startKey: string, endKey: string): string[] {
  if (schedule.kind === 'once') {
    return schedule.date && schedule.date >= startKey && schedule.date <= endKey ? [schedule.date] : []
  }
  if (schedule.weekday == null) return []
  const dates: string[] = []
  let cursor = dateKeyToDate(startKey)
  // JS getDay(): 0 = Sunday ... 6 = Saturday, same convention as schedule.weekday.
  while (cursor.getDay() !== schedule.weekday) cursor.setDate(cursor.getDate() + 1)
  const end = dateKeyToDate(endKey)
  while (cursor <= end) {
    dates.push(toLocalDateKey(cursor))
    cursor = new Date(cursor)
    cursor.setDate(cursor.getDate() + 7)
  }
  return dates
}

/**
 * A scheduled occurrence turns solid when a note exists that day and ANY of:
 * 1. the note's archive matches the schedule's archive;
 * 2. the schedule has a time and the note's Date is within 3 hours of it;
 * 3. the schedule has no fixed time — any note that day counts.
 */
export function matchScheduleToNotes(schedule: OshiSchedule, notesOnDay: CalendarNote[]): CalendarNote | null {
  if (notesOnDay.length === 0) return null
  if (schedule.time == null) return notesOnDay[0]
  const scheduleMinutes = timeToMinutes(schedule.time)
  for (const note of notesOnDay) {
    if (schedule.archive_id && note.archive_id === schedule.archive_id) return note
    const noteMinutes = noteTimeMinutes(note)
    if (scheduleMinutes != null && noteMinutes != null && Math.abs(noteMinutes - scheduleMinutes) <= 180) return note
  }
  return null
}

export function resolveOccurrence(
  schedule: OshiSchedule,
  date: string,
  notesOnDay: CalendarNote[],
  override: OshiScheduleOverride | null,
  todayKey: string
): DayScheduleEntry {
  if (override) {
    return {
      schedule,
      date,
      state: override.status,
      matchedNote: override.note_id ? notesOnDay.find((note) => note.id === override.note_id) || null : null,
      override,
    }
  }
  if (schedule.kind === 'once' && schedule.status !== 'active') {
    const state = schedule.status
    return {
      schedule,
      date,
      state,
      matchedNote: schedule.note_id ? notesOnDay.find((note) => note.id === schedule.note_id) || null : null,
      override: null,
    }
  }
  const matched = matchScheduleToNotes(schedule, notesOnDay)
  if (matched) return { schedule, date, state: 'recorded', matchedNote: matched, override: null }
  return { schedule, date, state: date < todayKey ? 'missed' : 'scheduled', matchedNote: null, override: null }
}

export function getNextAnniversary(
  anniversaries: OshiAnniversary[],
  kind: OshiAnniversary['kind'],
  today: Date
): { anniversary: OshiAnniversary; daysUntil: number } | null {
  const candidates = anniversaries.filter((item) => item.kind === kind)
  let best: { anniversary: OshiAnniversary; daysUntil: number } | null = null
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  for (const anniversary of candidates) {
    let occurrence = new Date(today.getFullYear(), anniversary.month - 1, anniversary.day)
    if (occurrence < startOfToday) occurrence = new Date(today.getFullYear() + 1, anniversary.month - 1, anniversary.day)
    const daysUntil = Math.round((occurrence.getTime() - startOfToday.getTime()) / 86_400_000)
    if (!best || daysUntil < best.daysUntil) best = { anniversary, daysUntil }
  }
  return best
}

export function getAnniversariesOnDate(anniversaries: OshiAnniversary[], dateKey: string): OshiAnniversary[] {
  const month = Number(dateKey.slice(5, 7))
  const day = Number(dateKey.slice(8, 10))
  return anniversaries.filter((item) => item.month === month && item.day === day)
}

/** Validate a recurring month/day pair. February 29 is valid for leap-day anniversaries. */
export function isValidAnniversaryDate(month: number, day: number): boolean {
  if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1) return false
  const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day <= daysInMonth[month - 1]
}
