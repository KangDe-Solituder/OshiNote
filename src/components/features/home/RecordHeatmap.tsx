import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { Flame } from 'lucide-react'
import type { CalendarNote, Oshi } from '../../../types'
import {
  buildHeatmapGrid,
  buildMonthRows,
  getColumnMonthLabels,
  getRangeStartKey,
  type HeatmapCell,
  type HeatmapRange,
  type MonthRow,
} from '../../../features/home/heatmapModel'
import { fetchDailyActivity, fetchDayNotes } from '../../../features/schedule/scheduleService'
import { toLocalDateKey } from '../../../features/schedule/scheduleModel'
import { fetchAllOshis } from '../../../features/oshis/oshiService'
import { SelectMenu } from '../../ui/SelectMenu'
import { useI18n } from '../../../i18n/useI18n'

interface HoveredCell {
  cell: HeatmapCell
  rect: DOMRect
}

export function RecordHeatmap() {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const [range, setRange] = useState<HeatmapRange>('quarter')
  const [oshis, setOshis] = useState<Oshi[]>([])
  const [activity, setActivity] = useState<Map<string, { date: string; notes: number; illustrations: number; journalPages: number }>>(new Map())
  const [dayNotesCache, setDayNotesCache] = useState<Map<string, (CalendarNote & { oshi_id: string | null })[]>>(new Map())
  const [hovered, setHovered] = useState<HoveredCell | null>(null)
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

  const startKey = getRangeStartKey(range, new Date())
  const weeks = useMemo(() => buildHeatmapGrid(activity, startKey, todayKey), [activity, startKey, todayKey])
  const monthRows = useMemo(() => buildMonthRows(activity, startKey, todayKey), [activity, startKey, todayKey])
  const monthLabels = useMemo(() => getColumnMonthLabels(weeks), [weeks])
  const oshiNameById = useMemo(() => new Map(oshis.map((oshi) => [oshi.id, oshi.name])), [oshis])

  function handleEnter(cell: HeatmapCell, target: HTMLElement) {
    if (cell.total > 0 && !dayNotesCache.has(cell.date)) {
      fetchDayNotes(cell.date)
        .then((rows) => setDayNotesCache((current) => new Map(current).set(cell.date, rows)))
        .catch(() => {})
    }
    setHovered({ cell, rect: target.getBoundingClientRect() })
  }

  const localeTag = locale === 'zh' ? 'zh-CN' : locale === 'ja' ? 'ja-JP' : 'en-US'
  const hoveredNotes = hovered ? dayNotesCache.get(hovered.cell.date) : undefined

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
            onChange={(value) => { setRange(value as HeatmapRange); setHovered(null) }}
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

      {range === 'year' ? (
        <div className="overflow-x-auto pb-1">
          <div className="inline-block">
            <div className="mb-1.5 flex gap-[3px] text-[10px] leading-none text-text-muted">
              {monthLabels.map((label, index) => (
                <span key={index} className="w-[15px] shrink-0 overflow-visible whitespace-nowrap">
                  {label ? new Intl.DateTimeFormat(localeTag, { month: 'short' }).format(new Date(2026, Number(label) - 1, 1)) : ''}
                </span>
              ))}
            </div>
            <div className="flex gap-[3px]">
              {weeks.map((week) => (
                <div key={week[0].date} className="flex flex-col gap-[3px]">
                  {week.map((cell) => (
                    <HeatmapDot key={cell.date} cell={cell} onEnter={handleEnter} onLeave={() => setHovered(null)} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {monthRows.map((row) => (
            <MonthStrip
              key={row.monthKey}
              row={row}
              localeTag={localeTag}
              onEnter={handleEnter}
              onLeave={() => setHovered(null)}
            />
          ))}
        </div>
      )}

      {hovered && hovered.cell.total > 0 && !hovered.cell.future && (
        <HeatmapTooltip
          hovered={hovered}
          notes={hoveredNotes}
          oshiNameById={oshiNameById}
          localeTag={localeTag}
          onOpenNote={(noteId) => navigate(`/notes/${noteId}`)}
          t={t}
        />
      )}
    </section>
  )
}

function HeatmapDot({
  cell,
  onEnter,
  onLeave,
}: {
  cell: HeatmapCell
  onEnter: (cell: HeatmapCell, target: HTMLElement) => void
  onLeave: () => void
}) {
  return (
    <button
      type="button"
      aria-label={cell.date}
      onMouseEnter={(event) => onEnter(cell, event.currentTarget)}
      onMouseLeave={onLeave}
      className={clsx(
        'h-[15px] w-[15px] rounded-[4px] transition-transform',
        cell.total > 0 ? 'bg-accent' : 'bg-bg-tertiary/70',
        cell.future && 'opacity-25',
        cell.total > 0 && 'cursor-pointer hover:scale-125'
      )}
    />
  )
}

function MonthStrip({
  row,
  localeTag,
  onEnter,
  onLeave,
}: {
  row: MonthRow
  localeTag: string
  onEnter: (cell: HeatmapCell, target: HTMLElement) => void
  onLeave: () => void
}) {
  const monthLabel = new Intl.DateTimeFormat(localeTag, { year: 'numeric', month: 'short' }).format(
    new Date(Number(row.monthKey.slice(0, 4)), Number(row.monthKey.slice(5, 7)) - 1, 1)
  )
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-right text-xs font-medium text-text-muted">{monthLabel}</span>
      <div className="flex flex-1 gap-[3px]">
        {row.cells.map((cell) => (
          <button
            key={cell.date}
            type="button"
            aria-label={cell.date}
            onMouseEnter={(event) => onEnter(cell, event.currentTarget)}
            onMouseLeave={onLeave}
            className={clsx(
              'h-[18px] min-w-[10px] flex-1 rounded-[4px] transition-transform',
              cell.total > 0 ? 'bg-accent' : 'bg-bg-tertiary/70',
              cell.future && 'opacity-25',
              cell.total > 0 && 'cursor-pointer hover:scale-y-125'
            )}
          />
        ))}
      </div>
    </div>
  )
}

function HeatmapTooltip({
  hovered,
  notes,
  oshiNameById,
  localeTag,
  onOpenNote,
  t,
}: {
  hovered: HoveredCell
  notes: (CalendarNote & { oshi_id: string | null })[] | undefined
  oshiNameById: Map<string, string>
  localeTag: string
  onOpenNote: (noteId: string) => void
  t: ReturnType<typeof useI18n>['t']
}) {
  const { cell, rect } = hovered
  const dateLabel = new Intl.DateTimeFormat(localeTag, { month: 'numeric', day: 'numeric', weekday: 'short' }).format(
    new Date(`${cell.date}T00:00:00`)
  )

  const width = 208
  const left = Math.min(Math.max(rect.left + rect.width / 2, 12 + width / 2), window.innerWidth - 12 - width / 2)
  const showBelow = rect.top < 170
  const position = showBelow
    ? { top: rect.bottom + 8 }
    : { bottom: window.innerHeight - rect.top + 8 }

  const tooltip = (
    <div
      className="pointer-events-auto fixed z-[90] rounded-xl border border-border-color bg-bg-primary p-3 text-xs shadow-e2"
      style={{ left, transform: 'translateX(-50%)', width, ...position }}
    >
      <p className="mb-1 font-semibold text-text-primary">{dateLabel}</p>
      <p className="text-text-secondary">
        {t('heatmap.tooltipCounts', { notes: cell.notes, illustrations: cell.illustrations, journalPages: cell.journalPages })}
      </p>
      {notes && notes.length > 0 && (
        <div className="mt-1.5 space-y-0.5 border-t border-border-color pt-1.5">
          {notes.slice(0, 3).map((note) => (
            <button
              key={note.id}
              type="button"
              onClick={() => onOpenNote(note.id)}
              className="block w-full truncate rounded text-left text-text-muted transition-colors hover:text-accent"
            >
              <span className="text-accent">{note.oshi_id ? oshiNameById.get(note.oshi_id) || '' : ''}</span>
              {note.oshi_id ? ' · ' : ''}
              {note.title || t('common.untitled')}
            </button>
          ))}
          {notes.length > 3 && <p className="text-text-muted">+{notes.length - 3}</p>}
        </div>
      )}
    </div>
  )

  return createPortal(tooltip, document.body)
}
