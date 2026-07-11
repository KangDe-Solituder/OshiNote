import clsx from 'clsx'
import { ImageIcon, PackageOpen, Sparkles, Stamp as StampIcon, StickyNote } from 'lucide-react'
import { useI18n } from '../../../i18n/useI18n'
import type { JournalCreationStepId } from './journalCreationTypes'

const DRAFT_STEPS = [
  { id: 'notes', icon: StickyNote, labelKey: 'journalCreate.step.notes' },
  { id: 'images', icon: ImageIcon, labelKey: 'journalCreate.step.images' },
  { id: 'materials', icon: PackageOpen, labelKey: 'journalCreate.step.decorations' },
  { id: 'stamp', icon: StampIcon, labelKey: 'journalCreate.step.stamp' },
  { id: 'review', icon: Sparkles, labelKey: 'journalCreate.step.review' },
] as const

export function JournalStepRail({ stepId, onStepChange, onHoverChange }: {
  stepId: JournalCreationStepId
  onStepChange: (stepId: JournalCreationStepId) => void
  onHoverChange: (value: boolean) => void
}) {
  const { t } = useI18n()
  return (
    <nav
      className="hidden w-20 shrink-0 border-r border-border-color bg-bg-secondary/45 px-2 py-4 md:block"
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      <div className="grid gap-2">
        {DRAFT_STEPS.map((step) => {
          const Icon = step.icon
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onStepChange(step.id)}
              className={clsx(
                'flex h-12 w-full items-center justify-center rounded-xl transition-colors',
                step.id === stepId ? 'bg-accent text-white' : 'text-text-muted hover:bg-bg-primary hover:text-accent'
              )}
              title={t(step.labelKey)}
            >
              <Icon size={18} />
            </button>
          )
        })}
      </div>
    </nav>
  )
}
