import { ArrowUp, ImageIcon, Minus, Plus, RotateCcw, StickyNote, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type DragEvent } from 'react'
import type { Illustration, JournalDraftItem, JournalPageOrientation, Note, StampInput } from '../../../types'
import { clampLayout, getJournalPageSize, type JournalLayoutInput } from '../../../features/journal/journalLayout'
import { getDraftItemConstraints } from '../../../features/journal/journalItemSizing'
import { getMaterializedTemplateSlots } from '../../../features/journal/journalPageTemplates'
import { parseStylePayload, patchStylePayload } from '../../../features/journal/journalItemStyles'
import { asNumber, safeJsonParse, isRecord } from '../../../utils/safeJson'
import { useI18n } from '../../../i18n/useI18n'
import { getPageBackground } from './journalCanvasStyle'
import { CanvasItemFrame } from './CanvasItemFrame'
import { JournalItemDetailPanel } from './JournalItemDetailPanel'
import { getItemLayout } from './journalDraftCanvasGeometry'
import { StampOverlay } from '../stamps/StampOverlay'
import { StampPlacementLayer } from '../stamps/StampPlacementLayer'

interface JournalDraftCanvasProps {
  background: string
  orientation: JournalPageOrientation
  templateId?: string | null
  items: JournalDraftItem[]
  notesById: Map<string, Note>
  illustrationsById: Map<string, Illustration>
  selectedItemId: string | null
  zoom: number
  stamp: StampInput | null
  stampPlacementDraft: StampInput | null
  stampSoundEnabled: boolean
  onZoomChange: (zoom: number) => void
  onSelectItem: (itemId: string | null) => void
  onUpdateItem: (itemId: string, layout: JournalLayoutInput & { zIndex?: number; stylePayload?: string }) => void
  onRemoveItem: (itemId: string) => void
  onBringForward: (itemId: string) => void
  onDropResource: (payload: DragPayload, point: { x: number; y: number }) => void
  onStampPlace: (stamp: StampInput) => void
  onStampPlacementComplete: () => void
  onStampPlacementCancel: () => void
}

export type DragPayload =
  | { kind: 'note'; id: string }
  | { kind: 'illustration'; id: string }
  | { kind: 'material'; id: string }

