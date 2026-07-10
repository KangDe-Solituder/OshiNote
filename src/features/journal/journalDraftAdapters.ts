import type { JournalDraftItem, JournalItemWithNote, JournalPage, Stamp, StampInput } from '../../types'
import type { JournalLayoutUpdate } from './journalService'
import { getJournalMaterialDefinition } from './journalMaterials'
import { createImageStylePayload, createNoteCardStylePayload, parseStylePayload, serializeStylePayload } from './journalItemStyles'
import { draftItemToLayout, getDefaultIllustrationItemSize } from './journalItemSizing'
import { isRecord } from '../../utils/safeJson'

export interface JournalCompositionDraft {
  oshiId: string
  title: string
  dateLabel: string
  description: string
  background: string
  orientation: JournalPage['orientation']
  items: JournalDraftItem[]
  stamp: Stamp | StampInput | null
}

export interface JournalDraftSavePlan {
  existingItemsToRemove: JournalItemWithNote[]
  itemsToUpdate: JournalDraftItem[]
  itemsToCreate: JournalDraftItem[]
}

export function createCompositionDraft(page: JournalPage, items: JournalItemWithNote[], stamp: Stamp | StampInput | null): JournalCompositionDraft {
  return {
    oshiId: page.oshi_id,
    title: page.title || '',
    dateLabel: page.date_label || '',
    description: page.description || '',
    background: page.background || 'paper',
    orientation: page.orientation || 'portrait',
    items: items.flatMap(journalItemToDraftItem),
    stamp,
  }
}

export function journalItemToDraftItem(item: JournalItemWithNote): JournalDraftItem[] {
  if (!isCompositionItem(item)) return []
  const base = {
    draftId: `existing-${item.id}`,
    originItemId: item.id,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    rotation: item.rotation,
    zIndex: item.z_index,
  }

  if (item.item_type === 'note') {
    if (!item.note_id) return []
    return [{
      ...base,
      itemType: 'note',
      sourceId: item.note_id,
      stylePayload: hasPayloadSection(item.style_payload, 'noteCard')
        ? item.style_payload
        : createNoteCardStylePayload(item.note, { backgroundColor: item.color || '#fff7d6' }),
    }]
  }

  if (item.item_type === 'illustration') {
    if (!item.illustration_id) return []
    const hasImageStyle = hasPayloadSection(item.style_payload, 'imageStyle')
    const imageSize = hasImageStyle
      ? { width: item.width, height: item.height }
      : getDefaultIllustrationItemSize(item.illustration, { width: item.width, height: item.height }, Math.max(item.width, item.height, 320))
    return [{
      ...base,
      itemType: 'illustration',
      sourceId: item.illustration_id,
      stylePayload: hasImageStyle ? item.style_payload : createImageStylePayload(),
      width: imageSize.width,
      height: imageSize.height,
    }]
  }

  return [{
    ...base,
    itemType: 'material',
    materialId: item.material_id || getFallbackMaterialId(item),
    materialSnapshot: item.material_snapshot,
    stylePayload: item.style_payload && item.style_payload !== '{}' ? item.style_payload : serializeStylePayload({
      color: item.color || undefined,
      variant: item.sticker_style,
      glassStrength: 0,
    }),
  }]
}

export function createDraftSavePlan(draftItems: JournalDraftItem[], existingItems: JournalItemWithNote[]): JournalDraftSavePlan {
  const draftOriginIds = new Set(draftItems.map((item) => item.originItemId).filter(Boolean))
  const supportedExistingItems = existingItems.filter(isCompositionItem)
  return {
    existingItemsToRemove: supportedExistingItems.filter((item) => !draftOriginIds.has(item.id)),
    itemsToUpdate: draftItems.filter((item) => Boolean(item.originItemId)),
    itemsToCreate: draftItems.filter((item) => !item.originItemId),
  }
}

export function draftItemToJournalLayout(item: JournalDraftItem): JournalLayoutUpdate {
  return draftItemToLayout(item)
}

export function isCompositionItem(item: JournalItemWithNote): boolean {
  return item.item_type === 'note' || item.item_type === 'illustration' || item.item_type === 'material' || item.item_type === 'tape'
}

function hasPayloadSection(stylePayload: string | null | undefined, key: string): boolean {
  const payload = parseStylePayload(stylePayload)
  return isRecord(payload[key])
}

function getFallbackMaterialId(item: JournalItemWithNote): string {
  if (getJournalMaterialDefinition(item.material_id)) return item.material_id!
  return item.item_type === 'tape' ? 'washi-lilac' : 'memo-cream'
}
