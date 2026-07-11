import clsx from 'clsx'
import { Trash2, X } from 'lucide-react'
import type { Illustration, JournalDraftItem, JournalPageOrientation, Note } from '../../../types'
import { useI18n } from '../../../i18n/useI18n'
import { clampLayout, type JournalLayoutInput } from '../../../features/journal/journalLayout'
import { getJournalMaterialDefinition } from '../../../features/journal/journalMaterials'
import {
  getDraftImageItemStyle,
  getDraftNoteCardStyle,
  getMaterialStylePayload,
  patchStylePayload,
  type ImageItemStyle,
  type NoteCardStyle,
} from '../../../features/journal/journalItemStyles'
import { getDraftItemConstraints } from '../../../features/journal/journalItemSizing'
import { asNumber, asString } from '../../../utils/safeJson'
import { Button } from '../../ui/Button'
import { getItemLayout } from './journalDraftCanvasGeometry'

export interface JournalItemDetailPanelProps {
  item: JournalDraftItem
  note?: Note
  illustration?: Illustration
  orientation: JournalPageOrientation
  onUpdateItem: (itemId: string, layout: JournalLayoutInput & { zIndex?: number; stylePayload?: string }) => void
  onRemoveItem: (itemId: string) => void
  onClose: () => void
}

export function JournalItemDetailPanel({ item, note, illustration, orientation, onUpdateItem, onRemoveItem, onClose }: JournalItemDetailPanelProps) {
  const { t } = useI18n()
  return (
    <aside className="fixed bottom-5 right-5 top-20 z-[85] w-80 overflow-y-auto rounded-2xl border border-border-color bg-bg-card/95 p-4 shadow-2xl backdrop-blur">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t('journalCreate.detailPanel')}</p>
          <h2 className="mt-1 text-base font-bold text-text-primary">{getDetailTitle(item, note, illustration, t)}</h2>
        </div>
        <button type="button" className="rounded-lg p-2 text-text-muted hover:bg-bg-secondary hover:text-text-primary" onClick={onClose} title={t('common.cancel')}><X size={16} /></button>
      </div>
      <div className="grid gap-4">
        {item.itemType === 'note' && <NoteDetailControls item={item} note={note} onUpdateItem={onUpdateItem} />}
        {item.itemType === 'illustration' && <ImageDetailControls item={item} orientation={orientation} onUpdateItem={onUpdateItem} />}
        {item.itemType === 'material' && <MaterialDetailControls item={item} orientation={orientation} onUpdateItem={onUpdateItem} />}
        <Button variant="ghost" size="sm" className="w-full text-red-500" onClick={() => onRemoveItem(item.draftId)}>
          <Trash2 size={15} />
          {t('journalInspector.removeFromPage')}
        </Button>
      </div>
    </aside>
  )
}

function NoteDetailControls({ item, note, onUpdateItem }: { item: JournalDraftItem; note?: Note; onUpdateItem: JournalItemDetailPanelProps['onUpdateItem'] }) {
  const { t } = useI18n()
  const noteCard = getDraftNoteCardStyle(item, note, t('common.untitled'), t('common.noContent'))
  function update(change: Partial<NoteCardStyle>) { updateStylePayload(item, { noteCard: { ...noteCard, ...change } }, onUpdateItem) }
  return (
    <>
      <ToggleField label={t('journalCreate.detail.titleVisible')} checked={noteCard.titleVisible} onChange={(value) => update({ titleVisible: value })} />
      <TextField label={t('journalCreate.detail.titleText')} value={noteCard.titleText} onChange={(value) => update({ titleText: value })} />
      <TextAreaField label={t('journalCreate.detail.bodyText')} value={noteCard.bodyText} onChange={(value) => update({ bodyText: value.slice(0, 200) })} rows={5} />
      <SelectField label={t('journalCreate.detail.fontFamily')} value={noteCard.fontFamily} options={FONT_OPTIONS} onChange={(value) => update({ fontFamily: value })} />
      <RangeField label={t('journalCreate.detail.fontSize')} value={noteCard.fontSize} min={10} max={28} step={1} onChange={(value) => update({ fontSize: value })} />
      <RangeField label={t('journalCreate.detail.fontWeight')} value={noteCard.fontWeight} min={300} max={800} step={100} onChange={(value) => update({ fontWeight: value })} />
      <RangeField label={t('journalCreate.detail.lineHeight')} value={noteCard.lineHeight} min={1.1} max={1.9} step={0.1} onChange={(value) => update({ lineHeight: value })} />
      <ColorField label={t('journalCreate.detail.textColor')} value={noteCard.textColor} onChange={(value) => update({ textColor: value })} />
      <ColorField label={t('journalCreate.detail.backgroundColor')} value={noteCard.backgroundColor} onChange={(value) => update({ backgroundColor: value })} />
      <RangeField label={t('journalCreate.detail.padding')} value={noteCard.padding} min={6} max={28} step={1} onChange={(value) => update({ padding: value })} />
      <RangeField label={t('journalCreate.detail.radius')} value={noteCard.radius} min={0} max={28} step={1} onChange={(value) => update({ radius: value })} />
      <ToggleField label={t('journalCreate.detail.showTags')} checked={noteCard.showTags} onChange={(value) => update({ showTags: value })} />
    </>
  )
}

