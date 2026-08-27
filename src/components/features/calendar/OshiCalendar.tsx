import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { Cake, CalendarCog, ChevronLeft, ChevronRight, Clock, FileText, Radio, RotateCcw, Video, X } from 'lucide-react'
import type { Archive, CalendarNote, Oshi, OshiAnniversary, OshiSchedule, OshiScheduleOverride } from '../../../types'
import {
  addDays,
  dateKeyToDate,
  expandOccurrences,
  getAnniversariesOnDate,
  getNextAnniversary,
  resolveOccurrence,
  toLocalDateKey,
  type DayScheduleEntry,
} from '../../../features/schedule/scheduleModel'
import {
  clearOccurrenceOverride,
  fetchCalendarNotes,
  fetchOverrides,
  fetchSchedules,
  resolveOccurrence as persistOccurrence,
} from '../../../features/schedule/scheduleService'
import { fetchArchivesByOshi } from '../../../features/oshis/archiveService'
import { useI18n } from '../../../i18n/useI18n'
import { useMotionTiming } from '../themes/uiMotion'
import { ScheduleManager } from './ScheduleManager'

interface CalendarDayModel {
  dateKey: string
  inMonth: boolean
  isToday: boolean
  inCurrentWeek: boolean
  notes: CalendarNote[]
  entries: DayScheduleEntry[]
  anniversaries: OshiAnniversary[]
}

const WEEKDAY_LABEL_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

