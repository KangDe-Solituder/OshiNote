import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { Cake, Check, Pencil, Plus, RotateCcw, Trash2, Video } from 'lucide-react'
import type { Archive, CalendarNote, Oshi, OshiAnniversary, OshiSchedule, OshiScheduleOverride } from '../../../types'
import { generateId } from '../../../database'
import {
  clearOccurrenceOverride,
  createSchedule,
  deleteSchedule,
  fetchCalendarNotes,
  fetchOverrides,
  updateSchedule,
  type ScheduleInput,
} from '../../../features/schedule/scheduleService'
import { isValidAnniversaryDate, matchScheduleToNotes, toLocalDateKey } from '../../../features/schedule/scheduleModel'
import { fetchArchivesByOshi } from '../../../features/oshis/archiveService'
import { updateOshi } from '../../../features/oshis/oshiService'
import { Modal } from '../../ui/Modal'
import { Button } from '../../ui/Button'
import { SelectMenu } from '../../ui/SelectMenu'
import { useMotionTiming } from '../themes/uiMotion'
import { useI18n } from '../../../i18n/useI18n'

interface ScheduleManagerProps {
  open: boolean
  oshi: Oshi
  schedules: OshiSchedule[]
  initialEditId?: string | null
  onClose: () => void
  onChanged: () => void
}

const WEEKDAY_OPTION_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

