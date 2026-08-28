import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { BookOpen, CalendarDays, Clock, FileText, Loader2, Video } from 'lucide-react'
import type { CalendarNote, Oshi, OshiSchedule, OshiScheduleOverride } from '../../../types'
import {
  addDays,
  expandOccurrences,
  resolveOccurrence,
  toLocalDateKey,
  type DayScheduleEntry,
} from '../../../features/schedule/scheduleModel'
import { fetchCalendarNotes, fetchOverrides, fetchSchedules } from '../../../features/schedule/scheduleService'
import { fetchArchivesByOshi } from '../../../features/oshis/archiveService'
import { buildWeeklyRecap, stashWeeklyHandoff } from '../../../features/journal/weeklyRecap'
import type { Archive } from '../../../types'
import { useI18n } from '../../../i18n/useI18n'

interface WeekEntry extends DayScheduleEntry {
  isToday: boolean
}

/** Side card listing this week's (Mon–Sun) scheduled streams and their resolution state. */
export function ThisWeekCard({ oshi, refreshToken }: { oshi: Oshi; refreshToken?: number }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const todayKey = toLocalDateKey(new Date())
  const [schedules, setSchedules] = useState<OshiSchedule[]>([])
  const [archives, setArchives] = useState<Archive[]>([])
  const [overrides, setOverrides] = useState<OshiScheduleOverride[]>([])
  const [notes, setNotes] = useState<CalendarNote[]>([])
  const [buildingRecap, setBuildingRecap] = useState(false)

  async function handleBuildRecap() {
    setBuildingRecap(true)
    try {
      await buildWeeklyRecap(oshi.id, weekRange.startKey, weekRange.endKey)
        .then((result) => stashWeeklyHandoff(result.handoff))
      navigate(`/journal/create?oshiId=${encodeURIComponent(oshi.id)}`)
    } finally {
      setBuildingRecap(false)
    }
  }

  const weekRange = useMemo(() => {
    const today = new Date()
    const mondayOffset = (today.getDay() + 6) % 7
    const monday = new Date(today)
    monday.setDate(today.getDate() - mondayOffset)
    return { startKey: toLocalDateKey(monday), endKey: addDays(toLocalDateKey(monday), 6) }
  }, [todayKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let alive = true
    Promise.all([
      fetchSchedules(oshi.id),
      fetchOverrides(oshi.id, weekRange.startKey, weekRange.endKey),
      fetchCalendarNotes(oshi.id, weekRange.startKey, weekRange.endKey),
      fetchArchivesByOshi(oshi.id),
    ])
      .then(([scheduleRows, overrideRows, noteRows, archiveRows]) => {
        if (!alive) return
        setSchedules(scheduleRows)
        setOverrides(overrideRows)
        setNotes(noteRows)
        setArchives(archiveRows)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [oshi.id, weekRange, refreshToken])

  const entries = useMemo(() => {
    const result: WeekEntry[] = []
    for (const schedule of schedules) {
      for (const date of expandOccurrences(schedule, weekRange.startKey, weekRange.endKey)) {
        const dayNotes = notes.filter((note) => note.created_at.slice(0, 10) === date)
        const override = overrides.find((item) => item.schedule_id === schedule.id && item.date === date) || null
        const entry = resolveOccurrence(schedule, date, dayNotes, override, todayKey)
        if (entry.state === 'cancelled') continue
        result.push({ ...entry, isToday: date === todayKey })
      }
    }
    return result.sort((a, b) => a.date.localeCompare(b.date) || (a.schedule.time || '99').localeCompare(b.schedule.time || '99'))
  }, [notes, overrides, schedules, todayKey, weekRange])

  const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

  return (
    <section className="rounded-2xl border border-border-color bg-bg-card p-5 shadow-e1">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-soft/30 text-accent">
          <CalendarDays size={16} />
        </span>
        <h2 className="font-semibold text-text-primary">{t('calendar.thisWeek')}</h2>
        <button
          type="button"
          onClick={() => void handleBuildRecap()}
          disabled={buildingRecap}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-bg-secondary hover:text-accent disabled:opacity-50"
        >
          {buildingRecap ? <Loader2 size={13} className="animate-spin" /> : <BookOpen size={13} />}
          {t('journal.buildRecap')}
        </button>
      </div>
      {entries.length === 0 ? (
        <p className="py-4 text-center text-sm text-text-muted">{t('calendar.noWeekSchedules')}</p>
      ) : (
        <div className="space-y-1.5">
          {entries.map((entry) => (
            <div
              key={`${entry.schedule.id}-${entry.date}`}
              className={clsx(
                'flex items-center gap-2.5 rounded-xl border px-3 py-2',
                entry.isToday ? 'border-accent/50 bg-accent/5' : 'border-transparent',
                entry.state === 'missed' ? 'bg-bg-secondary/30' : 'bg-bg-secondary/20'
              )}
            >
              <span className={clsx('w-10 shrink-0 text-xs font-semibold', entry.isToday ? 'text-accent' : 'text-text-secondary')}>
                {t(`calendar.weekday.${WEEKDAY_KEYS[new Date(entry.date + 'T00:00:00').getDay()]}`)}
              </span>
              <Video size={13} className={clsx('shrink-0', entry.state === 'missed' ? 'text-text-muted' : 'text-accent')} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">{entry.schedule.title || t('calendar.untitledSchedule')}</p>
                <p className="flex items-center gap-2 text-[11px] text-text-muted">
                  {entry.schedule.time && <span className="inline-flex items-center gap-0.5"><Clock size={10} />{entry.schedule.time}</span>}
                  {entry.schedule.archive_id && <span>{archives.find((archive) => archive.id === entry.schedule.archive_id)?.name || ''}</span>}
                </p>
              </div>
              <EntryStateChip entry={entry} t={t} />
              {entry.matchedNote && (
                <button
                  type="button"
                  onClick={() => navigate(`/oshis/${oshi.id}/notes/${entry.matchedNote!.id}`)}
                  className="shrink-0 rounded-md p-1 text-text-muted transition-colors hover:bg-bg-tertiary hover:text-accent"
                  title={t('calendar.openNote')}
                >
                  <FileText size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function EntryStateChip({ entry, t }: { entry: WeekEntry; t: ReturnType<typeof useI18n>['t'] }) {
  if (entry.state === 'recorded' || entry.state === 'done') {
    return <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">{t('calendar.state.done')}</span>
  }
  if (entry.state === 'missed') {
    return <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600">{t('calendar.state.missed')}</span>
  }
  return <span className="shrink-0 rounded-full bg-bg-tertiary px-2 py-0.5 text-[10px] font-semibold text-text-muted">{t('calendar.state.scheduled')}</span>
}
