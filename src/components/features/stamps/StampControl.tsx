import { useEffect, useState } from 'react'
import { Palette, RotateCcw, Stamp as StampIcon, X } from 'lucide-react'
import clsx from 'clsx'
import { Modal } from '../../ui/Modal'
import { SelectMenu } from '../../ui/SelectMenu'
import { OVERLAY_Z_INDEX } from '../../ui/overlay'
import { useI18n } from '../../../i18n/useI18n'
import {
  clampStampOpacity,
  clampStampRotation,
  clampStampSize,
  createStampInputFromTemplate,
  createStampSnapshot,
  getStampMaterial,
  getStampMaterialId,
  getStampTemplate,
  normalizeStampInput,
  STAMP_OPACITY_MAX,
  STAMP_OPACITY_MIN,
  STAMP_ROTATION_MAX,
  STAMP_ROTATION_MIN,
  STAMP_SIZE_MAX,
  STAMP_SIZE_MIN,
  STAMP_TEMPLATES,
  VISIBLE_STAMP_MATERIALS,
} from '../../../features/stamps/stampService'
import type { Stamp, StampInput, StampMaterialId, StampTemplateId } from '../../../types'
import { StampOverlay } from './StampOverlay'
import { isStampMaterialFontReady, type StampFontId } from '../../../features/stamps/stampFonts'
import { useStampFontStore } from '../../../stores/stampFontStore'

const INK_COLORS = ['#8B5CF6', '#EC4899', '#2563EB', '#F59E0B', '#10B981', '#EF4444', '#111827', '#8B5E34']

export function StampControl({
  value,
  onClear,
  onStartPlacement,
  onCancelPlacement,
  placing = false,
}: {
  value: StampInput | Stamp | null
  onClear: () => void
  onStartPlacement?: (value: StampInput) => void
  onCancelPlacement?: () => void
  placing?: boolean
}) {
  const { t } = useI18n()
  const fontAvailability = useStampFontStore((s) => s.availability)
  const fontsChecked = useStampFontStore((s) => s.checked)
  const fontsChecking = useStampFontStore((s) => s.checking)
  const refreshFonts = useStampFontStore((s) => s.refresh)
  const [open, setOpen] = useState(false)
  const [workingStamp, setWorkingStamp] = useState<StampInput | null>(null)
  const current = value || null
  const configuredStamp = workingStamp ? normalizeStampInput(workingStamp) : current ? normalizeStampInput(current) : null
  const currentTemplateId = (configuredStamp?.template_id || 'recorded') as StampTemplateId
  const currentMaterialId = getVisibleMaterialId(getStampMaterialId(configuredStamp))
  const currentTemplate = getStampTemplate(currentTemplateId)
  const currentMaterial = getStampMaterial(currentMaterialId)
  const preview = configuredStamp
    ? configuredStamp
    : createStampInputFromTemplate(currentTemplate.id, t(currentTemplate.labelKey as never), currentMaterial.id)

  useEffect(() => {
    setWorkingStamp(null)
    setOpen(false)
  }, [value])

  useEffect(() => {
    if (!fontsChecked && !fontsChecking) void refreshFonts()
  }, [fontsChecked, fontsChecking, refreshFonts])

  function createBase(): StampInput {
    if (workingStamp) return normalizeStampInput(workingStamp)
    if (current) return normalizeStampInput(current)
    return createStampInputFromTemplate(currentTemplate.id, t(currentTemplate.labelKey as never), currentMaterial.id)
  }

  function updateDraft(stamp: StampInput) {
    setWorkingStamp(stamp)
  }

  function clearStamp() {
    setWorkingStamp(null)
    setOpen(false)
    onClear()
  }

  function startPlacement() {
    if (placing) {
      onCancelPlacement?.()
      return
    }
    onStartPlacement?.(createBase())
    setOpen(false)
  }

  function handleEntryClick() {
    if (placing) {
      onCancelPlacement?.()
      return
    }
    setOpen(true)
  }

  const summary = placing
    ? t('stamps.entry.placing')
    : current
      ? t('stamps.entry.applied', { label: normalizeStampInput(current).label })
      : t('stamps.entry.empty')

  return (
    <>
      <section className="rounded-2xl border border-border-color bg-bg-primary/75 p-3 shadow-sm shadow-black/5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleEntryClick}
            className={clsx(
              'flex min-w-0 flex-1 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
              placing
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-border-color bg-bg-secondary/70 text-text-secondary hover:border-border-hover hover:text-text-primary'
            )}
            title={placing ? t('stamps.cancelPlacement') : t('stamps.open')}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft/25 text-accent">
              <StampIcon size={17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-text-primary">{t('stamps.title')}</span>
              <span className="mt-0.5 flex items-center gap-2 text-xs text-text-muted">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/30"
                  style={{ backgroundColor: current ? normalizeStampInput(current).color : preview.color }}
                />
                <span className="truncate">{summary}</span>
              </span>
            </span>
          </button>
          {current ? (
            <button
              type="button"
              onClick={clearStamp}
              className="rounded-xl border border-border-color p-2.5 text-text-muted transition-colors hover:border-red-300 hover:bg-red-500/10 hover:text-red-400"
              title={t('stamps.remove')}
            >
              <X size={17} />
            </button>
          ) : null}
        </div>
      </section>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('stamps.modalTitle')}
        contentClassName="max-w-5xl p-5"
      >
        <StampSettingsForm
          preview={preview}
          currentTemplateId={currentTemplateId}
          currentMaterialId={currentMaterialId}
          fontAvailability={fontAvailability}
          onChange={updateDraft}
          onReset={() => updateDraft(createStampInputFromTemplate(currentTemplate.id, t(currentTemplate.labelKey as never), currentMaterial.id))}
          onPlace={startPlacement}
          placing={placing}
          canPlace={Boolean(onStartPlacement)}
        />
      </Modal>
    </>
  )
}