function ImageDetailControls({ item, orientation, onUpdateItem }: { item: JournalDraftItem; orientation: JournalPageOrientation; onUpdateItem: JournalItemDetailPanelProps['onUpdateItem'] }) {
  const { t } = useI18n()
  const style = getDraftImageItemStyle(item)
  function update(change: Partial<ImageItemStyle>) { updateStylePayload(item, { imageStyle: { ...style, ...change } }, onUpdateItem) }
  return (
    <>
      <SelectField label={t('journalCreate.detail.imageFit')} value={style.fit} options={[{ value: 'contain', label: 'Contain' }, { value: 'cover', label: 'Cover' }]} onChange={(value) => update({ fit: value as ImageItemStyle['fit'] })} />
      <SelectField label={t('journalCreate.detail.frame')} value={style.frame} options={[{ value: 'none', label: 'None' }, { value: 'simple', label: 'Simple' }, { value: 'paper', label: 'Paper' }, { value: 'polaroid', label: 'Polaroid' }]} onChange={(value) => update({ frame: value as ImageItemStyle['frame'] })} />
      <RangeField label={t('journalCreate.detail.borderWidth')} value={style.borderWidth} min={0} max={12} step={1} onChange={(value) => update({ borderWidth: value })} />
      <ColorField label={t('journalCreate.detail.borderColor')} value={style.borderColor} onChange={(value) => update({ borderColor: value })} />
      <RangeField label={t('journalCreate.detail.radius')} value={style.radius} min={0} max={32} step={1} onChange={(value) => update({ radius: value })} />
      <RangeField label={t('journalCreate.detail.shadow')} value={style.shadow} min={0} max={40} step={1} onChange={(value) => update({ shadow: value })} />
      <ColorField label={t('journalCreate.detail.backgroundColor')} value={style.backgroundColor} onChange={(value) => update({ backgroundColor: value })} />
      <LayoutNumberControls item={item} orientation={orientation} onUpdateItem={onUpdateItem} />
    </>
  )
}

function MaterialDetailControls({ item, orientation, onUpdateItem }: { item: JournalDraftItem; orientation: JournalPageOrientation; onUpdateItem: JournalItemDetailPanelProps['onUpdateItem'] }) {
  const { t } = useI18n()
  const material = getJournalMaterialDefinition(item.materialId)
  const style = getMaterialStylePayload(item.stylePayload, item.materialId)
  const isTape = material?.kind === 'tape'
  const isSticker = material?.kind === 'sticker'
  function update(change: Record<string, unknown>) { updateStylePayload(item, { ...style, ...change }, onUpdateItem) }
  return (
    <>
      {isTape && <SelectField label={t('journalInspector.tapeStyle')} value={asString(style.tapeStyle) || 'washi'} options={[
        { value: 'washi', label: t('journalInspector.tape.washi') },
        { value: 'grid', label: t('journalInspector.tape.grid') },
        { value: 'dots', label: t('journalInspector.tape.dots') },
        { value: 'stripe', label: t('journalInspector.tape.stripe') },
        { value: 'torn', label: t('journalInspector.tape.torn') },
      ]} onChange={(value) => update({ tapeStyle: value })} />}
      <SwatchField label={t('journalInspector.color')} value={asString(style.color) || '#d9c4ff'} colors={isTape ? TAPE_COLORS : isSticker ? STICKER_COLORS : PAPER_COLORS} onChange={(value) => update({ color: value })} />
      {isSticker && (
        <>
          <ToggleField label={t('journalCreate.detail.backing')} checked={style.backing === true} onChange={(value) => update({ backing: value })} />
          <SelectField label={t('journalCreate.detail.backingShape')} value={asString(style.backingShape) || 'circle'} options={[{ value: 'circle', label: 'Circle' }, { value: 'square', label: 'Square' }]} onChange={(value) => update({ backingShape: value })} />
        </>
      )}
      <RangeField label={t('journalCreate.glassStrength')} value={asNumber(style.glassStrength, 0)} min={0} max={100} step={5} onChange={(value) => update({ glassStrength: value })} />
      <LayoutNumberControls item={item} orientation={orientation} onUpdateItem={onUpdateItem} />
    </>
  )
}

