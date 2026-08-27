import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { Cake, Pencil, Plus, Trash2, Video } from 'lucide-react'
import type { AnniversaryKind, Oshi, OshiAnniversary, OshiSchedule } from '../../../types'
import { generateId } from '../../../database'
import { createSchedule, deleteSchedule, updateSchedule, type ScheduleInput } from '../../../features/schedule/scheduleService'
import { SCHEDULE_PLATFORMS } from '../../../features/schedule/scheduleModel'
import { updateOshi } from '../../../features/oshis/oshiService'
import { Modal } from '../../ui/Modal'
import { Button } from '../../ui/Button'
import { SelectMenu } from '../../ui/SelectMenu'
import { useI18n } from '../../../i18n/useI18n'

interface ScheduleManagerProps {
  open: boolean
  oshi: Oshi
  schedules: OshiSchedule[]
  onClose: () => void
  onChanged: () => void
}

const WEEKDAY_OPTION_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

export function ScheduleManager({ open, oshi, schedules, onClose, onChanged }: ScheduleManagerProps) {
  const { t } = useI18n()
  const [tab, setTab] = useState<'schedules' | 'anniversaries'>('schedules')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ScheduleInput>({ title: '', platform: '', kind: 'weekly', weekday: 2, date: null, time: null })

  useEffect(() => {
    if (open) {
      setEditingId(null)
      setDraft({ title: '', platform: '', kind: 'weekly', weekday: 2, date: null, time: null })
    }
  }, [open])

  function startEdit(schedule: OshiSchedule) {
    setEditingId(schedule.id)
    setDraft({
      title: schedule.title,
      platform: schedule.platform,
      kind: schedule.kind,
      weekday: schedule.weekday ?? 2,
      date: schedule.date,
      time: schedule.time,
    })
  }

  async function handleSaveSchedule() {
    const payload: ScheduleInput = {
      title: draft.title.trim(),
      platform: draft.platform,
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
    setDraft({ title: '', platform: '', kind: 'weekly', weekday: 2, date: null, time: null })
    onChanged()
  }

  async function handleDeleteSchedule(id: string) {
    await deleteSchedule(id)
    if (editingId === id) setEditingId(null)
    onChanged()
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

      {tab === 'schedules' ? (
        <ScheduleTab
          schedules={schedules}
          draft={draft}
          editingId={editingId}
          onDraftChange={setDraft}
          onSave={handleSaveSchedule}
          onEdit={startEdit}
          onDelete={handleDeleteSchedule}
          onCancelEdit={() => {
            setEditingId(null)
            setDraft({ title: '', platform: '', kind: 'weekly', weekday: 2, date: null, time: null })
          }}
          t={t}
        />
      ) : (
        <AnniversaryTab anniversaries={oshi.anniversaries} onChange={handleAnniversariesChange} t={t} />
      )}
    </Modal>
  )
}

function ScheduleTab({
  schedules,
  draft,
  editingId,
  onDraftChange,
  onSave,
  onEdit,
  onDelete,
  onCancelEdit,
  t,
}: {
  schedules: OshiSchedule[]
  draft: ScheduleInput
  editingId: string | null
  onDraftChange: (draft: ScheduleInput) => void
  onSave: () => void
  onEdit: (schedule: OshiSchedule) => void
  onDelete: (id: string) => void
  onCancelEdit: () => void
  t: ReturnType<typeof useI18n>['t']
}) {
  const saveDisabled = !draft.title.trim() || (draft.kind === 'once' && !draft.date)

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        {schedules.length === 0 && <p className="py-2 text-sm text-text-muted">{t('calendar.noSchedules')}</p>}
        {schedules.map((schedule) => (
          <div
            key={schedule.id}
            className={clsx(
              'flex items-center gap-2.5 rounded-xl border px-3 py-2.5',
              editingId === schedule.id ? 'border-accent bg-accent/5' : 'border-border-color bg-bg-secondary/40'
            )}
          >
            <Video size={15} className="shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text-primary">{schedule.title}</p>
              <p className="text-xs text-text-muted">
                {schedule.kind === 'weekly'
                  ? t('calendar.everyWeek', { weekday: t(`calendar.weekday.${WEEKDAY_OPTION_KEYS[schedule.weekday ?? 0]}`) })
                  : schedule.date}
                {schedule.time ? ` · ${schedule.time}` : ''}
                {schedule.platform ? ` · ${t(`calendar.platform.${schedule.platform}` as never)}` : ''}
              </p>
            </div>
            <button type="button" onClick={() => onEdit(schedule)} className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-bg-tertiary hover:text-accent" title={t('common.edit')}>
              <Pencil size={14} />
            </button>
            <button type="button" onClick={() => onDelete(schedule.id)} className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-bg-tertiary hover:text-red-500" title={t('common.delete')}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border-color bg-bg-secondary/25 p-3.5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
          {editingId ? t('calendar.editSchedule') : t('calendar.addSchedule')}
        </p>
        <div className="grid gap-2.5">
          <input
            value={draft.title}
            onChange={(event) => onDraftChange({ ...draft, title: event.target.value })}
            placeholder={t('calendar.scheduleNamePlaceholder')}
            className="rounded-lg border border-border-color bg-bg-card px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent-soft"
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
                options={WEEKDAY_OPTION_KEYS.map((key, index) => ({ value: String(index), label: t(`calendar.weekday.${key}`) }))}
                ariaLabel={t('calendar.weekdayLabel')}
                size="sm"
              />
            ) : (
              <input
                type="date"
                value={draft.date || ''}
                onChange={(event) => onDraftChange({ ...draft, date: event.target.value || null })}
                className="h-8 rounded-lg border border-border-color bg-bg-card px-2.5 text-xs text-text-primary outline-none focus:ring-2 focus:ring-accent-soft"
              />
            )}
            <input
              type="time"
              value={draft.time || ''}
              onChange={(event) => onDraftChange({ ...draft, time: event.target.value || null })}
              className="h-8 rounded-lg border border-border-color bg-bg-card px-2.5 text-xs text-text-primary outline-none focus:ring-2 focus:ring-accent-soft"
              title={t('calendar.timeOptional')}
            />
            <SelectMenu
              value={draft.platform}
              onChange={(value) => onDraftChange({ ...draft, platform: value })}
              options={[{ value: '', label: t('calendar.platform.any') }, ...SCHEDULE_PLATFORMS.map((platform) => ({ value: platform, label: t(`calendar.platform.${platform}`) }))]}
              ariaLabel={t('calendar.platformLabel')}
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
  const [kind, setKind] = useState<AnniversaryKind>('birthday')

  async function handleAdd() {
    const monthNum = Number(month)
    const dayNum = Number(day)
    if (!label.trim() || monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) return
    await onChange([...anniversaries, { id: generateId(), label: label.trim(), month: monthNum, day: dayNum, kind }])
    setLabel('')
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        {anniversaries.length === 0 && <p className="py-2 text-sm text-text-muted">{t('calendar.noAnniversaries')}</p>}
        {anniversaries.map((item) => (
          <div key={item.id} className="flex items-center gap-2.5 rounded-xl border border-border-color bg-bg-secondary/40 px-3 py-2.5">
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
              className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-bg-tertiary hover:text-red-500"
              title={t('common.delete')}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border-color bg-bg-secondary/25 p-3.5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">{t('calendar.addAnniversary')}</p>
        <div className="grid gap-2.5">
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder={t('calendar.anniversaryNamePlaceholder')}
            className="rounded-lg border border-border-color bg-bg-card px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent-soft"
          />
          <div className="flex flex-wrap items-center gap-2.5">
            <input
              type="number"
              min={1}
              max={12}
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="h-8 w-20 rounded-lg border border-border-color bg-bg-card px-2.5 text-xs text-text-primary outline-none focus:ring-2 focus:ring-accent-soft"
              title={t('calendar.month')}
            />
            <input
              type="number"
              min={1}
              max={31}
              value={day}
              onChange={(event) => setDay(event.target.value)}
              className="h-8 w-20 rounded-lg border border-border-color bg-bg-card px-2.5 text-xs text-text-primary outline-none focus:ring-2 focus:ring-accent-soft"
              title={t('calendar.day')}
            />
            <SelectMenu
              value={kind}
              onChange={(value) => setKind(value as AnniversaryKind)}
              options={[
                { value: 'birthday', label: t('calendar.anniversaryKind.birthday') },
                { value: 'debut', label: t('calendar.anniversaryKind.debut') },
                { value: 'other', label: t('calendar.anniversaryKind.other') },
              ]}
              ariaLabel={t('calendar.anniversaryKindLabel')}
              size="sm"
            />
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