export function OshiCalendar({ oshi, onOshiUpdated }: { oshi: Oshi; onOshiUpdated: () => void }) {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const timing = useMotionTiming()
  const todayKey = toLocalDateKey(new Date())
  const [monthCursor, setMonthCursor] = useState(() => todayKey.slice(0, 7))
  const [schedules, setSchedules] = useState<OshiSchedule[]>([])
  const [archives, setArchives] = useState<Archive[]>([])
  const [overrides, setOverrides] = useState<OshiScheduleOverride[]>([])
  const [notes, setNotes] = useState<CalendarNote[]>([])
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [managerOpen, setManagerOpen] = useState(false)
  const requestRef = useRef(0)

  const gridRange = useMemo(() => {
    const [year, month] = monthCursor.split('-').map(Number)
    const first = new Date(year, month - 1, 1)
    const startOffset = (first.getDay() + 6) % 7 // Monday-first grid
    const start = new Date(year, month - 1, 1 - startOffset)
    const end = new Date(start)
    end.setDate(start.getDate() + 41)
    return { startKey: toLocalDateKey(start), endKey: toLocalDateKey(end) }
  }, [monthCursor])

  useEffect(() => {
    const requestId = ++requestRef.current
    Promise.all([
      fetchSchedules(oshi.id),
      fetchOverrides(oshi.id, gridRange.startKey, gridRange.endKey),
      fetchCalendarNotes(oshi.id, gridRange.startKey, gridRange.endKey),
      fetchArchivesByOshi(oshi.id),
    ])
      .then(([scheduleRows, overrideRows, noteRows, archiveRows]) => {
        if (requestRef.current !== requestId) return
        setSchedules(scheduleRows)
        setOverrides(overrideRows)
        setNotes(noteRows)
        setArchives(archiveRows)
      })
      .catch(() => {})
  }, [oshi.id, gridRange])

  const notesByDay = useMemo(() => {
    const map = new Map<string, CalendarNote[]>()
    for (const note of notes) {
      const key = note.created_at.slice(0, 10)
      const list = map.get(key) || []
      list.push(note)
      map.set(key, list)
    }
    return map
  }, [notes])

  const weeks = useMemo(() => {
    const currentWeekMonday = getMondayKey(todayKey)
    const rows: CalendarDayModel[][] = []
    for (let week = 0; week < 6; week += 1) {
      const row: CalendarDayModel[] = []
      for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
        const dateKey = addDays(gridRange.startKey, week * 7 + dayIndex)
        const dayNotes = notesByDay.get(dateKey) || []
        const entries: DayScheduleEntry[] = []
        for (const schedule of schedules) {
          if (!expandOccurrences(schedule, dateKey, dateKey).length) continue
          const override = overrides.find((item) => item.schedule_id === schedule.id && item.date === dateKey) || null
          const entry = resolveOccurrence(schedule, dateKey, dayNotes, override, todayKey)
          if (entry.state !== 'cancelled') entries.push(entry)
        }
        row.push({
          dateKey,
          inMonth: dateKey.slice(0, 7) === monthCursor,
          isToday: dateKey === todayKey,
          inCurrentWeek: getMondayKey(dateKey) === currentWeekMonday,
          notes: dayNotes,
          entries,
          anniversaries: getAnniversariesOnDate(oshi.anniversaries, dateKey),
        })
      }
      rows.push(row)
    }
    return rows
  }, [gridRange, monthCursor, notesByDay, oshi.anniversaries, overrides, schedules, todayKey])

  const nextBirthday = useMemo(() => getNextAnniversary(oshi.anniversaries, 'birthday', new Date()), [oshi.anniversaries])
  const archiveNameById = useMemo(() => new Map(archives.map((archive) => [archive.id, archive.name])), [archives])
  const selectedModel = useMemo(() => weeks.flat().find((day) => day.dateKey === selectedDay) || null, [weeks, selectedDay])

  function shiftMonth(delta: number) {
    const [year, month] = monthCursor.split('-').map(Number)
    const next = new Date(year, month - 1 + delta, 1)
    setMonthCursor(toLocalDateKey(next).slice(0, 7))
    setSelectedDay(null)
  }

  async function handleResolve(entry: DayScheduleEntry, status: 'done' | 'cancelled', noteId?: string | null) {
    await persistOccurrence(entry.schedule, entry.date, status, noteId)
    const [overrideRows] = await Promise.all([fetchOverrides(oshi.id, gridRange.startKey, gridRange.endKey)])
    setOverrides(overrideRows)
    if (entry.schedule.kind === 'once') {
      const rows = await fetchSchedules(oshi.id)
      setSchedules(rows)
    }
  }

  async function handleRestore(entry: DayScheduleEntry) {
    await clearOccurrenceOverride(entry.schedule.id, entry.date)
    setOverrides(await fetchOverrides(oshi.id, gridRange.startKey, gridRange.endKey))
  }

  const monthTitle = (() => {
    const [year, month] = monthCursor.split('-').map(Number)
    const formatted = new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : locale === 'ja' ? 'ja-JP' : 'en-US', { year: 'numeric', month: 'long' })
    return formatted.format(new Date(year, month - 1, 1))
  })()

  return (
    <section className="rounded-2xl border border-border-color bg-bg-card p-5 shadow-e1">
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="text-lg font-semibold text-text-primary">{monthTitle}</h2>
          <span className="text-xs text-text-muted">{t('calendar.subtitle')}</span>
        </div>
        {nextBirthday && (
          <span
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
              nextBirthday.daysUntil === 0
                ? 'bg-accent text-white'
                : 'bg-accent-soft/40 text-accent'
            )}
            title={nextBirthday.anniversary.label}
          >
            <Cake size={13} />
            {nextBirthday.daysUntil === 0
              ? t('calendar.birthdayToday', { name: nextBirthday.anniversary.label })
              : t('calendar.birthdayIn', { name: nextBirthday.anniversary.label, days: nextBirthday.daysUntil })}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => shiftMonth(-1)} className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-bg-secondary hover:text-text-primary" title={t('calendar.prevMonth')} aria-label={t('calendar.prevMonth')}>
            <ChevronLeft size={17} />
          </button>
          <button
            type="button"
            onClick={() => { setMonthCursor(todayKey.slice(0, 7)); setSelectedDay(null) }}
            className="rounded-lg px-2 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary"
          >
            {t('calendar.today')}
          </button>
          <button type="button" onClick={() => shiftMonth(1)} className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-bg-secondary hover:text-text-primary" title={t('calendar.nextMonth')} aria-label={t('calendar.nextMonth')}>
            <ChevronRight size={17} />
          </button>
          <button
            type="button"
            onClick={() => setManagerOpen(true)}
            className="ml-1 inline-flex items-center gap-1.5 rounded-lg border border-border-color bg-bg-secondary px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary"
          >
            <CalendarCog size={14} />
            {t('calendar.manage')}
          </button>
        </div>
      </header>

      <div className="mb-2 grid grid-cols-7 gap-1 border-b border-border-color/60 pb-2">
        {WEEKDAY_LABEL_KEYS.map((key) => (
          <div key={key} className="text-center text-[11px] font-medium tracking-wide text-text-muted">
            {t(`calendar.weekday.${key}`)}
          </div>
        ))}
      </div>

      <div className="relative">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={monthCursor}
            initial={timing.micro > 0 ? { opacity: 0, y: 6 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: timing.micro + 0.06, ease: 'easeOut' }}
            className="space-y-1"
          >
            {weeks.map((week) => (
              <div
                key={week[0].dateKey}
                className={clsx(
                  'grid grid-cols-7 gap-1 rounded-xl px-1 py-0.5',
                  week.some((day) => day.inCurrentWeek) && 'bg-accent/10 ring-1 ring-accent/15'
                )}
              >
                {week.map((day) => (
                  <DayCell
                    key={day.dateKey}
                    day={day}
                    selected={selectedDay === day.dateKey}
                    onSelect={() => setSelectedDay(day.dateKey === selectedDay ? null : day.dateKey)}
                    t={t}
                  />
                ))}
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence initial={false}>
        {selectedModel && (
          <DayDetail
            key={selectedModel.dateKey}
            day={selectedModel}
            archiveNameById={archiveNameById}
            onOpenNote={(noteId) => navigate(`/oshis/${oshi.id}/notes/${noteId}`)}
            onResolve={handleResolve}
            onRestore={handleRestore}
            onClose={() => setSelectedDay(null)}
          />
        )}
      </AnimatePresence>

      <ScheduleManager
        open={managerOpen}
        oshi={oshi}
        schedules={schedules}
        onClose={() => setManagerOpen(false)}
        onChanged={async () => {
          setSchedules(await fetchSchedules(oshi.id))
          setOverrides(await fetchOverrides(oshi.id, gridRange.startKey, gridRange.endKey))
          onOshiUpdated()
        }}
      />
    </section>
  )
}

function getMondayKey(dateKey: string): string {
  const date = dateKeyToDate(dateKey)
  const offset = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - offset)
  return toLocalDateKey(date)
}

