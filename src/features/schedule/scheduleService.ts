import { getDb, generateId } from '../../database'
import type { CalendarNote, OshiSchedule, OshiScheduleOverride } from '../../types'
import type { DayActivity } from '../home/heatmapModel'

export interface ScheduleInput {
  title: string
  archive_id: string
  kind: 'weekly' | 'once'
  weekday?: number | null
  date?: string | null
  time?: string | null
}

function deserializeSchedule(row: OshiSchedule): OshiSchedule {
  return {
    ...row,
    kind: row.kind === 'weekly' ? 'weekly' : 'once',
    status: row.status === 'done' || row.status === 'cancelled' ? row.status : 'active',
  }
}

export async function fetchSchedules(oshiId: string): Promise<OshiSchedule[]> {
  const db = await getDb()
  const rows = await db.select<OshiSchedule[]>(
    'SELECT * FROM oshi_schedules WHERE oshi_id = ? ORDER BY created_at ASC',
    [oshiId]
  )
  return rows.map(deserializeSchedule)
}

export async function createSchedule(oshiId: string, input: ScheduleInput): Promise<OshiSchedule> {
  const db = await getDb()
  const id = generateId()
  await db.execute(
    `INSERT INTO oshi_schedules (id, oshi_id, title, archive_id, kind, weekday, date, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, oshiId, input.title, input.archive_id, input.kind, input.weekday ?? null, input.date ?? null, input.time ?? null]
  )
  const rows = await db.select<OshiSchedule[]>('SELECT * FROM oshi_schedules WHERE id = ?', [id])
  return deserializeSchedule(rows[0])
}

export async function updateSchedule(id: string, input: Partial<ScheduleInput>): Promise<void> {
  const db = await getDb()
  const sets: string[] = []
  const params: unknown[] = []
  if (input.title !== undefined) { sets.push('title = ?'); params.push(input.title) }
  if (input.archive_id !== undefined) { sets.push('archive_id = ?'); params.push(input.archive_id) }
  if (input.kind !== undefined) { sets.push('kind = ?'); params.push(input.kind) }
  if (input.weekday !== undefined) { sets.push('weekday = ?'); params.push(input.weekday) }
  if (input.date !== undefined) { sets.push('date = ?'); params.push(input.date) }
  if (input.time !== undefined) { sets.push('time = ?'); params.push(input.time) }
  if (sets.length === 0) return
  sets.push("updated_at = datetime('now', 'localtime')")
  await db.execute(`UPDATE oshi_schedules SET ${sets.join(', ')} WHERE id = ?`, [...params, id])
}

export async function deleteSchedule(id: string): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM oshi_schedule_overrides WHERE schedule_id = ?', [id])
  await db.execute('DELETE FROM oshi_schedules WHERE id = ?', [id])
}

/** Resolve a past occurrence: mark it done (optionally linked to a note) or cancelled. */
export async function resolveOccurrence(
  schedule: OshiSchedule,
  date: string,
  status: 'done' | 'cancelled',
  noteId?: string | null
): Promise<void> {
  const db = await getDb()
  if (schedule.kind === 'once') {
    await db.execute(
      "UPDATE oshi_schedules SET status = ?, note_id = ?, updated_at = datetime('now', 'localtime') WHERE id = ?",
      [status, noteId ?? null, schedule.id]
    )
    return
  }
  await db.execute(
    `INSERT INTO oshi_schedule_overrides (id, schedule_id, date, status, note_id) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(schedule_id, date) DO UPDATE SET status = excluded.status, note_id = excluded.note_id`,
    [generateId(), schedule.id, date, status, noteId ?? null]
  )
}

/** Restore an overridden weekly occurrence back to automatic resolution. */
export async function clearOccurrenceOverride(scheduleId: string, date: string): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM oshi_schedule_overrides WHERE schedule_id = ? AND date = ?', [scheduleId, date])
}

export async function fetchOverrides(oshiId: string, startKey: string, endKey: string): Promise<OshiScheduleOverride[]> {
  const db = await getDb()
  return db.select<OshiScheduleOverride[]>(
    `SELECT o.* FROM oshi_schedule_overrides o
     JOIN oshi_schedules s ON s.id = o.schedule_id
     WHERE s.oshi_id = ? AND o.date >= ? AND o.date <= ?`,
    [oshiId, startKey, endKey]
  )
}

/** Notes of one oshi within a date range, for calendar markers and matching. */
export async function fetchCalendarNotes(oshiId: string, startKey: string, endKey: string): Promise<CalendarNote[]> {
  const db = await getDb()
  return db.select<CalendarNote[]>(
    `SELECT id, title, created_at, source_url, archive_id FROM notes
     WHERE oshi_id = ? AND date(created_at) >= ? AND date(created_at) <= ?
     ORDER BY created_at ASC`,
    [oshiId, startKey, endKey]
  )
}

/** Per-day activity counts across all oshis, for the home-page heatmap. */
export async function fetchDailyActivity(startKey: string, endKey: string): Promise<Map<string, DayActivity>> {
  const db = await getDb()
  const map = new Map<string, DayActivity>()
  const ensure = (date: string): DayActivity => {
    let entry = map.get(date)
    if (!entry) {
      entry = { date, notes: 0, illustrations: 0, journalPages: 0 }
      map.set(date, entry)
    }
    return entry
  }

  const noteRows = await db.select<{ day: string; count: number }[]>(
    `SELECT date(created_at) AS day, COUNT(*) AS count FROM notes
     WHERE date(created_at) >= ? AND date(created_at) <= ? GROUP BY day`,
    [startKey, endKey]
  )
  for (const row of noteRows) ensure(row.day).notes = row.count

  const illustrationRows = await db.select<{ day: string; count: number }[]>(
    `SELECT date(COALESCE(NULLIF(date, ''), created_at)) AS day, COUNT(*) AS count FROM illustrations
     WHERE date(COALESCE(NULLIF(date, ''), created_at)) >= ? AND date(COALESCE(NULLIF(date, ''), created_at)) <= ?
     GROUP BY day`,
    [startKey, endKey]
  )
  for (const row of illustrationRows) if (row.day) ensure(row.day).illustrations = row.count

  const journalRows = await db.select<{ day: string; count: number }[]>(
    `SELECT date(created_at) AS day, COUNT(*) AS count FROM journal_pages
     WHERE date(created_at) >= ? AND date(created_at) <= ? GROUP BY day`,
    [startKey, endKey]
  )
  for (const row of journalRows) ensure(row.day).journalPages = row.count

  return map
}

/** Notes of all oshis on one day, for heatmap tooltips. */
export async function fetchDayNotes(dayKey: string): Promise<(CalendarNote & { oshi_id: string | null })[]> {
  const db = await getDb()
  return db.select<(CalendarNote & { oshi_id: string | null })[]>(
    `SELECT id, title, created_at, source_url, oshi_id, archive_id FROM notes
     WHERE date(created_at) = ? ORDER BY created_at ASC`,
    [dayKey]
  )
}
