import type { JournalMaterialKind } from '../../types'
import type { TranslationKey } from '../../i18n/translations'
import { isRecord, safeJsonParse } from '../../utils/safeJson'

export type JournalStickerGroup = 'live' | 'nature' | 'cosmos' | 'misc'

export interface JournalMaterialDefinition {
  id: string
  kind: JournalMaterialKind
  nameKey: TranslationKey
  categoryKey: TranslationKey
  group?: JournalStickerGroup
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
  sticker('heart', 'misc', 'journalMaterials.heart', 72, 72, -8, { icon: 'heart', color: '#ef6f9f' }),
  sticker('star', 'cosmos', 'journalMaterials.star', 72, 72, 8, { icon: 'star', color: '#f0b84a' }),
  sticker('sparkle', 'cosmos', 'journalMaterials.sparkle', 76, 76, -4, { icon: 'sparkle', color: '#7ab7e8' }),
  sticker('flower', 'nature', 'journalMaterials.flower', 78, 78, 7, { icon: 'flower', color: '#e58fbd' }),
  sticker('music-note', 'live', 'journalMaterials.musicNote', 72, 72, -6, { icon: 'music', color: '#8a83d6' }),
  sticker('camera', 'live', 'journalMaterials.camera', 78, 72, 5, { icon: 'camera', color: '#688ea8' }),
  sticker('headphones', 'live', 'journalMaterials.headphones', 76, 72, -5, { icon: 'headphones', color: '#7d86d9' }),
  sticker('monitor', 'live', 'journalMaterials.monitor', 80, 72, 4, { icon: 'monitor', color: '#6f9fc0' }),
  sticker('gamepad', 'live', 'journalMaterials.gamepad', 80, 72, -7, { icon: 'gamepad', color: '#9a7fd4' }),
  sticker('sakura', 'nature', 'journalMaterials.sakura', 76, 76, -6, { icon: 'sakura', color: '#f2a2c0' }),
  sticker('straw-hat', 'nature', 'journalMaterials.strawHat', 84, 68, 5, { icon: 'straw-hat', color: '#dfb75c' }),
  sticker('maple-leaf', 'nature', 'journalMaterials.mapleLeaf', 74, 76, -8, { icon: 'maple-leaf', color: '#df7f4a' }),
  sticker('snowman', 'nature', 'journalMaterials.snowman', 72, 78, 6, { icon: 'snowman', color: '#8fbfdc' }),
  sticker('rainbow', 'nature', 'journalMaterials.rainbow', 82, 70, -4, { icon: 'rainbow', color: '#e08bb0' }),
  sticker('astronaut', 'cosmos', 'journalMaterials.astronaut', 74, 78, 5, { icon: 'astronaut', color: '#8d97cf' }),
  sticker('earth', 'cosmos', 'journalMaterials.earth', 76, 76, -5, { icon: 'earth', color: '#64a8cc' }),
  sticker('orbit', 'cosmos', 'journalMaterials.orbit', 84, 72, 7, { icon: 'orbit', color: '#ad8cd8' }),
  sticker('rabbit', 'misc', 'journalMaterials.rabbit', 74, 78, -6, { icon: 'rabbit', color: '#d3a6b8' }),
  sticker('cat', 'misc', 'journalMaterials.cat', 76, 74, 6, { icon: 'cat', color: '#a89a86' }),
  sticker('gnome-hat', 'misc', 'journalMaterials.gnomeHat', 74, 76, -6, { icon: 'gnome-hat', color: '#e05252' }),
  sticker('anchor', 'misc', 'journalMaterials.anchor', 72, 78, 6, { icon: 'anchor', color: '#6f87a8' }),
  sticker('tennis-ball', 'misc', 'journalMaterials.tennisBall', 72, 72, -5, { icon: 'tennis-ball', color: '#c4d84e' }),
  sticker('tennis-racket', 'misc', 'journalMaterials.tennisRacket', 74, 78, 7, { icon: 'tennis-racket', color: '#7aa8d0' }),
  material('memo-pink', 'paper', 'journalMaterials.memoPink', 170, 122, -2, { color: '#ffe3ec', line: true }),
  material('memo-blue', 'paper', 'journalMaterials.memoBlue', 170, 122, 2, { color: '#dff0ff', line: true }),
  material('memo-cream', 'paper', 'journalMaterials.memoCream', 170, 122, -3, { color: '#fff4cf', line: false }),
  material('memo-clear', 'paper', 'journalMaterials.memoClear', 190, 132, -2, { color: 'transparent', line: false, transparent: true }),
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

export const JOURNAL_STICKER_GROUPS: { id: 'all' | JournalStickerGroup; labelKey: TranslationKey }[] = [
  { id: 'all', labelKey: 'common.all' },
  { id: 'live', labelKey: 'journalMaterials.group.live' },
  { id: 'nature', labelKey: 'journalMaterials.group.nature' },
  { id: 'cosmos', labelKey: 'journalMaterials.group.cosmos' },
  { id: 'misc', labelKey: 'journalMaterials.group.misc' },
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
    group: material.group,
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

function sticker(
  id: string,
  group: JournalStickerGroup,
  nameKey: TranslationKey,
  defaultWidth: number,
  defaultHeight: number,
  defaultRotation: number,
  defaultStyle: Record<string, unknown>
): JournalMaterialDefinition {
  return {
    ...material(id, 'sticker', nameKey, defaultWidth, defaultHeight, defaultRotation, { outline: true, ...defaultStyle }),
    group,
  }
}
