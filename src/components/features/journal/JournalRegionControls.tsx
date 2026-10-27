import type { JournalRegion } from '../../../features/journal/journalRegions'
import { REGION_CAPACITY } from '../../../features/journal/journalRegions'
import { useI18n } from '../../../i18n/useI18n'
import { JournalNumberField } from './JournalNumberField'

export function JournalRegionControls({ region, onChange }: { region: JournalRegion; onChange: (region: JournalRegion) => void }) {
  const { t } = useI18n()
  const field = 'w-full rounded-lg border border-border-color bg-bg-primary p-2 text-xs text-text-primary'
  const change = (patch: Partial<JournalRegion>) => onChange({ ...region, ...patch })
  return <div className="grid gap-3 text-xs text-text-secondary">
    <label className="grid gap-1">{t('journalRegions.heading')}<input className={field} value={region.title} onChange={event => change({ title: event.target.value })} /></label>
    {region.kind === 'strips' ? <>
      <JournalNumberField label={t('journalRegions.count')} value={region.count} min={Math.max(1, region.entries.length)} max={REGION_CAPACITY} onChange={count => change({ count })} />
      <label className="grid gap-1">{t('journalRegions.holes')}<select className={field} value={region.holes} onChange={event => change({ holes: event.target.value as JournalRegion['holes'] })}>{(['left', 'right', 'none'] as const).map(value => <option key={value} value={value}>{t(`journalRegions.${value}`)}</option>)}</select></label>
      <label className="grid gap-1">{t('journalRegions.lines')}<select className={field} value={region.lines} onChange={event => change({ lines: Number(event.target.value) })}><option value={1}>1</option><option value={2}>2</option></select></label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={region.stickers} onChange={event => change({ stickers: event.target.checked })} />{t('journalRegions.stickers')}</label>
    </> : <label className="grid gap-1">{t('journalRegions.style')}<select className={field} value={region.style} onChange={event => change({ style: event.target.value as JournalRegion['style'] })}><optgroup label={t('journalRegions.stackedStyles')}>{(['loose', 'box'] as const).map(value => <option key={value} value={value}>{t(`journalRegions.${value}`)}</option>)}</optgroup><optgroup label={t('journalRegions.columnStyles')}>{(['string', 'grid', 'board'] as const).map(value => <option key={value} value={value}>{t(`journalRegions.${value}`)}</option>)}</optgroup></select></label>}
    <JournalNumberField label={t('journalRegions.limit')} value={region.limit} min={0} max={240} onChange={limit => change({ limit })} />
    <label className="grid gap-1">{t('journalRegions.sort')}<select className={field} value={region.sort} onChange={event => change({ sort: event.target.value as JournalRegion['sort'] })}>{(['asc', 'desc', 'added'] as const).map(value => <option key={value} value={value}>{t(`journalRegions.${value}`)}</option>)}</select></label>
    <label className="flex items-center justify-between">{t('journalRegions.color')}<input type="color" value={region.color} onChange={event => change({ color: event.target.value })} /></label>
    <label className="grid gap-1">{t('journalRegions.palette')}<select className={field} value={region.palette} onChange={event => change({ palette: event.target.value as JournalRegion['palette'] })}>{(['pastel', 'warm', 'cool'] as const).map(value => <option key={value} value={value}>{t(`journalRegions.${value}`)}</option>)}</select></label>
    <label className="grid gap-1">{t('journalRegions.scatter')} · {region.scatter}<input type="range" min={0} max={100} value={region.scatter} onChange={event => change({ scatter: Number(event.target.value) })} /></label>
    <button className={field} onClick={() => change({ seed: (region.seed + 1) % 100001 })}>{t('journalRegions.shuffle')}</button>

  </div>
}