function LayoutNumberControls({ item, orientation, onUpdateItem }: { item: JournalDraftItem; orientation: JournalPageOrientation; onUpdateItem: JournalItemDetailPanelProps['onUpdateItem'] }) {
  const { t } = useI18n()
  function update(change: Partial<JournalLayoutInput>) { onUpdateItem(item.draftId, clampLayout({ ...getItemLayout(item), ...change }, getDraftItemConstraints(item), orientation)) }
  return (
    <div className="grid grid-cols-2 gap-2">
      <NumberField label={t('journalInspector.width')} value={Math.round(item.width)} onChange={(value) => update({ width: value })} />
      <NumberField label={t('journalInspector.height')} value={Math.round(item.height)} onChange={(value) => update({ height: value })} />
      <NumberField label={t('journalInspector.rotation')} value={Math.round(item.rotation)} onChange={(value) => update({ rotation: value })} />
    </div>
  )
}

function updateStylePayload(item: JournalDraftItem, change: Record<string, unknown>, onUpdateItem: JournalItemDetailPanelProps['onUpdateItem']) {
  onUpdateItem(item.draftId, { ...getItemLayout(item), stylePayload: patchStylePayload(item.stylePayload, change) })
}

function getDetailTitle(item: JournalDraftItem, note: Note | undefined, illustration: Illustration | undefined, t: ReturnType<typeof useI18n>['t']) {
  if (item.itemType === 'note') return note?.title || t('journalEditor.addNote')
  if (item.itemType === 'illustration') return illustration?.title || illustration?.original_filename || t('journalEditor.addIllustration')
  const material = getJournalMaterialDefinition(item.materialId)
  return material ? t(material.nameKey) : t('journalEditor.addMaterials')
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="grid gap-1.5 text-xs font-semibold text-text-muted">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className={detailInputClass} /></label>
}

function TextAreaField({ label, value, rows, onChange }: { label: string; value: string; rows: number; onChange: (value: string) => void }) {
  return <label className="grid gap-1.5 text-xs font-semibold text-text-muted">{label}<textarea value={value} rows={rows} onChange={(event) => onChange(event.target.value)} className={`${detailInputClass} resize-none`} /></label>
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="grid gap-1.5 text-xs font-semibold text-text-muted">{label}<input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} className={detailInputClass} /></label>
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="grid gap-1.5 text-xs font-semibold text-text-muted">{label}<input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-xl border border-border-color bg-bg-primary p-1" /></label>
}

function RangeField({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return <label className="grid gap-1.5 text-xs font-semibold text-text-muted"><span className="flex justify-between gap-2"><span>{label}</span><span>{value}</span></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="accent-[var(--color-accent)]" /></label>
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-center justify-between gap-3 rounded-xl border border-border-color bg-bg-primary px-3 py-2 text-xs font-semibold text-text-secondary">{label}<input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" /></label>
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return <label className="grid gap-1.5 text-xs font-semibold text-text-muted">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className={detailInputClass}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
}

function SwatchField({ label, value, colors, onChange }: { label: string; value: string; colors: string[]; onChange: (value: string) => void }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-text-muted">{label}</p>
      <div className="flex flex-wrap gap-2">
        {colors.map((color) => <button key={color} type="button" onClick={() => onChange(color)} className={clsx('h-8 w-8 rounded-full border shadow-sm transition-transform hover:scale-105', value === color ? 'border-accent ring-2 ring-accent-soft' : 'border-border-color')} style={{ backgroundColor: color }} title={color} />)}
      </div>
    </div>
  )
}

const FONT_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'serif', label: 'Serif' },
  { value: 'sans', label: 'Sans' },
  { value: 'mono', label: 'Mono' },
  { value: 'casual', label: 'Casual' },
]
const TAPE_COLORS = ['#d9c4ff', '#f6b8d2', '#b8ddff', '#f8dfa0', '#b8ead8', '#f0c9ad']
const STICKER_COLORS = ['#ef6f9f', '#f0b84a', '#7ab7e8', '#e58fbd', '#8a83d6', '#688ea8']
const PAPER_COLORS = ['#fff1f5', '#eef6ff', '#fff7d6', '#f3f0ff', '#edf7ed', '#fffdf8']
const detailInputClass = 'min-w-0 rounded-xl border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-soft'
