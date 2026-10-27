import type { PointerEvent } from 'react'
import { Layers3, NotebookPen, Trash2 } from 'lucide-react'
import type { JournalDraftItem } from '../../../types'
import { readRegion, type RegionKind } from '../../../features/journal/journalRegions'
import { useI18n } from '../../../i18n/useI18n'
import type { DragPayload } from './JournalDraftCanvas'
import { isItemLocked } from '../../../features/journal/journalEditing'

export function JournalRegionsDrawer({ items, selectedId, onSelect, onRemove, onPointerPlace, onAdd }: {
  items: JournalDraftItem[]; selectedId: string | null
  onSelect: (id: string) => void; onRemove: (id: string) => void
  onPointerPlace: (payload: DragPayload, event: PointerEvent<HTMLElement>) => void
  onAdd: (kind: RegionKind) => void
}) {
  const { t } = useI18n()
  const containers = items.filter(item => !item.staged && readRegion(item.stylePayload))
  return <div className="grid gap-4">
    <div className="grid grid-cols-2 gap-2">{(['strips', 'notes'] as RegionKind[]).map(kind => <button key={kind} className="grid justify-items-center gap-2 rounded-xl border border-border-color bg-bg-secondary p-4 text-xs text-text-primary hover:border-accent" onPointerDown={event => onPointerPlace({ kind: 'region', id: kind }, event)} onClick={event => { if (event.detail === 0) onAdd(kind) }}>
      {kind === 'strips' ? <NotebookPen size={25} /> : <Layers3 size={25} />}{t(`journalRegions.${kind}`)}
    </button>)}</div>
    <div className="grid gap-2">{containers.map((item, i) => {
      const region = readRegion(item.stylePayload)!
      return <div key={item.draftId} className={`flex items-center rounded-xl border ${selectedId === item.draftId ? 'border-accent bg-accent-soft/20' : 'border-border-color'}`}>
        <button className="min-w-0 flex-1 truncate p-3 text-left text-xs text-text-primary" onClick={() => onSelect(item.draftId)}>{region.title || t(`journalRegions.${region.kind}`)} {i + 1}</button>
        <button disabled={isItemLocked(item)} title={t('journalRegions.remove')} onClick={() => onRemove(item.draftId)} className="p-3 text-text-muted hover:text-red-400 disabled:opacity-30"><Trash2 size={15} /></button>
      </div>
    })}</div>
  </div>
}
