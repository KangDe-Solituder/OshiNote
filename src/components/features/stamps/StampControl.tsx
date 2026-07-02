import { CheckCircle2, RotateCcw, Stamp as StampIcon, X } from 'lucide-react'
import clsx from 'clsx'
import { SelectMenu } from '../../ui/SelectMenu'
import { useI18n } from '../../../i18n/useI18n'
import {
  createStampInputFromTemplate,
  getPositionCoordinates,
  STAMP_TEMPLATES,
} from '../../../features/stamps/stampService'
import type { Stamp, StampInput, StampPosition, StampTemplateId } from '../../../types'

const POSITION_OPTIONS: StampPosition[] = ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right']

export function StampControl({
  value,
  onChange,
  onClear,
}: {
  value: StampInput | Stamp | null
  onChange: (value: StampInput) => void
  onClear: () => void
}) {
  const { t } = useI18n()
  const current = value || null
  const currentTemplateId = (current?.template_id || 'recorded') as StampTemplateId
  const currentPosition = (current?.position || 'bottom-right') as StampPosition

  function updateFromTemplate(templateId: StampTemplateId) {
    const template = STAMP_TEMPLATES.find((item) => item.id === templateId) || STAMP_TEMPLATES[0]
    const label = t(template.labelKey as never)
    onChange({
      ...createStampInputFromTemplate(template.id, label),
      position: currentPosition,
      ...getPositionCoordinates(currentPosition),
    })
  }

  function updatePosition(position: StampPosition) {
    const template = STAMP_TEMPLATES.find((item) => item.id === currentTemplateId) || STAMP_TEMPLATES[0]
    const base = current || createStampInputFromTemplate(template.id, t(template.labelKey as never))
    onChange({
      template_id: base.template_id,
      template_snapshot: 'template_snapshot' in base ? base.template_snapshot : JSON.stringify(template),
      label: base.label,
      color: base.color,
      rotation: base.rotation,
      size: base.size,
      opacity: base.opacity,
      position,
      ...getPositionCoordinates(position),
    })
  }

  function updateLabel(label: string) {
    const template = STAMP_TEMPLATES.find((item) => item.id === currentTemplateId) || STAMP_TEMPLATES[0]
    const base = current || createStampInputFromTemplate(template.id, t(template.labelKey as never))
    onChange({
      template_id: base.template_id,
      template_snapshot: 'template_snapshot' in base ? base.template_snapshot : JSON.stringify(template),
      label,
      color: base.color,
      rotation: base.rotation,
      size: base.size,
      opacity: base.opacity,
      position: currentPosition,
      x: base.x,
      y: base.y,
    })
  }

  return (
    <section className="rounded-2xl border border-border-color bg-bg-primary/75 p-4 shadow-sm shadow-black/5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-text-primary">
            <StampIcon size={16} className="text-accent" />
            {t('stamps.title')}
          </h2>
          <p className="mt-1 text-xs text-text-muted">{t('stamps.description')}</p>
        </div>
        {current ? (
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-bg-tertiary hover:text-red-400"
            title={t('stamps.remove')}
          >
            <X size={15} />
          </button>
        ) : null}
      </div>

      <div className="space-y-3">
        <SelectMenu
          value={currentTemplateId}
          onChange={(value) => updateFromTemplate(value as StampTemplateId)}
          options={STAMP_TEMPLATES.map((template) => ({
            value: template.id,
            label: t(template.labelKey as never),
          }))}
          ariaLabel={t('stamps.template')}
          className="w-full"
          buttonClassName="w-full rounded-xl text-text-primary"
          menuClassName="w-full"
        />

        <input
          value={current?.label || ''}
          onChange={(event) => updateLabel(event.target.value)}
          placeholder={t('stamps.labelPlaceholder')}
          className="w-full rounded-xl border border-border-color bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-soft"
        />

        <div>
          <p className="mb-2 text-xs font-medium text-text-muted">{t('stamps.position')}</p>
          <div className="grid grid-cols-3 gap-1.5">
            {POSITION_OPTIONS.map((position) => (
              <button
                key={position}
                type="button"
                onClick={() => updatePosition(position)}
                className={clsx(
                  'relative flex h-9 items-center justify-center rounded-lg border text-xs transition-colors',
                  currentPosition === position
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-border-color bg-bg-secondary text-text-muted hover:border-border-hover hover:text-text-primary'
                )}
                title={t(`stamps.position.${position}` as never)}
              >
                {position === 'center' ? <CheckCircle2 size={14} /> : <span className={positionDotClass(position)} />}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => updateFromTemplate(currentTemplateId)}
          className="inline-flex items-center gap-2 rounded-lg text-xs text-text-muted transition-colors hover:text-accent"
        >
          <RotateCcw size={13} />
          {t('stamps.reset')}
        </button>
      </div>
    </section>
  )
}

function positionDotClass(position: StampPosition): string {
  return clsx(
    'block h-3.5 w-3.5 rounded border border-current before:absolute before:h-1.5 before:w-1.5 before:rounded-full before:bg-current',
    position === 'top-left' && 'before:left-3 before:top-2.5',
    position === 'top-right' && 'before:right-3 before:top-2.5',
    position === 'bottom-left' && 'before:bottom-2.5 before:left-3',
    position === 'bottom-right' && 'before:bottom-2.5 before:right-3'
  )
}
