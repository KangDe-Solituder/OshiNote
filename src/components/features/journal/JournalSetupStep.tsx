import clsx from 'clsx'
import { ImageIcon, LayoutTemplate, StickyNote } from 'lucide-react'
import type { Oshi, JournalPageOrientation } from '../../../types'
import { useI18n } from '../../../i18n/useI18n'
import { JOURNAL_BACKGROUND_PRESETS } from '../../../features/journal/journalBackgrounds'
import { getJournalPageSize } from '../../../features/journal/journalLayout'
import {
  JOURNAL_PAGE_TEMPLATES,
  getJournalPageTemplateDefinition,
  type JournalPageTemplateDefinition,
} from '../../../features/journal/journalPageTemplates'
import { getJournalMaterialDefinition } from '../../../features/journal/journalMaterials'
import { Button } from '../../ui/Button'
import { SelectMenu } from '../../ui/SelectMenu'
import { getPageBackground } from './journalCanvasStyle'

interface JournalSetupStepProps {
  oshis: Oshi[]
  selectedOshiId: string
  title: string
  dateLabel: string
  description: string
  background: string
  orientation: JournalPageOrientation
  templateId: string | null
  editMode: boolean
  onOshiChange: (oshiId: string) => void
  onTitleChange: (value: string) => void
  onDateLabelChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onBackgroundChange: (value: string) => void
  onOrientationChange: (value: JournalPageOrientation) => void
  onTemplateChange: (templateId: string | null) => void
  onNext: () => void
}

