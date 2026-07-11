import type { TranslationKey } from '../../i18n/translations'
import type { JournalDraftItem, JournalDraftItemType, JournalPageOrientation, ResourceTemplate } from '../../types'
import { isRecord } from '../../utils/safeJson'
import type { JournalBackgroundPresetId } from './journalBackgrounds'
import { getJournalPageSize } from './journalLayout'
import { getJournalMaterialDefinition, getMaterialSnapshot } from './journalMaterials'
import { parseStylePayload, serializeStylePayload } from './journalItemStyles'

export interface NormalizedJournalLayout {
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
}

export interface JournalTemplateSlot {
  id: string
  kind: Extract<JournalDraftItemType, 'note' | 'illustration'>
  layout: NormalizedJournalLayout
  styleOverrides?: Record<string, unknown>
}

export interface JournalTemplateDecoration {
  materialId: string
  layout: NormalizedJournalLayout
  styleOverrides?: Record<string, unknown>
}

export interface JournalPageTemplateDefinition {
  id: string
  nameKey: TranslationKey
  descriptionKey: TranslationKey
  preferredOrientation: JournalPageOrientation
  background: JournalBackgroundPresetId
  slots: JournalTemplateSlot[]
  decorations: JournalTemplateDecoration[]
}

export interface MaterializedJournalTemplateSlot extends Omit<JournalTemplateSlot, 'layout'> {
  layout: ReturnType<typeof materializeTemplateLayout>
}

export interface JournalTemplateApplication {
  templateId: string | null
  background?: JournalBackgroundPresetId
  orientation?: JournalPageOrientation
  items: JournalDraftItem[]
}

export const JOURNAL_PAGE_TEMPLATES: JournalPageTemplateDefinition[] = [
  {
    id: 'live-highlight',
    nameKey: 'journalTemplates.liveHighlight.name',
    descriptionKey: 'journalTemplates.liveHighlight.description',
    preferredOrientation: 'portrait',
    background: 'sakura',
    slots: [
      slot('live-image', 'illustration', 0.18, 0.10, 0.68, 0.39, 1, 20, { imageStyle: { frame: 'paper', radius: 16, shadow: 14 } }),
      slot('live-note', 'note', 0.12, 0.55, 0.70, 0.29, -2, 22, { noteCard: { backgroundColor: '#fff7d6', radius: 18 } }),
    ],
    decorations: [
      decoration('washi-sakura', 0.25, 0.06, 0.50, 0.055, -4, 30),
      decoration('sparkle', 0.81, 0.48, 0.10, 0.075, 7, 32),
      decoration('label-date', 0.67, 0.86, 0.22, 0.06, 3, 31),
    ],
  },
  {
    id: 'quiet-letter',
    nameKey: 'journalTemplates.quietLetter.name',
    descriptionKey: 'journalTemplates.quietLetter.description',
    preferredOrientation: 'portrait',
    background: 'envelope',
    slots: [
      slot('letter-note', 'note', 0.12, 0.16, 0.72, 0.42, -1, 20, { noteCard: { backgroundColor: '#fffaf0', fontFamily: 'serif', radius: 10 } }),
      slot('letter-image', 'illustration', 0.49, 0.63, 0.36, 0.25, 3, 22, { imageStyle: { frame: 'polaroid', radius: 8, shadow: 18 } }),
    ],
    decorations: [
      decoration('paper-torn', 0.08, 0.09, 0.42, 0.05, -5, 30),
      decoration('flower', 0.13, 0.68, 0.12, 0.085, -8, 32),
      decoration('label-date', 0.16, 0.80, 0.24, 0.06, -3, 31),
    ],
  },
  {
    id: 'double-scene',
    nameKey: 'journalTemplates.doubleScene.name',
    descriptionKey: 'journalTemplates.doubleScene.description',
    preferredOrientation: 'landscape',
    background: 'blue-hour',
    slots: [
      slot('scene-left', 'illustration', 0.07, 0.15, 0.38, 0.43, -2, 20, { imageStyle: { frame: 'simple', borderWidth: 2, borderColor: '#ffffff', radius: 14, shadow: 12 } }),
      slot('scene-right', 'illustration', 0.55, 0.15, 0.38, 0.43, 2, 21, { imageStyle: { frame: 'simple', borderWidth: 2, borderColor: '#ffffff', radius: 14, shadow: 12 } }),
      slot('scene-note', 'note', 0.20, 0.66, 0.60, 0.22, 0, 22, { noteCard: { backgroundColor: '#e9f4ff', radius: 14 } }),
    ],
    decorations: [
      decoration('washi-blue-grid', 0.31, 0.08, 0.38, 0.055, -2, 30),
      decoration('star', 0.04, 0.68, 0.075, 0.10, -8, 32),
      decoration('sparkle', 0.88, 0.65, 0.08, 0.11, 8, 32),
    ],
  },
  {
    id: 'ticket-memory',
    nameKey: 'journalTemplates.ticketMemory.name',
    descriptionKey: 'journalTemplates.ticketMemory.description',
    preferredOrientation: 'landscape',
    background: 'postcard',
    slots: [
      slot('ticket-image', 'illustration', 0.07, 0.13, 0.48, 0.68, -1, 20, { imageStyle: { frame: 'paper', radius: 12, shadow: 15 } }),
      slot('ticket-note', 'note', 0.61, 0.20, 0.31, 0.45, 2, 22, { noteCard: { backgroundColor: '#fff4cf', radius: 12 } }),
    ],
    decorations: [
      decoration('label-ticket', 0.64, 0.72, 0.22, 0.09, -4, 31),
      decoration('washi-maple', 0.57, 0.10, 0.36, 0.06, 4, 30),
      decoration('camera', 0.88, 0.73, 0.08, 0.11, 6, 32),
    ],
  },
  {
    id: 'monthly-recap',
    nameKey: 'journalTemplates.monthlyRecap.name',
    descriptionKey: 'journalTemplates.monthlyRecap.description',
    preferredOrientation: 'portrait',
    background: 'grid',
    slots: [
      slot('month-image-one', 'illustration', 0.09, 0.12, 0.36, 0.25, -2, 20, { imageStyle: { frame: 'paper', radius: 10, shadow: 10 } }),
      slot('month-image-two', 'illustration', 0.55, 0.12, 0.36, 0.25, 2, 21, { imageStyle: { frame: 'paper', radius: 10, shadow: 10 } }),
      slot('month-note-one', 'note', 0.10, 0.44, 0.38, 0.25, -1, 22, { noteCard: { backgroundColor: '#fff7d6', radius: 14 } }),
      slot('month-note-two', 'note', 0.52, 0.61, 0.38, 0.24, 1, 23, { noteCard: { backgroundColor: '#dff0ff', radius: 14 } }),
    ],
    decorations: [
      decoration('label-date', 0.39, 0.04, 0.22, 0.06, 0, 31),
      decoration('washi-lilac', 0.18, 0.88, 0.48, 0.05, -2, 30),
      decoration('music-note', 0.82, 0.42, 0.09, 0.075, 8, 32),
    ],
  },
]