export function JournalDraftCanvas({
  background,
  orientation,
  templateId,
  items,
  notesById,
  illustrationsById,
  selectedItemId,
  zoom,
  stamp,
  stampPlacementDraft,
  stampSoundEnabled,
  onZoomChange,
  onSelectItem,
  onUpdateItem,
  onRemoveItem,
  onBringForward,
  onDropResource,
  onStampPlace,
  onStampPlacementComplete,
  onStampPlacementCancel,
}: JournalDraftCanvasProps) {
  const { t } = useI18n()
  const pageSize = getJournalPageSize(orientation)
  const pageRef = useRef<HTMLDivElement>(null)
  const [detailItemId, setDetailItemId] = useState<string | null>(null)
  const selectedItem = items.find((item) => item.draftId === selectedItemId) || null
  const detailItem = items.find((item) => item.draftId === detailItemId) || null
  const filledTemplateSlotIds = new Set(items.map((item) => item.templateSlotId).filter(Boolean))
  const emptyTemplateSlots = getMaterializedTemplateSlots(templateId, orientation).filter((templateSlot) => !filledTemplateSlotIds.has(templateSlot.id))

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) { if (event.key === 'Escape') setDetailItemId(null) }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (detailItemId && !items.some((item) => item.draftId === detailItemId)) setDetailItemId(null)
  }, [detailItemId, items])

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    const raw = event.dataTransfer.getData('application/x-oshinote-journal-resource')
    const payload = safeJsonParse<DragPayload | null>(raw, null, isDragPayload)
    if (!payload) return
    const rect = event.currentTarget.getBoundingClientRect()
    onDropResource(payload, { x: (event.clientX - rect.left) / zoom, y: (event.clientY - rect.top) / zoom })
  }

  function removeSelectedItem(itemId: string) {
    onRemoveItem(itemId)
    if (detailItemId === itemId) setDetailItemId(null)
  }

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 items-start justify-center overflow-auto bg-[var(--journal-canvas-bg)] p-6">
      <div className="fixed right-6 top-24 z-[70] flex h-10 items-center gap-1 rounded-2xl border border-border-color bg-bg-card/90 p-1 shadow-sm backdrop-blur">
        <button type="button" onClick={() => onZoomChange(Math.max(0.45, zoom - 0.1))} className="rounded-xl p-2 text-text-muted hover:bg-bg-secondary hover:text-accent" title={t('journalEditor.zoomOut')}><Minus size={15} /></button>
        <span className="min-w-12 text-center text-xs font-semibold text-text-secondary">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => onZoomChange(Math.min(1.25, zoom + 0.1))} className="rounded-xl p-2 text-text-muted hover:bg-bg-secondary hover:text-accent" title={t('journalEditor.zoomIn')}><Plus size={15} /></button>
      </div>

      <div style={{ width: pageSize.width * zoom, height: pageSize.height * zoom }}>
        <div
          ref={pageRef}
          data-journal-draft-page="true"
          className="relative overflow-hidden rounded-xl border border-border-color shadow-[0_18px_42px_rgba(40,46,70,0.18)]"
          style={{ width: pageSize.width, height: pageSize.height, transform: `scale(${zoom})`, transformOrigin: 'top left', ...getPageBackground(background) }}
          onClick={(event) => {
            if (event.currentTarget === event.target) {
              onSelectItem(null)
              setDetailItemId(null)
            }
          }}
          onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' }}
          onDrop={handleDrop}
        >
          {items.every((item) => item.itemType === 'material') && emptyTemplateSlots.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center text-sm text-text-muted">{t('journalCreate.dragHint')}</div>
          )}

          {emptyTemplateSlots.map((templateSlot) => {
            const Icon = templateSlot.kind === 'note' ? StickyNote : ImageIcon
            return (
              <div
                key={templateSlot.id}
                className="pointer-events-none absolute flex items-center justify-center rounded-xl border-2 border-dashed border-accent/45 bg-bg-primary/20 text-accent/65"
                style={{ left: templateSlot.layout.x, top: templateSlot.layout.y, width: templateSlot.layout.width, height: templateSlot.layout.height, transform: `rotate(${templateSlot.layout.rotation}deg)`, zIndex: Math.max(1, templateSlot.layout.zIndex - 10) }}
              >
                <span className="flex items-center gap-2 rounded-full bg-bg-card/70 px-3 py-1.5 text-xs font-semibold shadow-sm backdrop-blur-sm"><Icon size={15} />{templateSlot.kind === 'note' ? t('journalTemplates.slot.note') : t('journalTemplates.slot.image')}</span>
              </div>
            )
          })}

          {items.map((item) => (
            <CanvasItemFrame
              key={item.draftId}
              item={item}
              note={item.sourceId ? notesById.get(item.sourceId) : undefined}
              illustration={item.sourceId ? illustrationsById.get(item.sourceId) : undefined}
              selected={item.draftId === selectedItemId}
              orientation={orientation}
              zoom={zoom}
              pageRef={pageRef}
              onSelect={onSelectItem}
              onOpenDetail={(itemId) => { onSelectItem(itemId); setDetailItemId(itemId) }}
              onUpdateItem={onUpdateItem}
            />
          ))}

          <div className="pointer-events-none absolute inset-0">
            <StampOverlay stamp={stamp} />
            <StampPlacementLayer active={Boolean(stampPlacementDraft)} stamp={stampPlacementDraft} soundEnabled={stampSoundEnabled} onPlace={onStampPlace} onComplete={onStampPlacementComplete} onCancel={onStampPlacementCancel} />
          </div>
        </div>
      </div>

      {selectedItem && (
        <div className="fixed bottom-5 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-border-color bg-bg-card/95 p-1.5 shadow-xl backdrop-blur">
          <button className={toolButtonClass} type="button" onClick={() => resizeSelected(selectedItem, -18, -18, orientation, onUpdateItem)}><Minus size={15} /></button>
          <button className={toolButtonClass} type="button" onClick={() => resizeSelected(selectedItem, 18, 18, orientation, onUpdateItem)}><Plus size={15} /></button>
          <button className={toolButtonClass} type="button" onClick={() => rotateSelected(selectedItem, -5, orientation, onUpdateItem)}>-5</button>
          <button className={toolButtonClass} type="button" onClick={() => onUpdateItem(selectedItem.draftId, getItemLayout({ ...selectedItem, rotation: 0 }))}><RotateCcw size={15} /></button>
          <button className={toolButtonClass} type="button" onClick={() => rotateSelected(selectedItem, 5, orientation, onUpdateItem)}>+5</button>
          <button className={toolButtonClass} type="button" onClick={() => onBringForward(selectedItem.draftId)}><ArrowUp size={15} /></button>
          {selectedItem.itemType === 'material' && (
            <label className="flex h-9 items-center gap-2 rounded-xl px-2 text-xs font-semibold text-text-muted">
              {t('journalCreate.glassStrength')}
              <input type="range" min={0} max={100} step={5} value={getMaterialGlassStrength(selectedItem)} onChange={(event) => updateMaterialGlassStrength(selectedItem, Number(event.target.value), onUpdateItem)} className="w-24 accent-[var(--color-accent)]" />
            </label>
          )}
          <button className={`${toolButtonClass} text-red-500`} type="button" onClick={() => removeSelectedItem(selectedItem.draftId)}><Trash2 size={15} /></button>
        </div>
      )}

      {detailItem && (
        <JournalItemDetailPanel
          item={detailItem}
          note={detailItem.sourceId ? notesById.get(detailItem.sourceId) : undefined}
          illustration={detailItem.sourceId ? illustrationsById.get(detailItem.sourceId) : undefined}
          orientation={orientation}
          onUpdateItem={onUpdateItem}
          onRemoveItem={removeSelectedItem}
          onClose={() => setDetailItemId(null)}
        />
      )}
    </div>
  )
}

