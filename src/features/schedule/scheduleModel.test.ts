import { describe, expect, it } from 'vitest'
import type { CalendarNote, OshiSchedule } from '../../types'
import {
  expandOccurrences,
  getAnniversariesOnDate,
  getNextAnniversary,
  isValidAnniversaryDate,
  matchScheduleToNotes,
  noteDateKey,
  resolveOccurrence,
  toLocalDateKey,
} from './scheduleModel'

function makeSchedule(overrides: Partial<OshiSchedule>): OshiSchedule {
  return {
    id: 's1',
    oshi_id: 'o1',
    title: '定期配信',
    archive_id: '',
    kind: 'once',
    weekday: null,
    date: null,
    time: null,
    status: 'active',
    note_id: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

function makeNote(createdAt: string, archiveId: string | null = null): CalendarNote {
  return { id: `n-${createdAt}`, title: '感想', created_at: createdAt, source_url: '', archive_id: archiveId }
}

describe('expandOccurrences', () => {
  it('expands weekly schedules on matching weekdays', () => {
    // 2026-08-24 is a Monday.
    const schedule = makeSchedule({ kind: 'weekly', weekday: 1 })
    expect(expandOccurrences(schedule, '2026-08-01', '2026-08-31')).toEqual([
      '2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31',
    ])
  })

  it('keeps once schedules inside the range only', () => {
    const inside = makeSchedule({ kind: 'once', date: '2026-08-15' })
    const outside = makeSchedule({ kind: 'once', date: '2026-09-02' })
    expect(expandOccurrences(inside, '2026-08-01', '2026-08-31')).toEqual(['2026-08-15'])
    expect(expandOccurrences(outside, '2026-08-01', '2026-08-31')).toEqual([])
  })
})

describe('matchScheduleToNotes', () => {
  it('matches any note when the schedule has no fixed time', () => {
    const schedule = makeSchedule({ archive_id: 'arc-nico', time: null })
    expect(matchScheduleToNotes(schedule, [makeNote('2026-08-22 23:00:00')])).not.toBeNull()
  })

  it('matches by archive even when the time differs', () => {
    const schedule = makeSchedule({ archive_id: 'arc-yt', time: '21:00' })
    const notes = [makeNote('2026-08-22 10:00:00', 'arc-yt')]
    expect(matchScheduleToNotes(schedule, notes)).toBe(notes[0])
  })

  it('matches by time within three hours when archive differs or is unset', () => {
    const schedule = makeSchedule({ archive_id: 'arc-nico', time: '21:00' })
    const notes = [makeNote('2026-08-22 23:30:00', 'arc-yt')]
    expect(matchScheduleToNotes(schedule, notes)).toBe(notes[0])
  })

  it('does not match when neither archive nor time align', () => {
    const schedule = makeSchedule({ archive_id: 'arc-yt', time: '21:00' })
    const notes = [makeNote('2026-08-22 10:00:00', 'arc-nico')]
    expect(matchScheduleToNotes(schedule, notes)).toBeNull()
  })
})

describe('resolveOccurrence', () => {
  const today = toLocalDateKey(new Date())

  it('marks matched occurrences as recorded', () => {
    const schedule = makeSchedule({ kind: 'once', date: today, time: null })
    const entry = resolveOccurrence(schedule, today, [makeNote(`${today} 20:00:00`)], null, today)
    expect(entry.state).toBe('recorded')
  })

  it('marks past unmatched occurrences as missed and future ones as scheduled', () => {
    const schedule = makeSchedule({ kind: 'once', date: '2020-01-01' })
    expect(resolveOccurrence(schedule, '2020-01-01', [], null, today).state).toBe('missed')
    const future = makeSchedule({ kind: 'once', date: '2099-01-01' })
    expect(resolveOccurrence(future, '2099-01-01', [], null, today).state).toBe('scheduled')
  })

  it('honours manual overrides and once-status', () => {
    const weekly = makeSchedule({ kind: 'weekly', weekday: 6 })
    const override = { id: 'ov1', schedule_id: 's1', date: '2026-08-22', status: 'cancelled' as const, note_id: null, created_at: '' }
    expect(resolveOccurrence(weekly, '2026-08-22', [makeNote('2026-08-22 20:00:00')], override, today).state).toBe('cancelled')

    const doneOnce = makeSchedule({ kind: 'once', date: '2026-08-22', status: 'done' })
    expect(resolveOccurrence(doneOnce, '2026-08-22', [], null, today).state).toBe('done')
  })
})

describe('anniversaries', () => {
  const anniversaries = [
    { id: 'a1', label: '誕生日', month: 3, day: 5, kind: 'birthday' as const },
    { id: 'a2', label: '出道日', month: 12, day: 31, kind: 'debut' as const },
  ]

  it('finds anniversaries on a date regardless of year', () => {
    expect(getAnniversariesOnDate(anniversaries, '2026-03-05')).toHaveLength(1)
    expect(getAnniversariesOnDate(anniversaries, '2027-12-31')).toHaveLength(1)
    expect(getAnniversariesOnDate(anniversaries, '2026-03-06')).toHaveLength(0)
  })

  it('computes the next birthday within and across year boundaries', () => {
    const before = getNextAnniversary(anniversaries, 'birthday', new Date(2026, 0, 1))
    expect(before?.daysUntil).toBe(63)
    const after = getNextAnniversary(anniversaries, 'birthday', new Date(2026, 2, 6))
    expect(after?.daysUntil).toBe(364)
    const sameDay = getNextAnniversary(anniversaries, 'birthday', new Date(2026, 2, 5))
    expect(sameDay?.daysUntil).toBe(0)
  })

  it('rejects impossible recurring dates while allowing leap day', () => {
    expect(isValidAnniversaryDate(2, 29)).toBe(true)
    expect(isValidAnniversaryDate(2, 30)).toBe(false)
    expect(isValidAnniversaryDate(4, 31)).toBe(false)
    expect(isValidAnniversaryDate(12, 31)).toBe(true)
    expect(isValidAnniversaryDate(0, 1)).toBe(false)
  })
})

describe('noteDateKey', () => {
  it('uses the editable Date (created_at) day', () => {
    expect(noteDateKey({ created_at: '2026-08-22 23:00:00' })).toBe('2026-08-22')
  })
})