export function JournalSetupStep({
  oshis,
  selectedOshiId,
  title,
  dateLabel,
  description,
  background,
  orientation,
  templateId,
  editMode,
  onOshiChange,
  onTitleChange,
  onDateLabelChange,
  onDescriptionChange,
  onBackgroundChange,
  onOrientationChange,
  onTemplateChange,
  onNext,
}: JournalSetupStepProps) {
  const { t } = useI18n()
  const selectedTemplate = getJournalPageTemplateDefinition(templateId)
  const customized = Boolean(selectedTemplate && (
    selectedTemplate.background !== background
    || selectedTemplate.preferredOrientation !== orientation
  ))

  return (
    <main className="min-h-0 min-w-0 flex-1 overflow-y-auto px-5 py-5 lg:px-8">
      <section className="mx-auto grid min-w-0 max-w-7xl gap-5">
        <div className="grid min-w-0 gap-5 rounded-2xl border border-border-color bg-bg-secondary/45 p-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="grid auto-rows-fr gap-x-4 gap-y-5 md:grid-cols-2">
            <label className="grid min-w-0 content-start gap-1.5 text-xs font-medium text-text-muted">
              {t('journalEditor.setup.oshi')}
              <SelectMenu
                value={selectedOshiId}
                onChange={onOshiChange}
                options={oshis.map((oshi) => ({ value: oshi.id, label: oshi.name }))}
                placeholder={t('journalEditor.setup.chooseOshi')}
                ariaLabel={t('journalEditor.setup.chooseOshi')}
                className="w-full"
                buttonClassName="h-14 w-full rounded-xl text-text-primary"
                menuClassName="w-full"
              />
            </label>
            <label className="grid min-w-0 content-start gap-1.5 text-xs font-medium text-text-muted">
              {t('journalEditor.setup.pageTitle')}
              <input value={title} onChange={(event) => onTitleChange(event.target.value)} className={`${fieldClassName} h-14 w-full`} placeholder={t('journalEditor.setup.pageTitlePlaceholder')} />
            </label>
            <label className="grid min-w-0 content-start gap-1.5 text-xs font-medium text-text-muted">
              {t('journalEditor.setup.dateLabel')}
              <input value={dateLabel} onChange={(event) => onDateLabelChange(event.target.value)} className={`${fieldClassName} h-14 w-full`} placeholder={t('journalEditor.setup.dateLabelPlaceholder')} />
            </label>
            <label className="grid min-w-0 content-start gap-1.5 text-xs font-medium text-text-muted">
              {t('journalEditor.setup.description')}
              <input value={description} onChange={(event) => onDescriptionChange(event.target.value)} className={`${fieldClassName} h-14 w-full`} placeholder={t('journalEditor.setup.descriptionPlaceholder')} />
            </label>
          </div>
          <div className="rounded-2xl border border-border-color bg-bg-primary/70 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t('journalCreate.preview')}</p>
              {customized && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">{t('journalTemplates.customized')}</span>}
            </div>
            <EmptyPagePreview background={background} orientation={orientation} template={selectedTemplate} />
          </div>
        </div>

        {!editMode && (
          <div className="min-w-0">
            <div className="mb-2 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t('journalTemplates.startingLayout')}</p>
                <p className="mt-1 text-xs text-text-muted">{t('journalTemplates.startingLayoutHint')}</p>
              </div>
            </div>
            <div className="flex min-w-0 snap-x gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-3 lg:overflow-visible xl:grid-cols-6">
              <TemplateChoiceCard selected={!templateId} onClick={() => onTemplateChange(null)} title={t('journalTemplates.blank.name')} description={t('journalTemplates.blank.description')} />
              {JOURNAL_PAGE_TEMPLATES.map((template) => (
                <TemplateChoiceCard
                  key={template.id}
                  template={template}
                  selected={templateId === template.id}
                  onClick={() => onTemplateChange(template.id)}
                  title={t(template.nameKey)}
                  description={t(template.descriptionKey)}
                />
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{t('journalCreate.orientation')}</p>
          <div className="grid max-w-lg grid-cols-2 gap-2">
            {(['portrait', 'landscape'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onOrientationChange(value)}
                className={clsx(
                  'h-12 rounded-xl border px-3 text-sm font-semibold transition-colors',
                  orientation === value ? 'border-accent bg-accent-soft text-accent' : 'border-border-color bg-bg-secondary text-text-secondary hover:border-border-hover'
                )}
              >
                {t(`journalCreate.orientation.${value}` as never)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {JOURNAL_BACKGROUND_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onBackgroundChange(preset.id)}
              className={clsx(
                'overflow-hidden rounded-xl border bg-bg-secondary text-left transition-colors hover:border-border-hover',
                background === preset.id ? 'border-accent ring-2 ring-accent-soft' : 'border-border-color'
              )}
            >
              <span className="block h-24" style={preset.previewStyle} />
              <span className="block p-3">
                <span className="block text-sm font-semibold text-text-primary">{t(preset.labelKey)}</span>
                <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-text-muted">{t(preset.descriptionKey)}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="flex justify-end">
          <Button variant="primary" size="sm" onClick={onNext} disabled={!selectedOshiId}>
            {t('journalCreate.next')}
          </Button>
        </div>
      </section>
    </main>
  )
}

function TemplateChoiceCard({ template, selected, title, description, onClick }: {
  template?: JournalPageTemplateDefinition
  selected: boolean
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'h-[206px] w-52 shrink-0 snap-start overflow-hidden rounded-xl border bg-bg-secondary text-left transition-colors lg:w-auto',
        selected ? 'border-accent ring-2 ring-accent-soft' : 'border-border-color hover:border-border-hover'
      )}
    >
      <TemplateMiniPreview template={template} />
      <span className="block h-[92px] overflow-hidden p-3">
        <span className="block truncate text-sm font-semibold text-text-primary">{title}</span>
        <span className="mt-1 block max-h-8 overflow-hidden text-xs leading-4 text-text-muted">{description}</span>
      </span>
    </button>
  )
}

export function TemplateMiniPreview({ template, className }: { template?: JournalPageTemplateDefinition; className?: string }) {
  const orientation = template?.preferredOrientation || 'portrait'
  return (
    <span className={clsx('flex h-28 items-center justify-center bg-bg-primary/55 p-2', className)}>
      <span
        className="relative block overflow-hidden rounded-lg border border-border-color shadow-sm"
        style={{
          width: orientation === 'landscape' ? 150 : 86,
          height: orientation === 'landscape' ? 86 : 104,
          ...getPageBackground(template?.background || 'paper'),
        }}
      >
        {!template && <LayoutTemplate size={22} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-text-muted/45" />}
        {template?.slots.map((templateSlot) => {
          const Icon = templateSlot.kind === 'note' ? StickyNote : ImageIcon
          return (
            <span
              key={templateSlot.id}
              className="absolute flex items-center justify-center rounded border border-dashed border-accent/65 bg-bg-primary/35 text-accent/75"
              style={{
                left: `${templateSlot.layout.x * 100}%`,
                top: `${templateSlot.layout.y * 100}%`,
                width: `${templateSlot.layout.width * 100}%`,
                height: `${templateSlot.layout.height * 100}%`,
                transform: `rotate(${templateSlot.layout.rotation}deg)`,
              }}
            >
              <Icon size={10} />
            </span>
          )
        })}
        {template?.decorations.map((decoration, index) => {
          const material = getJournalMaterialDefinition(decoration.materialId)
          const color = typeof material?.defaultStyle.color === 'string' ? material.defaultStyle.color : '#d9c4ff'
          return (
            <span
              key={`${decoration.materialId}-${index}`}
              className="absolute block rounded-sm opacity-80"
              style={{
                left: `${decoration.layout.x * 100}%`,
                top: `${decoration.layout.y * 100}%`,
                width: `${decoration.layout.width * 100}%`,
                height: `${decoration.layout.height * 100}%`,
                transform: `rotate(${decoration.layout.rotation}deg)`,
                backgroundColor: color,
              }}
            />
          )
        })}
      </span>
    </span>
  )
}

function EmptyPagePreview({ background, orientation, template }: { background: string; orientation: JournalPageOrientation; template: JournalPageTemplateDefinition | null }) {
  const pageSize = getJournalPageSize(orientation)
  const width = orientation === 'landscape' ? 210 : 150
  const height = Math.round(width * pageSize.height / pageSize.width)
  return (
    <div
      className="relative mx-auto overflow-hidden rounded-xl border border-border-color shadow-[0_14px_28px_rgba(40,46,70,0.14)]"
      style={{ width, height, ...getPageBackground(background) }}
    >
      {template?.slots.map((templateSlot) => (
        <span
          key={templateSlot.id}
          className="absolute rounded-md border border-dashed border-accent/55 bg-bg-primary/25"
          style={{
            left: `${templateSlot.layout.x * 100}%`,
            top: `${templateSlot.layout.y * 100}%`,
            width: `${templateSlot.layout.width * 100}%`,
            height: `${templateSlot.layout.height * 100}%`,
            transform: `rotate(${templateSlot.layout.rotation}deg)`,
          }}
        />
      ))}
    </div>
  )
}

const fieldClassName = 'min-w-0 rounded-xl border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-secondary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-soft disabled:opacity-50'