function StampSettingsForm({
  preview,
  currentTemplateId,
  currentMaterialId,
  fontAvailability,
  onChange,
  onReset,
  onPlace,
  placing,
  canPlace,
}: {
  preview: StampInput
  currentTemplateId: StampTemplateId
  currentMaterialId: StampMaterialId
  fontAvailability: Record<StampFontId, boolean>
  onChange: (stamp: StampInput) => void
  onReset: () => void
  onPlace: () => void
  placing: boolean
  canPlace: boolean
}) {
  const { t } = useI18n()
  const materialCompatible = isStampMaterialCompatible(currentMaterialId, preview.label)
  const materialReady = isStampMaterialFontReady(currentMaterialId, fontAvailability)
  const visibleMaterials = VISIBLE_STAMP_MATERIALS.filter((material) => isStampMaterialFontReady(material.id, fontAvailability))

  function updateFromTemplate(templateId: StampTemplateId) {
    const template = getStampTemplate(templateId)
    const material = getStampMaterial(currentMaterialId)
    onChange({
      ...preview,
      template_id: template.id,
      template_snapshot: createStampSnapshot(template.id, material.id),
      label: t(template.labelKey as never),
      color: template.color,
      rotation: clampStampRotation(template.rotation + material.rotationOffset),
    })
  }

  function updateMaterial(materialId: StampMaterialId) {
    const template = getStampTemplate(currentTemplateId)
    const material = getStampMaterial(materialId)
    onChange({
      ...preview,
      template_snapshot: createStampSnapshot(template.id, material.id),
      rotation: clampStampRotation(template.rotation + material.rotationOffset),
      size: material.defaultSize,
      opacity: material.defaultOpacity,
    })
  }

  function updateNumber(key: 'size' | 'rotation' | 'opacity', value: number) {
    onChange({
      ...preview,
      [key]: key === 'size'
        ? clampStampSize(value)
        : key === 'rotation'
          ? clampStampRotation(value)
          : clampStampOpacity(value),
    })
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
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
            menuZIndex={OVERLAY_Z_INDEX.modal + 10}
          />

          <textarea
            value={preview.label || ''}
            onChange={(event) => onChange({ ...preview, label: event.target.value })}
            placeholder={t('stamps.labelPlaceholder')}
            rows={1}
            className="min-h-11 w-full resize-y rounded-xl border border-border-color bg-bg-secondary px-3 py-2.5 text-sm leading-relaxed text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-soft"
          />
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-text-muted">{t('stamps.color')}</p>
          <div className="flex flex-wrap items-center gap-2">
            {INK_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => onChange({ ...preview, color })}
                className={clsx(
                  'h-8 w-8 rounded-full border transition-transform hover:scale-105',
                  preview.color.toLowerCase() === color.toLowerCase() ? 'border-accent ring-2 ring-accent-soft' : 'border-border-color'
                )}
                style={{ backgroundColor: color }}
                title={t('stamps.color')}
              />
            ))}
            <label className="flex h-8 items-center gap-2 rounded-full border border-border-color bg-bg-secondary px-2 text-xs text-text-secondary">
              <Palette size={13} />
              {t('stamps.customColor')}
              <input
                type="color"
                value={preview.color}
                onChange={(event) => onChange({ ...preview, color: event.target.value })}
                className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
                aria-label={t('stamps.customColor')}
              />
            </label>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-text-muted">{t('stamps.material')}</p>
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
            {visibleMaterials.map((material) => {
              const compatible = isStampMaterialCompatible(material.id, preview.label)
              return (
                <button
                  key={material.id}
                  type="button"
                  onClick={() => updateMaterial(material.id)}
                  disabled={!compatible}
                  className={clsx(
                    'flex min-h-14 items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45',
                    currentMaterialId === material.id
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-border-color bg-bg-secondary text-text-secondary hover:border-border-hover hover:text-text-primary'
                  )}
                  title={compatible ? t(material.labelKey as never) : t('stamps.materialCompatibility')}
                >
                  <StampMaterialPreview materialId={material.id} color={preview.color} />
                  <span className="min-w-0 text-xs font-semibold">{t(material.labelKey as never)}</span>
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-[11px] text-text-muted">{t('stamps.materialCompatibility')}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <StampRange
            label={t('stamps.size')}
            value={preview.size ?? 1}
            min={STAMP_SIZE_MIN}
            max={STAMP_SIZE_MAX}
            step={0.05}
            display={`${Math.round((preview.size ?? 1) * 100)}%`}
            onChange={(value) => updateNumber('size', value)}
          />
          <StampRange
            label={t('stamps.rotation')}
            value={preview.rotation ?? 0}
            min={STAMP_ROTATION_MIN}
            max={STAMP_ROTATION_MAX}
            step={1}
            display={`${Math.round(preview.rotation ?? 0)} deg`}
            onChange={(value) => updateNumber('rotation', value)}
          />
          <StampRange
            label={t('stamps.opacity')}
            value={preview.opacity ?? 0.92}
            min={STAMP_OPACITY_MIN}
            max={STAMP_OPACITY_MAX}
            step={0.01}
            display={`${Math.round((preview.opacity ?? 0.92) * 100)}%`}
            onChange={(value) => updateNumber('opacity', value)}
          />
        </div>
      </div>

      <aside className="flex min-h-0 flex-col gap-3 rounded-2xl border border-border-color bg-bg-secondary/30 p-3">
        <StampPreviewPanel preview={preview} />
        <div className="mt-auto space-y-2 border-t border-border-color pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-2 rounded-lg text-xs text-text-muted transition-colors hover:text-accent"
            >
              <RotateCcw size={13} />
              {t('stamps.reset')}
            </button>
            <button
              type="button"
              onClick={onPlace}
              disabled={!canPlace || !materialCompatible || !materialReady}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition-colors hover:bg-accent-hover disabled:pointer-events-none disabled:opacity-55"
              title={materialCompatible && materialReady ? undefined : t('stamps.materialCompatibility')}
            >
              <StampIcon size={15} />
              {placing ? t('stamps.cancelPlacement') : t('stamps.place')}
            </button>
          </div>
          {!materialCompatible && <p className="text-[11px] text-amber-500">{t('stamps.materialCompatibility')}</p>}
          {!materialReady && <p className="text-[11px] text-amber-500">{t('stamps.fontRequired')}</p>}
          <p className="text-[11px] text-text-muted">{t('stamps.placeHint')}</p>
        </div>
      </aside>
    </div>
  )
}

function StampPreviewPanel({ preview }: { preview: StampInput }) {
  const { t } = useI18n()
  const centeredPreview: StampInput = {
    ...preview,
    position: 'center',
    x: 50,
    y: 50,
  }

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-text-muted">{t('stamps.preview')}</p>
      <div className="relative h-56 overflow-hidden rounded-2xl border border-border-color bg-bg-primary/70 shadow-inner">
        <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] [background-size:28px_28px]" />
        <div className="absolute inset-5 rounded-xl border border-dashed border-border-color/70" />
        <StampOverlay stamp={centeredPreview} className="z-10" />
      </div>
    </div>
  )
}