function DayCell({
  day,
  selected,
  onSelect,
  t,
}: {
  day: CalendarDayModel
  selected: boolean
  onSelect: () => void
  t: ReturnType<typeof useI18n>['t']
}) {
  const hasContent = day.notes.length > 0 || day.entries.length > 0 || day.anniversaries.length > 0
  const dayNumber = Number(day.dateKey.slice(8, 10))

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onSelect}
        disabled={!hasContent && !day.inMonth}
        className={clsx(
          'flex h-[52px] w-full flex-col items-center justify-center gap-1 rounded-lg transition-colors',
          day.inMonth ? 'text-text-primary' : 'text-text-muted/40',
          hasContent ? 'hover:bg-bg-tertiary/70' : 'hover:bg-bg-secondary/40',
          selected && 'bg-bg-tertiary/80 ring-1 ring-accent/60'
        )}
        aria-label={day.dateKey}
      >
        <span className="flex items-center justify-center gap-0.5">
          <span
            className={clsx(
              'flex h-6 w-6 items-center justify-center rounded-full text-[13px] font-medium',
              day.isToday && 'bg-accent font-semibold text-white shadow-sm'
            )}
          >
            {dayNumber}
          </span>
          {day.anniversaries.length > 0 && (
            <Cake size={11} className="text-amber-500" aria-label={t('calendar.anniversary')} />
          )}
        </span>
        <span className="flex h-1.5 items-center justify-center gap-1">
          {day.notes.length > 0 && <span className="h-1 w-3.5 rounded-full bg-accent" title={t('calendar.recorded')} />}
          {day.entries.map((entry) => (
            <EntryMarker key={`${entry.schedule.id}-${entry.date}`} entry={entry} />
          ))}
        </span>
      </button>

      {hasContent && (
        <div className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-1.5 hidden w-44 -translate-x-1/2 rounded-xl border border-border-color bg-bg-primary p-2.5 text-xs shadow-e2 group-hover:block">
          <p className="mb-1 font-semibold text-text-primary">{day.dateKey.slice(5).replace('-', '/')}</p>
          <div className="space-y-0.5 text-text-secondary">
            {day.anniversaries.map((item) => (
              <p key={item.id} className="flex items-center gap-1.5 truncate">
                <Cake size={11} className="shrink-0 text-amber-500" />{item.label}
              </p>
            ))}
            {day.entries.map((entry) => (
              <p key={`${entry.schedule.id}-${entry.date}`} className="flex items-center gap-1.5 truncate">
                <Video size={11} className="shrink-0 text-accent" />
                {entry.schedule.title || t('calendar.untitledSchedule')}
                {entry.schedule.time && <span className="text-text-muted">{entry.schedule.time}</span>}
              </p>
            ))}
            {day.notes.map((note) => (
              <p key={note.id} className="flex items-center gap-1.5 truncate">
                <FileText size={11} className="shrink-0 text-accent" />{note.title || t('common.untitled')}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function EntryMarker({ entry }: { entry: DayScheduleEntry }) {
  if (entry.state === 'recorded' || entry.state === 'done') {
    return <span className="h-1 w-3.5 rounded-full bg-accent/70" />
  }
  if (entry.state === 'missed') {
    return <span className="w-3.5 border-t-[2.5px] border-dashed border-text-muted/50" />
  }
  return <span className="w-3.5 border-t-[2.5px] border-dashed border-accent/60" />
}

function DayDetail({
  day,
  archiveNameById,
  onOpenNote,
  onResolve,
  onRestore,
  onClose,
}: {
  day: CalendarDayModel
  archiveNameById: Map<string, string>
  onOpenNote: (noteId: string) => void
  onResolve: (entry: DayScheduleEntry, status: 'done' | 'cancelled', noteId?: string | null) => void
  onRestore: (entry: DayScheduleEntry) => void
  onClose: () => void
}) {
  const { t, locale } = useI18n()
  const timing = useMotionTiming()
  const dateLabel = new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : locale === 'ja' ? 'ja-JP' : 'en-US', { month: 'long', day: 'numeric', weekday: 'long' }).format(dateKeyToDate(day.dateKey))

  return (
    <motion.div
      initial={timing.micro > 0 ? { opacity: 0, height: 0 } : false}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: timing.micro + 0.07, ease: 'easeOut' }}
      className="overflow-hidden"
    >
      <div className="mt-3 rounded-xl bg-bg-secondary/35 px-3.5 py-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-text-primary">{dateLabel}</p>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-text-muted transition-colors hover:bg-bg-tertiary hover:text-text-primary" aria-label={t('common.cancel')}>
            <X size={15} />
          </button>
        </div>
        <div className="divide-y divide-border-color/40">
          {day.anniversaries.map((item) => (
            <div key={item.id} className="flex items-center gap-2 px-2 py-2 text-sm text-text-primary">
              <Cake size={14} className="shrink-0 text-amber-500" />
              <span className="font-medium">{item.label}</span>
              <span className="text-xs text-text-muted">{t(`calendar.anniversaryKind.${item.kind}`)}</span>
            </div>
          ))}
          {day.entries.map((entry) => (
            <div key={`${entry.schedule.id}-${entry.date}`} className="flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-bg-secondary/50">
              <Video size={14} className="shrink-0 text-accent" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">{entry.schedule.title || t('calendar.untitledSchedule')}</p>
                <p className="flex items-center gap-2 text-xs text-text-muted">
                  {entry.schedule.time && <span className="inline-flex items-center gap-1"><Clock size={11} />{entry.schedule.time}</span>}
                  {entry.schedule.archive_id && <span>{archiveNameById.get(entry.schedule.archive_id) || ''}</span>}
                  <EntryStateLabel state={entry.state} t={t} />
                </p>
              </div>
              {entry.state === 'missed' && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onResolve(entry, 'done', entry.matchedNote?.id || day.notes[0]?.id || null)}
                    className="rounded-md bg-accent/10 px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
                  >
                    {t('calendar.markDone')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onResolve(entry, 'cancelled')}
                    className="rounded-md px-2 py-1 text-xs font-medium text-text-muted transition-colors hover:bg-bg-tertiary hover:text-text-primary"
                  >
                    {t('calendar.markCancelled')}
                  </button>
                </div>
              )}
              {entry.override && (
                <button
                  type="button"
                  onClick={() => onRestore(entry)}
                  className="shrink-0 rounded-md p-1 text-text-muted transition-colors hover:bg-bg-tertiary hover:text-text-primary"
                  title={t('calendar.restoreAuto')}
                >
                  <RotateCcw size={13} />
                </button>
              )}
            </div>
          ))}
          {day.notes.map((note) => (
            <button
              key={note.id}
              type="button"
              onClick={() => onOpenNote(note.id)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-bg-secondary/50"
            >
              <FileText size={14} className="shrink-0 text-accent" />
              <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{note.title || t('common.untitled')}</span>
              <span className="shrink-0 text-xs text-text-muted">{note.created_at.slice(11, 16)}</span>
            </button>
          ))}
          {day.entries.length === 0 && day.notes.length === 0 && day.anniversaries.length === 0 && (
            <p className="py-1 text-sm text-text-muted">{t('calendar.emptyDay')}</p>
          )}
          {day.entries.length === 0 && day.notes.length > 0 && (
            <p className="flex items-center gap-1.5 px-1 pt-1 text-xs text-text-muted">
              <Radio size={11} />
              {t('calendar.unscheduledNoteHint')}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function EntryStateLabel({ state, t }: { state: DayScheduleEntry['state']; t: ReturnType<typeof useI18n>['t'] }) {
  if (state === 'recorded' || state === 'done') return <span className="text-accent">{t('calendar.state.done')}</span>
  if (state === 'missed') return <span className="text-amber-600">{t('calendar.state.missed')}</span>
  return <span>{t('calendar.state.scheduled')}</span>
}