export function ScheduleManager({ open, oshi, schedules, initialEditId, onClose, onChanged }: ScheduleManagerProps) {
  const { t } = useI18n()
  const timing = useMotionTiming()
  const [tab, setTab] = useState<'schedules' | 'anniversaries'>('schedules')
  const [archives, setArchives] = useState<Archive[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ScheduleInput>({ title: '', archive_id: '', kind: 'weekly', weekday: 2, date: null, time: null })
  const [calendarNotes, setCalendarNotes] = useState<CalendarNote[]>([])
  const [weekOverrides, setWeekOverrides] = useState<OshiScheduleOverride[]>([])

  function resetDraft() {
    setDraft({ title: '', archive_id: '', kind: 'weekly', weekday: 2, date: null, time: null })
  }

  function startEdit(schedule: OshiSchedule) {
    setEditingId(schedule.id)
    setDraft({
      title: schedule.title,
      archive_id: schedule.archive_id,
      kind: schedule.kind,
      weekday: schedule.weekday ?? 2,
      date: schedule.date,
      time: schedule.time,
    })
  }

  useEffect(() => {
    if (!open) return
    resetDraft()
    fetchArchivesByOshi(oshi.id).then(setArchives).catch(() => setArchives([]))
    if (initialEditId) {
      const target = schedules.find((schedule) => schedule.id === initialEditId)
      setTab('schedules')
      if (target) startEdit(target)
    } else {
      setEditingId(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, oshi.id, initialEditId])

  useEffect(() => {
    if (!open) return
    const todayKey = toLocalDateKey(new Date())
    const mondayOffset = (new Date().getDay() + 6) % 7
    const monday = new Date()
    monday.setDate(monday.getDate() - mondayOffset)
    const weekStart = toLocalDateKey(monday)
    const weekEnd = toLocalDateKey(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6))

    const onceDates = schedules
      .filter((schedule) => schedule.kind === 'once' && schedule.date && schedule.date <= todayKey)
      .map((schedule) => schedule.date as string)
    const earliest = onceDates.sort()[0]

    fetchOverrides(oshi.id, weekStart, weekEnd).then(setWeekOverrides).catch(() => setWeekOverrides([]))
    if (earliest) {
      fetchCalendarNotes(oshi.id, earliest, todayKey).then(setCalendarNotes).catch(() => setCalendarNotes([]))
    } else {
      setCalendarNotes([])
    }
  }, [open, oshi.id, schedules])

  async function handleSaveSchedule() {
    const payload: ScheduleInput = {
      title: draft.title.trim(),
      archive_id: draft.archive_id,
      kind: draft.kind,
      weekday: draft.kind === 'weekly' ? draft.weekday ?? 2 : null,
      date: draft.kind === 'once' ? draft.date || null : null,
      time: draft.time || null,
    }
    if (draft.kind === 'once' && !payload.date) return
    if (editingId) {
      await updateSchedule(editingId, payload)
    } else {
      await createSchedule(oshi.id, payload)
    }
    setEditingId(null)
    setDraft({ title: '', archive_id: '', kind: 'weekly', weekday: 2, date: null, time: null })
    onChanged()
  }

  async function handleDeleteSchedule(id: string) {
    await deleteSchedule(id)
    if (editingId === id) setEditingId(null)
    onChanged()
  }

  async function handleUndoSkip(schedule: OshiSchedule) {
    const date = thisWeekOccurrenceDate(schedule)
    if (!date) return
    await clearOccurrenceOverride(schedule.id, date)
    onChanged()
  }

  const todayKey = toLocalDateKey(new Date())
  const notesByDay = new Map<string, CalendarNote[]>()
  for (const note of calendarNotes) {
    const key = note.created_at.slice(0, 10)
    notesByDay.set(key, [...(notesByDay.get(key) || []), note])
  }
  // Matched or already-resolved once schedules have done their job — hide them from the list.
  const onceList = schedules.filter((schedule) => {
    if (schedule.kind !== 'once' || !schedule.date) return false
    if (schedule.status !== 'active') return false
    if (schedule.date > todayKey) return true
    return !matchScheduleToNotes(schedule, notesByDay.get(schedule.date) || [])
  })
  const weeklyList = schedules.filter((schedule) => schedule.kind === 'weekly')
  const skippedThisWeek = new Set(
    weeklyList
      .filter((schedule) => {
        const date = thisWeekOccurrenceDate(schedule)
        return date != null && weekOverrides.some((item) => item.schedule_id === schedule.id && item.date === date && item.status === 'cancelled')
      })
      .map((schedule) => schedule.id)
  )

  function thisWeekOccurrenceDate(schedule: OshiSchedule): string | null {
    if (schedule.weekday == null) return null
    const today = new Date()
    const mondayOffset = (today.getDay() + 6) % 7
    const monday = new Date(today)
    monday.setDate(today.getDate() - mondayOffset)
    const date = new Date(monday)
    date.setDate(monday.getDate() + ((schedule.weekday + 6) % 7))
    return toLocalDateKey(date)
  }

  async function handleAnniversariesChange(next: OshiAnniversary[]) {
    await updateOshi(oshi.id, { anniversaries: next })
    onChanged()
  }

  return (
    <Modal open={open} onClose={onClose} title={t('calendar.manageTitle')} contentClassName="max-w-2xl">
      <div className="mb-4 flex gap-1 rounded-xl bg-bg-secondary/60 p-1">
        {(['schedules', 'anniversaries'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={clsx(
              'flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              tab === value ? 'bg-bg-primary text-accent shadow-sm' : 'text-text-secondary hover:text-text-primary'
            )}
          >
            {t(`calendar.tab.${value}`)}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={timing.micro > 0 ? { opacity: 0, x: tab === 'schedules' ? -10 : 10 } : false}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: tab === 'schedules' ? 8 : -8 }}
          transition={{ duration: timing.micro + 0.08, ease: 'easeOut' }}
        >
          {tab === 'schedules' ? (
            <ScheduleTab
              weeklyList={weeklyList}
              onceList={onceList}
              skippedThisWeek={skippedThisWeek}
              archives={archives}
              draft={draft}
              editingId={editingId}
              onDraftChange={setDraft}
              onSave={handleSaveSchedule}
              onEdit={startEdit}
              onDelete={handleDeleteSchedule}
              onUndoSkip={handleUndoSkip}
              onCancelEdit={() => {
                setEditingId(null)
                resetDraft()
              }}
              t={t}
            />
          ) : (
            <AnniversaryTab anniversaries={oshi.anniversaries} onChange={handleAnniversariesChange} t={t} />
          )}
        </motion.div>
      </AnimatePresence>
    </Modal>
  )
}

function ScheduleTab({
  weeklyList,
  onceList,
  skippedThisWeek,
  archives,
  draft,
  editingId,
  onDraftChange,
  onSave,
  onEdit,
  onDelete,
  onUndoSkip,
  onCancelEdit,
  t,
}: {
  weeklyList: OshiSchedule[]
  onceList: OshiSchedule[]
  skippedThisWeek: Set<string>
  archives: Archive[]
  draft: ScheduleInput
  editingId: string | null
  onDraftChange: (draft: ScheduleInput) => void
  onSave: () => void
  onEdit: (schedule: OshiSchedule) => void
  onDelete: (id: string) => void
  onUndoSkip: (schedule: OshiSchedule) => void
  onCancelEdit: () => void
  t: ReturnType<typeof useI18n>['t']
}) {
  const saveDisabled = !draft.title.trim() || (draft.kind === 'once' && !draft.date)
  const archiveName = (id: string) => archives.find((archive) => archive.id === id)?.name || ''

  const renderRow = (schedule: OshiSchedule) => {
    const skipped = skippedThisWeek.has(schedule.id)
    return (
      <motion.div
        key={schedule.id}
        layout
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
        className={clsx(
          'group flex items-center gap-2.5 rounded-lg px-2 py-2.5 transition-colors',
          skipped && 'opacity-45',
          editingId === schedule.id ? 'bg-accent/10 ring-1 ring-accent/40' : 'hover:bg-bg-secondary/50'
        )}
      >
        <Video size={15} className="shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text-primary">{schedule.title}</p>
          <p className="text-xs text-text-muted">
            {schedule.kind === 'weekly'
              ? t('calendar.everyWeek', { weekday: t(`calendar.weekdayFull.${WEEKDAY_OPTION_KEYS[schedule.weekday ?? 0]}`) })
              : schedule.date}
            {schedule.time ? ` · ${schedule.time}` : ''}
            {schedule.archive_id ? ` · ${archiveName(schedule.archive_id)}` : ''}
            {skipped && ` · ${t('calendar.weekSkipped')}`}
          </p>
        </div>
        {skipped ? (
          <button type="button" onClick={() => onUndoSkip(schedule)} className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-bg-tertiary hover:text-accent" title={t('calendar.undoSkip')}>
            <RotateCcw size={14} />
          </button>
        ) : (
          <>
            <button type="button" onClick={() => onEdit(schedule)} className="rounded-lg p-1.5 text-text-muted opacity-0 transition-all group-hover:opacity-100 hover:bg-bg-tertiary hover:text-accent" title={t('common.edit')}>
              <Pencil size={14} />
            </button>
            <button type="button" onClick={() => onDelete(schedule.id)} className="rounded-lg p-1.5 text-text-muted opacity-0 transition-all group-hover:opacity-100 hover:bg-bg-tertiary hover:text-red-500" title={t('common.delete')}>
              <Trash2 size={14} />
            </button>
          </>
        )}
      </motion.div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        {weeklyList.length === 0 && onceList.length === 0 && <p className="py-2 text-sm text-text-muted">{t('calendar.noSchedules')}</p>}
        {weeklyList.length > 0 && (
          <div className="divide-y divide-border-color/50">
            <AnimatePresence initial={false}>
              {weeklyList.map(renderRow)}
            </AnimatePresence>
          </div>
        )}
        {weeklyList.length > 0 && onceList.length > 0 && (
          <div className="my-2 border-t border-border-color/60" />
        )}
        {onceList.length > 0 && (
          <div className="divide-y divide-border-color/50">
            <AnimatePresence initial={false}>
              {onceList.map(renderRow)}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div className="border-t border-border-color/60 pt-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
          {editingId ? t('calendar.editSchedule') : t('calendar.addSchedule')}
        </p>
        <div className="grid gap-2.5">
          <input
            value={draft.title}
            onChange={(event) => onDraftChange({ ...draft, title: event.target.value })}
            placeholder={t('calendar.scheduleNamePlaceholder')}
            className="rounded-lg border border-border-color bg-transparent px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent-soft"
          />
          <div className="flex flex-wrap gap-2.5">
            <SelectMenu
              value={draft.kind}
              onChange={(value) => onDraftChange({ ...draft, kind: value as ScheduleInput['kind'] })}
              options={[
                { value: 'weekly', label: t('calendar.kind.weekly') },
                { value: 'once', label: t('calendar.kind.once') },
              ]}
              ariaLabel={t('calendar.kind.label')}
              size="sm"
            />
            {draft.kind === 'weekly' ? (
              <SelectMenu
                value={String(draft.weekday ?? 2)}
                onChange={(value) => onDraftChange({ ...draft, weekday: Number(value) })}
                options={WEEKDAY_OPTION_KEYS.map((key, index) => ({ value: String(index), label: t(`calendar.weekdayFull.${key}`) }))}
                ariaLabel={t('calendar.weekdayLabel')}
                size="sm"
              />
            ) : (
              <input
                type="date"
                value={draft.date || ''}
                onChange={(event) => onDraftChange({ ...draft, date: event.target.value || null })}
                className="h-8 rounded-lg border border-border-color bg-transparent px-2.5 text-xs text-text-primary outline-none focus:ring-2 focus:ring-accent-soft"
              />
            )}
            <input
              type="time"
              value={draft.time || ''}
              onChange={(event) => onDraftChange({ ...draft, time: event.target.value || null })}
              className="h-8 rounded-lg border border-border-color bg-transparent px-2.5 text-xs text-text-primary outline-none focus:ring-2 focus:ring-accent-soft"
              title={t('calendar.timeOptional')}
            />
            <SelectMenu
              value={draft.archive_id}
              onChange={(value) => onDraftChange({ ...draft, archive_id: value })}
              options={[{ value: '', label: t('calendar.archive.any') }, ...archives.map((archive) => ({ value: archive.id, label: archive.name }))]}
              ariaLabel={t('calendar.archiveLabel')}
              size="sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            {editingId && (
              <Button variant="ghost" size="sm" onClick={onCancelEdit}>{t('common.cancel')}</Button>
            )}
            <Button size="sm" onClick={onSave} disabled={saveDisabled}>
              <Plus size={14} />
              {editingId ? t('common.save') : t('common.add')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AnniversaryTab({
  anniversaries,
  onChange,
  t,
}: {
  anniversaries: OshiAnniversary[]
  onChange: (next: OshiAnniversary[]) => void
  t: ReturnType<typeof useI18n>['t']
}) {
  const [label, setLabel] = useState('')
  const [month, setMonth] = useState('1')
  const [day, setDay] = useState('1')
  const [isBirthday, setIsBirthday] = useState(false)

  async function handleAdd() {
    const monthNum = Number(month)
    const dayNum = Number(day)
    if (!label.trim() || !isValidAnniversaryDate(monthNum, dayNum)) return
    await onChange([...anniversaries, {
      id: generateId(),
      label: label.trim(),
      month: monthNum,
      day: dayNum,
      kind: isBirthday ? 'birthday' : 'other',
    }])
    setLabel('')
    setIsBirthday(false)
  }

  return (
    <div className="space-y-4">
      <div>
        {anniversaries.length === 0 && <p className="py-2 text-sm text-text-muted">{t('calendar.noAnniversaries')}</p>}
        {anniversaries.length > 0 && (
          <div className="divide-y divide-border-color/50">
            {anniversaries.map((item) => (
              <div key={item.id} className="group flex items-center gap-2.5 rounded-lg px-2 py-2.5 transition-colors hover:bg-bg-secondary/50">
                <Cake size={15} className={clsx('shrink-0', item.kind === 'birthday' ? 'text-amber-500' : 'text-accent')} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">{item.label}</p>
                  <p className="text-xs text-text-muted">
                    {t('calendar.anniversaryDate', { month: item.month, day: item.day })} · {t(`calendar.anniversaryKind.${item.kind}`)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onChange(anniversaries.filter((candidate) => candidate.id !== item.id))}
                  className="rounded-lg p-1.5 text-text-muted opacity-0 transition-all group-hover:opacity-100 hover:bg-bg-tertiary hover:text-red-500"
                  title={t('common.delete')}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-border-color/60 pt-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">{t('calendar.addAnniversary')}</p>
        <div className="grid gap-2.5">
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder={t('calendar.anniversaryNamePlaceholder')}
            className="rounded-lg border border-border-color bg-transparent px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent-soft"
          />
          <div className="flex flex-wrap items-center gap-2.5">
            <label className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                max={12}
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="h-8 w-16 rounded-lg border border-border-color bg-transparent px-2.5 text-xs text-text-primary outline-none focus:ring-2 focus:ring-accent-soft"
              />
              <span className="text-xs text-text-muted">{t('calendar.month')}</span>
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                max={31}
                value={day}
                onChange={(event) => setDay(event.target.value)}
                className="h-8 w-16 rounded-lg border border-border-color bg-transparent px-2.5 text-xs text-text-primary outline-none focus:ring-2 focus:ring-accent-soft"
              />
              <span className="text-xs text-text-muted">{t('calendar.day')}</span>
            </label>
            <button
              type="button"
              role="checkbox"
              aria-checked={isBirthday}
              onClick={() => setIsBirthday((value) => !value)}
              className={clsx(
                'inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors',
                isBirthday
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border-color text-text-secondary hover:border-border-hover hover:text-text-primary'
              )}
            >
              <span className={clsx(
                'flex h-3.5 w-3.5 items-center justify-center rounded border transition-colors',
                isBirthday ? 'border-accent bg-accent text-white' : 'border-text-muted/50'
              )}>
                {isBirthday && <Check size={11} />}
              </span>
              {t('calendar.anniversaryKind.birthday')}
            </button>
            <Button size="sm" onClick={handleAdd} disabled={!label.trim()}>
              <Plus size={14} />
              {t('common.add')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
