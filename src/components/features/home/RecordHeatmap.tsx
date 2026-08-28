import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
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
import { MOTION_EASING, useMotionTiming } from '../themes/uiMotion'
import { useI18n } from '../../../i18n/useI18n'

const CELL_LEVEL_CLASSES = [
  'bg-bg-tertiary/45',
  'bg-accent/25',
  'bg-accent/45',
  'bg-accent/70',
  'bg-accent',
] as const

interface HoveredCell {
  cell: HeatmapCell
  rect: DOMRect
}

export function RecordHeatmap() {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const timing = useMotionTiming()
  const initialRange = getHeatmapRangeFromSearch(location.search)
  const [range, setRange] = useState<HeatmapRange>(initialRange)
  const [oshis, setOshis] = useState<Oshi[]>([])
  const [activity, setActivity] = useState<Map<string, { date: string; notes: number; illustrations: number; journalPages: number }>>(new Map())
  const [dayNotesCache, setDayNotesCache] = useState<Map<string, (CalendarNote & { oshi_id: string | null })[]>>(new Map())
  const [hovered, setHovered] = useState<HoveredCell | null>(null)
  const [selected, setSelected] = useState<HoveredCell | null>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const requestRef = useRef(0)
  const closeTimerRef = useRef<number | null>(null)
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

  useEffect(() => () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current)
  }, [])

  const startKey = getRangeStartKey(range, new Date())
  const weeks = useMemo(() => buildHeatmapGrid(activity, startKey, todayKey), [activity, startKey, todayKey])
  const monthRows = useMemo(() => buildMonthRows(activity, startKey, todayKey), [activity, startKey, todayKey])
  const monthLabels = useMemo(() => getColumnMonthLabels(weeks), [weeks])
  const oshiNameById = useMemo(() => new Map(oshis.map((oshi) => [oshi.id, oshi.name])), [oshis])

  useEffect(() => {
    const selectedDate = new URLSearchParams(location.search).get('heatmapDate')
    if (!selectedDate) {
      setSelected(null)
      return
    }
    const cells = range === 'year' ? weeks.flat() : monthRows.flatMap((row) => row.cells)
    const cell = cells.find((candidate) => candidate.date === selectedDate)
    const target = sectionRef.current?.querySelector<HTMLElement>(`[data-heatmap-date="${selectedDate}"]`)
    if (cell && target) setSelected({ cell, rect: target.getBoundingClientRect() })
  }, [location.search, monthRows, range, weeks])

  useEffect(() => {
    if (!selected) return

    function handleOutsidePointerDown(event: PointerEvent) {
      if (!(event.target instanceof Element)) return
      if (event.target.closest('[data-heatmap-date], [data-heatmap-tooltip]')) return

      cancelClose()
      setSelected(null)
      setHovered(null)
      updateSelectionUrl(null)
    }

    document.addEventListener('pointerdown', handleOutsidePointerDown)
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown)
  })

  useEffect(() => {
    if (location.hash !== '#record-heatmap') return
    const frame = window.requestAnimationFrame(() => sectionRef.current?.scrollIntoView({ block: 'center' }))
    return () => window.cancelAnimationFrame(frame)
  }, [location.hash])

  function handleEnter(cell: HeatmapCell, target: HTMLElement) {
    if (selected) return
    cancelClose()
    ensureDayNotes(cell)
    setHovered({ cell, rect: target.getBoundingClientRect() })
  }

  function handleSelect(cell: HeatmapCell, target: HTMLElement) {
    if (cell.total <= 0 || cell.future) return
    cancelClose()
    if (selected?.cell.date === cell.date) {
      setSelected(null)
      setHovered(null)
      updateSelectionUrl(null)
      return
    }
    ensureDayNotes(cell)
    setHovered(null)
    setSelected({ cell, rect: target.getBoundingClientRect() })
    updateSelectionUrl(cell.date)
  }

  function ensureDayNotes(cell: HeatmapCell) {
    if (cell.total <= 0 || dayNotesCache.has(cell.date)) return
    fetchDayNotes(cell.date)
      .then((rows) => setDayNotesCache((current) => new Map(current).set(cell.date, rows)))
      .catch(() => {})
  }

  function updateSelectionUrl(date: string | null) {
    const search = new URLSearchParams(location.search)
    if (date) {
      search.set('heatmapDate', date)
      search.set('heatmapRange', range)
    } else {
      search.delete('heatmapDate')
      search.delete('heatmapRange')
    }
    navigate({ pathname: location.pathname, search: search.toString(), hash: date ? '#record-heatmap' : '' }, { replace: true })
  }

  function cancelClose() {
    if (closeTimerRef.current === null) return
    window.clearTimeout(closeTimerRef.current)
    closeTimerRef.current = null
  }

  function scheduleClose() {
    if (selected) return
    cancelClose()
    closeTimerRef.current = window.setTimeout(() => {
      setHovered(null)
      closeTimerRef.current = null
    }, 180)
  }

  const localeTag = locale === 'zh' ? 'zh-CN' : locale === 'ja' ? 'ja-JP' : 'en-US'
  const displayed = selected || hovered
  const displayedNotes = displayed ? dayNotesCache.get(displayed.cell.date) : undefined
  const animated = timing.micro > 0

  return (
    <section id="record-heatmap" ref={sectionRef} className="rounded-2xl border border-border-color bg-bg-card p-5 shadow-e1">
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
            onChange={(value) => {
              cancelClose()
              setRange(value as HeatmapRange)
              setHovered(null)
              setSelected(null)
              updateSelectionUrl(null)
            }}
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

      <AnimatePresence mode="wait" initial={false}>
        {range === 'year' ? (
          <motion.div
            key="year"
            initial={animated ? { opacity: 0, y: 8 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: timing.micro + 0.12, ease: MOTION_EASING.enter }}
          >
            <div className="mb-1.5 flex gap-[3px] text-[10px] leading-none text-text-muted">
              {monthLabels.map((label, index) => (
                <span key={index} className="min-w-0 flex-1 overflow-visible whitespace-nowrap">
                  {label ? new Intl.DateTimeFormat(localeTag, { month: 'short' }).format(new Date(2026, Number(label) - 1, 1)) : ''}
                </span>
              ))}
            </div>
            <div className="flex gap-[3px]">
              {weeks.map((week, weekIndex) => (
                <motion.div
                  key={week[0].date}
                  className="flex min-w-0 flex-1 flex-col gap-[3px]"
                  initial={animated ? { opacity: 0, y: 5 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: timing.micro + 0.14, delay: Math.min(weekIndex * 0.007, 0.36), ease: MOTION_EASING.enter }}
                >
                  {week.map((cell) => (
                    <HeatmapDot
                      key={cell.date}
                      cell={cell}
                      stretch
                      selected={selected?.cell.date === cell.date}
                      onEnter={handleEnter}
                      onLeave={scheduleClose}
                      onSelect={handleSelect}
                    />
                  ))}
                </motion.div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={range}
            className="space-y-3.5"
            initial={animated ? { opacity: 0, y: 8 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: timing.micro + 0.12, ease: MOTION_EASING.enter }}
          >
            {monthRows.map((row, rowIndex) => (
              <motion.div
                key={row.monthKey}
                initial={animated ? { opacity: 0, x: -10 } : false}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: timing.micro + 0.14, delay: rowIndex * 0.055, ease: MOTION_EASING.enter }}
              >
                <MonthStrip
                  row={row}
                  localeTag={localeTag}
                  selectedDate={selected?.cell.date || null}
                  onEnter={handleEnter}
                  onLeave={scheduleClose}
                  onSelect={handleSelect}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-text-muted">
        <span>{t('heatmap.less')}</span>
        {CELL_LEVEL_CLASSES.map((levelClass, index) => (
          <span key={index} className={clsx('h-2.5 w-2.5 rounded-[3px]', levelClass)} />
        ))}
        <span>{t('heatmap.more')}</span>
      </div>

      {displayed && displayed.cell.total > 0 && !displayed.cell.future && (
        <HeatmapTooltip
          hovered={displayed}
          notes={displayedNotes}
          oshiNameById={oshiNameById}
          localeTag={localeTag}
          onOpenNote={(noteId) => navigate(`/notes/${noteId}`, {
            state: { returnTo: `${location.pathname}${location.search}#record-heatmap` },
          })}
          onEnter={cancelClose}
          onLeave={scheduleClose}
          t={t}
        />
      )}
    </section>
  )
}

function HeatmapDot({
  cell,
  stretch = false,
  selected,
  onEnter,
  onLeave,
  onSelect,
}: {
  cell: HeatmapCell
  stretch?: boolean
  selected: boolean
  onEnter: (cell: HeatmapCell, target: HTMLElement) => void
  onLeave: () => void
  onSelect: (cell: HeatmapCell, target: HTMLElement) => void
}) {
  return (
    <button
      type="button"
      aria-label={cell.date}
      aria-pressed={selected}
      data-heatmap-date={cell.date}
      onMouseEnter={(event) => onEnter(cell, event.currentTarget)}
      onMouseLeave={onLeave}
      onFocus={(event) => onEnter(cell, event.currentTarget)}
      onBlur={onLeave}
      onClick={(event) => onSelect(cell, event.currentTarget)}
      className={clsx(
        'rounded-[4px] transition-transform',
        stretch ? 'h-[15px] w-full' : 'h-[15px] w-[15px]',
        CELL_LEVEL_CLASSES[cell.level],
        cell.future && 'opacity-25',
        cell.total > 0 && 'cursor-pointer hover:scale-110',
        selected && 'z-10 scale-125 ring-2 ring-accent ring-offset-2 ring-offset-bg-card'
      )}
    />
  )
}

function MonthStrip({
  row,
  localeTag,
  selectedDate,
  onEnter,
  onLeave,
  onSelect,
}: {
  row: MonthRow
  localeTag: string
  selectedDate: string | null
  onEnter: (cell: HeatmapCell, target: HTMLElement) => void
  onLeave: () => void
  onSelect: (cell: HeatmapCell, target: HTMLElement) => void
}) {
  const monthLabel = new Intl.DateTimeFormat(localeTag, { year: 'numeric', month: 'short' }).format(
    new Date(Number(row.monthKey.slice(0, 4)), Number(row.monthKey.slice(5, 7)) - 1, 1)
  )
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-right text-xs font-medium text-text-muted">{monthLabel}</span>
      <div className="flex flex-1 gap-[4px]">
        {row.cells.map((cell) => (
          <button
            key={cell.date}
            type="button"
            aria-label={cell.date}
            aria-pressed={selectedDate === cell.date}
            data-heatmap-date={cell.date}
            onMouseEnter={(event) => onEnter(cell, event.currentTarget)}
            onMouseLeave={onLeave}
            onFocus={(event) => onEnter(cell, event.currentTarget)}
            onBlur={onLeave}
            onClick={(event) => onSelect(cell, event.currentTarget)}
            className={clsx(
              'h-[24px] min-w-[10px] flex-1 rounded-[5px] transition-transform',
              CELL_LEVEL_CLASSES[cell.level],
              cell.future && 'opacity-25',
              cell.total > 0 && 'cursor-pointer hover:scale-y-110',
              selectedDate === cell.date && 'z-10 scale-y-125 ring-2 ring-accent ring-offset-2 ring-offset-bg-card'
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
  onEnter,
  onLeave,
  t,
}: {
  hovered: HoveredCell
  notes: (CalendarNote & { oshi_id: string | null })[] | undefined
  oshiNameById: Map<string, string>
  localeTag: string
  onOpenNote: (noteId: string) => void
  onEnter: () => void
  onLeave: () => void
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
      data-heatmap-tooltip
      className="pointer-events-auto fixed z-[90] rounded-xl border border-border-color bg-bg-primary p-3 text-xs shadow-e2"
      style={{ left, transform: 'translateX(-50%)', width, ...position }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocusCapture={onEnter}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onLeave()
      }}
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

function getHeatmapRangeFromSearch(search: string): HeatmapRange {
  const value = new URLSearchParams(search).get('heatmapRange')
  return value === 'month' || value === 'quarter' || value === 'year' ? value : 'year'
}
