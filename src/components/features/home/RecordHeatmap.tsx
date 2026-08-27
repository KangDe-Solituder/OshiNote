import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { Flame } from 'lucide-react'
import type { CalendarNote, Oshi } from '../../../types'
import {
  buildHeatmapGrid,
  getColumnMonthLabels,
  getRangeStartKey,
  type HeatmapCell,
  type HeatmapRange,
} from '../../../features/home/heatmapModel'
import { fetchDailyActivity, fetchDayNotes } from '../../../features/schedule/scheduleService'
import { toLocalDateKey } from '../../../features/schedule/scheduleModel'
import { fetchAllOshis } from '../../../features/oshis/oshiService'
import { SelectMenu } from '../../ui/SelectMenu'
import { useI18n } from '../../../i18n/useI18n'

const CELL_LEVEL_CLASSES = [
  'bg-bg-tertiary/70',
  'bg-accent/25',
  'bg-accent/45',
  'bg-accent/70',
  'bg-accent',
] as const

export function RecordHeatmap() {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const [range, setRange] = useState<HeatmapRange>('quarter')
  const [oshis, setOshis] = useState<Oshi[]>([])
  const [activity, setActivity] = useState<Map<string, { date: string; notes: number; illustrations: number; journalPages: number }>>(new Map())
  const [dayNotesCache, setDayNotesCache] = useState<Map<string, (CalendarNote & { oshi_id: string | null })[]>>(new Map())
  const requestRef = useRef(0)
  const todayKey = toLocalDateKey(new Date())

  useEffect(() => {
    fetchAllOshis().then(setOshis).catch(() => {})
  }, [])

  useEffect(() => {
    const requestId = ++requestRef.current
    const startKey = getRangeStartKey(range, new Date())
    fetchDailyActivity(startKey, todayKey)
      .then((map) => {
        if (requestRef.current === requestId) setActivity(map)
      })
      .catch(() => {})
  }, [range, todayKey])

  const weeks = useMemo(
    () => buildHeatmapGrid(activity, getRangeStartKey(range, new Date()), todayKey),
    [activity, range, todayKey]
  )
  const monthLabels = useMemo(() => getColumnMonthLabels(weeks), [weeks])
  const oshiNameById = useMemo(() => new Map(oshis.map((oshi) => [oshi.id, oshi.name])), [oshis])

  function prefetchDayNotes(dateKey: string) {
    if (dayNotesCache.has(dateKey)) return
    fetchDayNotes(dateKey)
      .then((rows) => setDayNotesCache((current) => new Map(current).set(dateKey, rows)))
      .catch(() => {})
  }

  const localeTag = locale === 'zh' ? 'zh-CN' : locale === 'ja' ? 'ja-JP' : 'en-US'

  return (
    <section className="rounded-2xl border border-border-color bg-bg-card p-5 shadow-e1">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-soft/30 text-accent">
          <Flame size={16} />
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold text-text-primary">{t('heatmap.title')}</h2>
          <p className="text-xs text-text-muted">{t('heatmap.subtitle')}</p>
        </div>
        <div className="ml-auto">
          <SelectMenu
            value={range}
            onChange={(value) => setRange(value as HeatmapRange)}
            options={[
              { value: 'month', label: t('heatmap.range.month') },
              { value: 'quarter', label: t('heatmap.range.quarter') },
              { value: 'year', label: t('heatmap.range.year') },
            ]}
            ariaLabel={t('heatmap.rangeLabel')}
            size="sm"
            menuAlign="right"
          />
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="inline-block">
          <div className="mb-1 grid auto-cols-[14px] grid-flow-col gap-[3px] text-[10px] text-text-muted">
            {monthLabels.map((label, index) => (
              <span key={index} className="col-span-1 overflow-visible whitespace-nowrap">
                {label ? new Intl.DateTimeFormat(localeTag, { month: 'short' }).format(new Date(2026, Number(label) - 1, 1)) : ''}
              </span>
            ))}
          </div>
          <div className="grid auto-cols-[14px] grid-flow-col grid-rows-7 gap-[3px]">
            {weeks.map((week) =>
              week.map((cell) => (
                <HeatmapCellView
                  key={cell.date}
                  cell={cell}
                  notes={dayNotesCache.get(cell.date)}
                  oshiNameById={oshiNameById}
                  localeTag={localeTag}
                  onHover={prefetchDayNotes}
                  onOpenNote={(noteId) => navigate(`/notes/${noteId}`)}
                  t={t}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-text-muted">
        <span>{t('heatmap.less')}</span>
        {CELL_LEVEL_CLASSES.map((levelClass, index) => (
          <span key={index} className={clsx('h-2.5 w-2.5 rounded-[3px]', levelClass)} />
        ))}
        <span>{t('heatmap.more')}</span>
      </div>
    </section>
  )
}

function HeatmapCellView({
  cell,
  notes,
  oshiNameById,
  localeTag,
  onHover,
  onOpenNote,
  t,
}: {
  cell: HeatmapCell
  notes: (CalendarNote & { oshi_id: string | null })[] | undefined
  oshiNameById: Map<string, string>
  localeTag: string
  onHover: (dateKey: string) => void
  onOpenNote: (noteId: string) => void
  t: ReturnType<typeof useI18n>['t']
}) {
  const dateLabel = new Intl.DateTimeFormat(localeTag, { month: 'numeric', day: 'numeric', weekday: 'short' }).format(
    new Date(`${cell.date}T00:00:00`)
  )

  return (
    <div className="group relative">
      <button
        type="button"
        aria-label={cell.date}
        onMouseEnter={() => cell.total > 0 && onHover(cell.date)}
        onClick={() => notes?.[0] && onOpenNote(notes[0].id)}
        className={clsx(
          'h-[14px] w-[14px] rounded-[3px] transition-transform',
          CELL_LEVEL_CLASSES[cell.level],
          cell.future && 'opacity-25',
          cell.total > 0 && 'cursor-pointer hover:scale-125 hover:ring-1 hover:ring-accent/60'
        )}
      />
      {cell.total > 0 && !cell.future && (
        <div className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-1.5 hidden w-48 -translate-x-1/2 rounded-xl border border-border-color bg-bg-primary p-2.5 text-xs shadow-e2 group-hover:block">
          <p className="mb-1 font-semibold text-text-primary">{dateLabel}</p>
          <p className="text-text-secondary">
            {t('heatmap.tooltipCounts', { notes: cell.notes, illustrations: cell.illustrations, journalPages: cell.journalPages })}
          </p>
          {notes && notes.length > 0 && (
            <div className="mt-1 space-y-0.5 border-t border-border-color pt-1">
              {notes.slice(0, 3).map((note) => (
                <p key={note.id} className="truncate text-text-muted">
                  <span className="text-accent">{note.oshi_id ? oshiNameById.get(note.oshi_id) || '' : ''}</span>
                  {note.oshi_id ? ' · ' : ''}
                  {note.title || t('common.untitled')}
                </p>
              ))}
              {notes.length > 3 && <p className="text-text-muted">+{notes.length - 3}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