function StampRange({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  onChange: (value: number) => void
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between gap-3 text-xs font-medium text-text-muted">
        <span>{label}</span>
        <span className="tabular-nums text-text-secondary">{display}</span>
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full accent-[var(--color-accent)]"
      />
    </label>
  )
}

function StampMaterialPreview({ materialId, color }: { materialId: StampMaterialId; color: string }) {
  if (materialId === 'wax') {
    return (
      <span
        className="h-8 w-8 shrink-0 rounded-full border"
        style={{
          background: `radial-gradient(circle at 35% 28%, color-mix(in srgb, ${color} 68%, white), ${color})`,
          borderColor: color,
          borderRadius: '47% 53% 44% 56% / 54% 45% 55% 46%',
        }}
      />
    )
  }

  if (materialId === 'ticket') {
    return <span className="h-7 w-9 shrink-0 rounded-md border-2 border-dashed" style={{ borderColor: color }} />
  }

  if (materialId === 'seal-script') {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border-2" style={{ borderColor: color }}>
        <span className="h-4 w-4 rounded-sm border" style={{ borderColor: `${color}88` }} />
      </span>
    )
  }

  if (materialId === 'calligraphy') {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border-2" style={{ borderColor: color }}>
        <span className="h-5 w-5 rounded-sm border border-dashed" style={{ borderColor: `${color}88` }} />
      </span>
    )
  }

  if (materialId === 'running-script' || materialId === 'flourish') {
    return (
      <span className="flex h-7 w-10 shrink-0 items-center justify-center rounded-full border-2" style={{ borderColor: color }}>
        <span className="h-px w-6 rotate-[-8deg] rounded-full" style={{ backgroundColor: color, boxShadow: `0 -4px 0 -1px ${color}` }} />
      </span>
    )
  }

  if (materialId === 'paper-label') {
    return <span className="h-6 w-10 shrink-0 rounded-sm border-2 border-dashed bg-bg-primary/70" style={{ borderColor: color }} />
  }

  if (materialId === 'date') {
    return (
      <span className="flex h-7 w-10 shrink-0 flex-col justify-center rounded-sm border-2 px-1" style={{ borderColor: color }}>
        <span className="h-px w-full" style={{ backgroundColor: color }} />
        <span className="mt-1 h-px w-full" style={{ backgroundColor: color }} />
      </span>
    )
  }

  if (materialId === 'oval') {
    return <span className="h-7 w-10 shrink-0 rounded-full border-2" style={{ borderColor: color }} />
  }

  return <span className="h-8 w-8 shrink-0 rounded-full border-2" style={{ borderColor: color }} />
}

function getVisibleMaterialId(materialId: StampMaterialId): StampMaterialId {
  return materialId === 'running-script' ? 'flourish' : materialId
}

function isStampMaterialCompatible(materialId: StampMaterialId, label: string): boolean {
  const text = label.trim()
  if (!text) return true
  if (materialId === 'seal-script' || materialId === 'calligraphy') return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text)
  if (materialId === 'flourish' || materialId === 'running-script') return /^[A-Za-z0-9 '&.,:;!?@#()\-\r\n]+$/.test(text)
  return true
}