function resizeSelected(item: JournalDraftItem, widthDelta: number, heightDelta: number, orientation: JournalPageOrientation, onUpdateItem: JournalDraftCanvasProps['onUpdateItem']) {
  onUpdateItem(item.draftId, clampLayout({ ...getItemLayout(item), width: item.width + widthDelta, height: item.height + heightDelta }, getDraftItemConstraints(item), orientation))
}

function rotateSelected(item: JournalDraftItem, delta: number, orientation: JournalPageOrientation, onUpdateItem: JournalDraftCanvasProps['onUpdateItem']) {
  onUpdateItem(item.draftId, clampLayout({ ...getItemLayout(item), rotation: item.rotation + delta }, getDraftItemConstraints(item), orientation))
}

function getMaterialGlassStrength(item: JournalDraftItem): number {
  return Math.min(100, Math.max(0, asNumber(parseStylePayload(item.stylePayload).glassStrength, 0)))
}

function updateMaterialGlassStrength(item: JournalDraftItem, glassStrength: number, onUpdateItem: JournalDraftCanvasProps['onUpdateItem']) {
  onUpdateItem(item.draftId, { ...getItemLayout(item), stylePayload: patchStylePayload(item.stylePayload, { glassStrength }) })
}

function isDragPayload(value: unknown): value is DragPayload {
  if (!isRecord(value) || typeof value.id !== 'string') return false
  return value.kind === 'note' || value.kind === 'illustration' || value.kind === 'material'
}

const toolButtonClass = 'flex h-9 min-w-9 items-center justify-center rounded-xl px-2 text-xs font-semibold text-text-muted transition-colors hover:bg-bg-secondary hover:text-accent'
