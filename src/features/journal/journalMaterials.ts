import type { JournalMaterialKind } from '../../types'
import type { TranslationKey } from '../../i18n/translations'
import { isRecord, safeJsonParse } from '../../utils/safeJson'

export interface JournalMaterialDefinition {
  id: string
  kind: JournalMaterialKind
  nameKey: TranslationKey
  categoryKey: TranslationKey
  defaultWidth: number
  defaultHeight: number
  defaultRotation: number
  defaultStyle: Record<string, unknown>
}

export const JOURNAL_MATERIALS: JournalMaterialDefinition[] = [
  material('washi-lilac', 'tape', 'journalMaterials.washiLilac', 270, 42, -6, { tapeStyle: 'washi', color: '#d9c4ff' }),
  material('washi-sakura', 'tape', 'journalMaterials.washiSakura', 250, 40, 5, { tapeStyle: 'dots', color: '#f6b8d2' }),
  material('washi-blue-grid', 'tape', 'journalMaterials.washiBlueGrid', 280, 42, -4, { tapeStyle: 'grid', color: '#b8ddff' }),
  material('washi-maple', 'tape', 'journalMaterials.washiMaple', 250, 42, 4, { tapeStyle: 'stripe', color: '#f8dfa0' }),
  material('paper-torn', 'tape', 'journalMaterials.paperTorn', 240, 46, -5, { tapeStyle: 'torn', color: '#f0c9ad' }),
  material('heart', 'sticker', 'journalMaterials.heart', 72, 72, -8, { icon: 'heart', color: '#ef6f9f' }),
  material('star', 'sticker', 'journalMaterials.star', 72, 72, 8, { icon: 'star', color: '#f0b84a' }),
  material('sparkle', 'sticker', 'journalMaterials.sparkle', 76, 76, -4, { icon: 'sparkle', color: '#7ab7e8' }),
  material('flower', 'sticker', 'journalMaterials.flower', 78, 78, 7, { icon: 'flower', color: '#e58fbd' }),
  material('music-note', 'sticker', 'journalMaterials.musicNote', 72, 72, -6, { icon: 'music', color: '#8a83d6' }),
  material('camera', 'sticker', 'journalMaterials.camera', 78, 72, 5, { icon: 'camera', color: '#688ea8' }),
  material('memo-pink', 'paper', 'journalMaterials.memoPink', 170, 122, -2, { color: '#ffe3ec', line: true }),
  material('memo-blue', 'paper', 'journalMaterials.memoBlue', 170, 122, 2, { color: '#dff0ff', line: true }),
  material('memo-cream', 'paper', 'journalMaterials.memoCream', 170, 122, -3, { color: '#fff4cf', line: false }),
  material('label-ticket', 'label', 'journalMaterials.labelTicket', 150, 64, -4, { color: '#f7e2b8', shape: 'ticket' }),
  material('label-date', 'label', 'journalMaterials.labelDate', 148, 58, 3, { color: '#e9f1f7', shape: 'date' }),
]

export const JOURNAL_MATERIAL_KINDS: { id: 'all' | JournalMaterialKind; labelKey: TranslationKey }[] = [
  { id: 'all', labelKey: 'common.all' },
  { id: 'tape', labelKey: 'journalMaterials.category.tape' },
  { id: 'sticker', labelKey: 'journalMaterials.category.sticker' },
  { id: 'paper', labelKey: 'journalMaterials.category.paper' },
  { id: 'label', labelKey: 'journalMaterials.category.label' },
]

export function getJournalMaterialDefinition(id: string | null | undefined): JournalMaterialDefinition | null {
  return JOURNAL_MATERIALS.find((material) => material.id === id) || null
}

export function getMaterialSnapshot(material: JournalMaterialDefinition): string {
  return JSON.stringify({
    id: material.id,
    kind: material.kind,
    nameKey: material.nameKey,
    categoryKey: material.categoryKey,
    defaultWidth: material.defaultWidth,
    defaultHeight: material.defaultHeight,
    defaultRotation: material.defaultRotation,
    defaultStyle: material.defaultStyle,
  })
}

export function parseMaterialStyle(value: string | null | undefined): Record<string, unknown> {
  return safeJsonParse<Record<string, unknown>>(value, {}, isRecord)
}

function material(
  id: string,
  kind: JournalMaterialKind,
  nameKey: TranslationKey,
  defaultWidth: number,
  defaultHeight: number,
  defaultRotation: number,
  defaultStyle: Record<string, unknown>
): JournalMaterialDefinition {
  return {
    id,
    kind,
    nameKey,
    categoryKey: `journalMaterials.category.${kind}` as TranslationKey,
    defaultWidth,
    defaultHeight,
    defaultRotation,
    defaultStyle,
  }
}
