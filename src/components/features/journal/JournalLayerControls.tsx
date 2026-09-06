import { ArrowUp, ArrowDown, ArrowUpToLine, ArrowDownToLine } from 'lucide-react'
import type { LayerAction } from '../../../features/journal/journalEditing'
import { useI18n } from '../../../i18n/useI18n'

export function JournalLayerControls({ layer, onChange }: { layer: number; onChange: (action: LayerAction) => void }) {
  const { t } = useI18n()
  return <div className="flex items-center gap-1 text-xs text-text-muted">
    <span className="whitespace-nowrap px-2">{t('journal.layer', { number: layer })}</span>
    {([
      ['up', ArrowUp, 'journal.layerUp'], ['down', ArrowDown, 'journal.layerDown'],
      ['top', ArrowUpToLine, 'journal.layerTop'], ['bottom', ArrowDownToLine, 'journal.layerBottom'],
    ] as const).map(([action, Icon, label]) => <button key={action} type="button" title={t(label)} aria-label={t(label)} className="rounded-lg p-2 hover:bg-bg-secondary hover:text-accent" onClick={() => onChange(action)}><Icon size={15} /></button>)}
  </div>
}