export function getJournalPageTemplateDefinition(id: string | null | undefined): JournalPageTemplateDefinition | null {
  return JOURNAL_PAGE_TEMPLATES.find((template) => template.id === id) || null
}

export function materializeTemplateLayout(layout: NormalizedJournalLayout, orientation: JournalPageOrientation) {
  const pageSize = getJournalPageSize(orientation)
  return {
    x: Math.round(layout.x * pageSize.width),
    y: Math.round(layout.y * pageSize.height),
    width: Math.max(1, Math.round(layout.width * pageSize.width)),
    height: Math.max(1, Math.round(layout.height * pageSize.height)),
    rotation: layout.rotation,
    zIndex: layout.zIndex,
  }
}

export function getMaterializedTemplateSlots(templateId: string | null | undefined, orientation: JournalPageOrientation): MaterializedJournalTemplateSlot[] {
  const template = getJournalPageTemplateDefinition(templateId)
  if (!template) return []
  return template.slots.map((templateSlot) => ({
    ...templateSlot,
    layout: materializeTemplateLayout(templateSlot.layout, orientation),
  }))
}

export function getAvailableTemplateSlot(
  templateId: string | null | undefined,
  items: JournalDraftItem[],
  kind: Extract<JournalDraftItemType, 'note' | 'illustration'>,
  orientation: JournalPageOrientation,
  point?: { x: number; y: number }
): MaterializedJournalTemplateSlot | null {
  const filledSlotIds = new Set(items.map((item) => item.templateSlotId).filter(Boolean))
  const available = getMaterializedTemplateSlots(templateId, orientation)
    .filter((templateSlot) => templateSlot.kind === kind && !filledSlotIds.has(templateSlot.id))
  if (!point) return available[0] || null
  return available.find((templateSlot) => pointInsideLayout(point, templateSlot.layout)) || null
}

export function placeDraftItemInTemplateSlot(item: JournalDraftItem, templateId: string, templateSlot: MaterializedJournalTemplateSlot): JournalDraftItem {
  return {
    ...item,
    ...templateSlot.layout,
    templateSlotId: templateSlot.id,
    templateSourceId: templateId,
    templateGenerated: false,
    stylePayload: mergeTemplateStylePayload(item.stylePayload, templateSlot.styleOverrides),
  }
}

