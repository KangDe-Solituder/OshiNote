import { PackageOpen, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '../../ui/Button'
import { JOURNAL_MATERIAL_KINDS, JOURNAL_MATERIALS } from '../../../features/journal/journalMaterials'
import type { JournalMaterialKind } from '../../../types'
import { usePopoverTransition } from '../themes/uiMotion'
import { useI18n } from '../../../i18n/useI18n'
import { OVERLAY_Z_INDEX } from '../../ui/overlay'
import { JournalMaterialTile } from './JournalMaterialTile'

interface JournalMaterialPickerProps {
  onPlaceMaterial: (materialId: string) => void
  onClose: () => void
}

export function JournalMaterialPicker({ onPlaceMaterial, onClose }: JournalMaterialPickerProps) {
  const { t } = useI18n()
  const popoverTransition = usePopoverTransition()
  const [kind, setKind] = useState<'all' | JournalMaterialKind>('all')
  const materials = useMemo(
    () => kind === 'all' ? JOURNAL_MATERIALS : JOURNAL_MATERIALS.filter((material) => material.kind === kind),
    [kind]
  )

  return (
    <motion.div
      {...popoverTransition}
      className="fixed right-5 top-24 flex max-h-[620px] w-[min(440px,calc(100vw-40px))] origin-top-right flex-col overflow-hidden rounded-2xl border border-border-color bg-bg-primary shadow-xl"
      style={{ zIndex: OVERLAY_Z_INDEX.popover }}
    >
      <div className="flex items-center gap-2 border-b border-border-color p-3">
        <PackageOpen size={18} className="text-accent" />
        <h3 className="flex-1 text-sm font-semibold text-text-primary">{t('journalMaterials.picker.title')}</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-text-muted hover:bg-bg-tertiary hover:text-text-primary"
          title={t('common.cancel')}
        >
          <X size={16} />
        </button>
      </div>

      <div className="border-b border-border-color p-3">
        <div className="flex flex-wrap gap-1.5">
          {JOURNAL_MATERIAL_KINDS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setKind(item.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                kind === item.id
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-border-color bg-bg-secondary text-text-secondary hover:border-border-hover'
              }`}
            >
              {t(item.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-y-auto p-3">
        {materials.map((material) => (
          <button
            key={material.id}
            type="button"
            onClick={() => onPlaceMaterial(material.id)}
            className="rounded-xl border border-border-color bg-bg-secondary/60 p-2 text-left transition-colors hover:border-accent hover:bg-accent-soft/30"
          >
            <JournalMaterialTile material={material} compact />
            <p className="mt-2 truncate text-xs font-semibold text-text-primary">{t(material.nameKey)}</p>
          </button>
        ))}
      </div>

      <div className="border-t border-border-color p-3">
        <Button variant="ghost" size="sm" className="w-full" onClick={onClose}>{t('common.done')}</Button>
      </div>
    </motion.div>
  )
}
