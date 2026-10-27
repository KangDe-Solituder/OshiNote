import { readRegionPaper } from './journalRegionItems'
import type { Illustration, JournalDraftItem, JournalItemWithNote } from '../../types'
import type { JournalLayoutInput } from './journalLayout'
import { getJournalMaterialDefinition } from './journalMaterials'
import { readRegion } from './journalRegions'

export interface JournalItemSize {
  width: number
  height: number
}

export function getDefaultIllustrationItemSize(
  illustration: Pick<Illustration, 'width' | 'height'> | null | undefined,
  fallback: JournalItemSize = { width: 260, height: 320 },
  maxSide = 320
): JournalItemSize {
  const rawWidth = illustration?.width || 0
  const rawHeight = illustration?.height || 0
  if (rawWidth <= 0 || rawHeight <= 0) return fallback
  const scale = Math.min(maxSide / rawWidth, maxSide / rawHeight, 1)
  return {
    width: Math.max(120, Math.round(rawWidth * scale)),
    height: Math.max(120, Math.round(rawHeight * scale)),
  }
}

export function getDraftItemConstraints(item: JournalDraftItem): { minWidth?: number; minHeight?: number } | undefined {
  if (readRegionPaper(item)) return { minWidth: 80, minHeight: 24 }
  if (readRegion(item.stylePayload)) return { minWidth: 260, minHeight: 220 }
  const materialKind = getJournalMaterialDefinition(item.materialId)?.kind
  if (materialKind === 'paper') return { minWidth: 120, minHeight: 60 }
  if (materialKind === 'tape') return { minWidth: 90, minHeight: 18 }
  if (materialKind === 'sticker') return { minWidth: 30, minHeight: 30 }
  if (item.itemType === 'illustration' || item.itemType === 'image') return { minWidth: 80, minHeight: 80 }
  if (item.itemType === 'note') return { minWidth: 120, minHeight: 90 }
  return undefined
}

export function getJournalItemConstraints(item: JournalItemWithNote): { minWidth?: number; minHeight?: number } | undefined {
  if (readRegion(item.style_payload)) return { minWidth: 260, minHeight: 220 }
  const materialKind = getJournalMaterialDefinition(item.material_id)?.kind
  if (item.item_type === 'tape' || materialKind === 'tape') return { minWidth: 90, minHeight: 18 }
  if (materialKind === 'sticker') return { minWidth: 42, minHeight: 42 }
  return undefined
}

export function draftItemToLayout(item: JournalDraftItem): JournalLayoutInput & { z_index: number } {
  return {
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    rotation: item.rotation,
    z_index: item.zIndex,
  }
}