export function applyJournalPageTemplate(
  templateId: string | null,
  currentItems: JournalDraftItem[],
  createId: () => string = createTemplateDraftId,
  orientationOverride?: JournalPageOrientation
): JournalTemplateApplication {
  const userItems = currentItems.filter((item) => !item.templateGenerated)
  if (!templateId) {
    return {
      templateId: null,
      items: userItems.map(clearTemplateMetadata),
    }
  }

  const template = getJournalPageTemplateDefinition(templateId)
  if (!template) return { templateId: null, items: userItems.map(clearTemplateMetadata) }
  const targetOrientation = orientationOverride || template.preferredOrientation

  const slotsByKind = {
    note: template.slots.filter((templateSlot) => templateSlot.kind === 'note'),
    illustration: template.slots.filter((templateSlot) => templateSlot.kind === 'illustration'),
  }
  const nextSlotIndex = { note: 0, illustration: 0 }
  const reassignedItems = userItems.map((item) => {
    if (item.itemType !== 'note' && item.itemType !== 'illustration') return clearTemplateMetadata(item)
    const slotList = slotsByKind[item.itemType]
    const templateSlot = slotList[nextSlotIndex[item.itemType]++]
    if (!templateSlot) return clearTemplateMetadata(item)
    return placeDraftItemInTemplateSlot(item, template.id, {
      ...templateSlot,
      layout: materializeTemplateLayout(templateSlot.layout, targetOrientation),
    })
  })

  return {
    templateId: template.id,
    background: template.background,
    orientation: targetOrientation,
    items: [...reassignedItems, ...createTemplateDecorationItems(template, createId, targetOrientation)],
  }
}

export function createTemplateDecorationItems(
  template: JournalPageTemplateDefinition,
  createId: () => string = createTemplateDraftId,
  orientation: JournalPageOrientation = template.preferredOrientation
): JournalDraftItem[] {
  return template.decorations.flatMap((templateDecoration) => {
    const material = getJournalMaterialDefinition(templateDecoration.materialId)
    if (!material) return []
    const layout = materializeTemplateLayout(templateDecoration.layout, orientation)
    return [{
      draftId: createId(),
      itemType: 'material' as const,
      materialId: material.id,
      materialSnapshot: getMaterialSnapshot(material),
      stylePayload: mergeTemplateStylePayload(serializeStylePayload(material.defaultStyle), templateDecoration.styleOverrides),
      ...layout,
      templateSourceId: template.id,
      templateGenerated: true,
    }]
  })
}

export function toResourceTemplate(template: JournalPageTemplateDefinition): ResourceTemplate {
  return {
    id: template.id,
    type: 'journal_page',
    name: template.nameKey,
    description: template.descriptionKey,
    source: 'builtin',
    payload: JSON.stringify({ version: 1, ...template }),
    hidden: false,
    deleted: false,
    created_at: '',
    updated_at: '',
  }
}

export function mergeTemplateStylePayload(stylePayload: string | null | undefined, overrides?: Record<string, unknown>): string {
  if (!overrides) return stylePayload || '{}'
  const current = parseStylePayload(stylePayload)
  const merged: Record<string, unknown> = { ...current }
  for (const [key, value] of Object.entries(overrides)) {
    merged[key] = isRecord(value) && isRecord(current[key])
      ? { ...current[key], ...value }
      : value
  }
  return serializeStylePayload(merged)
}

function slot(
  id: string,
  kind: JournalTemplateSlot['kind'],
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: number,
  zIndex: number,
  styleOverrides?: Record<string, unknown>
): JournalTemplateSlot {
  return { id, kind, layout: { x, y, width, height, rotation, zIndex }, styleOverrides }
}

function decoration(
  materialId: string,
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: number,
  zIndex: number,
  styleOverrides?: Record<string, unknown>
): JournalTemplateDecoration {
  return { materialId, layout: { x, y, width, height, rotation, zIndex }, styleOverrides }
}

function pointInsideLayout(point: { x: number; y: number }, layout: ReturnType<typeof materializeTemplateLayout>): boolean {
  return point.x >= layout.x
    && point.x <= layout.x + layout.width
    && point.y >= layout.y
    && point.y <= layout.y + layout.height
}

function clearTemplateMetadata(item: JournalDraftItem): JournalDraftItem {
  const next = { ...item }
  delete next.templateSlotId
  delete next.templateSourceId
  delete next.templateGenerated
  return next
}

function createTemplateDraftId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `template-${Date.now()}-${Math.random().toString(36).slice(2)}`
}
