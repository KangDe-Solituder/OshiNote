import type { CSSProperties } from 'react'
import type { JournalDraftItem, JournalItemWithNote, Note } from '../../types'
import { asNumber, asString, isRecord, safeJsonParse } from '../../utils/safeJson'
import { getJournalMaterialDefinition } from './journalMaterials'

export type ImageFrameStyle = 'none' | 'simple' | 'paper' | 'polaroid'
export type ImageFitStyle = 'contain' | 'cover'

export interface NoteCardStyle {
  titleVisible: boolean
  titleText: string
  bodyText: string
  fontFamily: string
  fontSize: number
  fontWeight: number
  lineHeight: number
  textColor: string
  backgroundColor: string
  padding: number
  radius: number
  showTags: boolean
}

export interface ImageItemStyle {
  fit: ImageFitStyle
  frame: ImageFrameStyle
  borderWidth: number
  borderColor: string
  radius: number
  shadow: number
  backgroundColor: string
}

export interface MaterialItemStyle extends Record<string, unknown> {
  color?: string
  tapeStyle?: string
  icon?: string
  glassStrength?: number
  backing?: boolean
  backingShape?: string
}

export function parseStylePayload(value: string | null | undefined): Record<string, unknown> {
  return safeJsonParse<Record<string, unknown>>(value, {}, isRecord)
}

export function serializeStylePayload(payload: Record<string, unknown>): string {
  return JSON.stringify(payload)
}

export function createDefaultNoteCardStyle(note: Note | null | undefined, untitled = '', empty = ''): NoteCardStyle {
  return {
    titleVisible: true,
    titleText: note?.title || untitled,
    bodyText: (note?.plain_text || empty).slice(0, 200),
    fontFamily: 'system',
    fontSize: 14,
    fontWeight: 500,
    lineHeight: 1.45,
    textColor: '#1f2f4d',
    backgroundColor: '#fff7d6',
    padding: 16,
    radius: 16,
    showTags: true,
  }
}

export function createDefaultImageStyle(): ImageItemStyle {
  return {
    fit: 'contain',
    frame: 'none',
    borderWidth: 0,
    borderColor: '#ffffff',
    radius: 12,
    shadow: 0,
    backgroundColor: 'transparent',
  }
}

export function createNoteCardStylePayload(
  note: Note | null | undefined,
  overrides: Partial<NoteCardStyle> = {},
  untitled = '',
  empty = ''
): string {
  return serializeStylePayload({ noteCard: { ...createDefaultNoteCardStyle(note, untitled, empty), ...overrides } })
}

export function createImageStylePayload(): string {
  return serializeStylePayload({ imageStyle: createDefaultImageStyle() })
}

export function getNoteCardStyleFromPayload(
  stylePayload: string | null | undefined,
  note: Note | null | undefined,
  untitled: string,
  empty: string
): NoteCardStyle {
  const payload = parseStylePayload(stylePayload)
  const raw = isRecord(payload.noteCard) ? payload.noteCard : {}
  const defaults = createDefaultNoteCardStyle(note, untitled, empty)
  return {
    titleVisible: raw.titleVisible !== false,
    titleText: asString(raw.titleText) || defaults.titleText,
    bodyText: (asString(raw.bodyText) || defaults.bodyText).slice(0, 200),
    fontFamily: asString(raw.fontFamily) || defaults.fontFamily,
    fontSize: asNumber(raw.fontSize, defaults.fontSize),
    fontWeight: asNumber(raw.fontWeight, defaults.fontWeight),
    lineHeight: asNumber(raw.lineHeight, defaults.lineHeight),
    textColor: asString(raw.textColor) || defaults.textColor,
    backgroundColor: asString(raw.backgroundColor) || defaults.backgroundColor,
    padding: asNumber(raw.padding, defaults.padding),
    radius: asNumber(raw.radius, defaults.radius),
    showTags: raw.showTags !== false,
  }
}

export function getOptionalNoteCardStyleFromPayload(
  stylePayload: string | null | undefined,
  note: Note | null | undefined,
  untitled: string,
  empty: string
): NoteCardStyle | null {
  const payload = parseStylePayload(stylePayload)
  if (!isRecord(payload.noteCard)) return null
  return getNoteCardStyleFromPayload(stylePayload, note, untitled, empty)
}

export function getImageItemStyleFromPayload(stylePayload: string | null | undefined): ImageItemStyle {
  const payload = parseStylePayload(stylePayload)
  const raw = isRecord(payload.imageStyle) ? payload.imageStyle : {}
  return coerceImageItemStyle(raw)
}

export function getOptionalImageItemStyleFromPayload(stylePayload: string | null | undefined): ImageItemStyle | null {
  const payload = parseStylePayload(stylePayload)
  if (!isRecord(payload.imageStyle)) return null
  return coerceImageItemStyle(payload.imageStyle)
}

export function getMaterialStylePayload(stylePayload: string | null | undefined, materialId?: string | null): MaterialItemStyle {
  const material = getJournalMaterialDefinition(materialId)
  return {
    ...(material?.defaultStyle || {}),
    ...parseStylePayload(stylePayload),
  }
}

export function patchStylePayload(stylePayload: string | null | undefined, change: Record<string, unknown>): string {
  return serializeStylePayload({
    ...parseStylePayload(stylePayload),
    ...change,
  })
}

export function getImageFrameStyle(style: ImageItemStyle): CSSProperties {
  return {
    borderRadius: style.radius,
    border: style.borderWidth > 0 ? `${style.borderWidth}px solid ${style.borderColor}` : '0 solid transparent',
    backgroundColor: style.backgroundColor,
    boxShadow: style.shadow > 0 ? `0 ${Math.round(style.shadow / 2)}px ${style.shadow}px rgba(31,47,77,0.22)` : 'none',
  }
}

export function getImagePadding(style: ImageItemStyle): number {
  return style.frame === 'paper' ? 8 : style.frame === 'polaroid' ? 10 : 0
}

export function getImageBottomPadding(style: ImageItemStyle): number {
  return style.frame === 'polaroid' ? 30 : getImagePadding(style)
}

export function getFontFamily(value: string): string {
  if (value === 'serif') return 'Georgia, "Times New Roman", serif'
  if (value === 'sans') return 'Arial, "Helvetica Neue", sans-serif'
  if (value === 'mono') return '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
  if (value === 'casual') return '"Comic Sans MS", "Segoe Print", cursive'
  return 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
}

export function getMaterialGlassStyle(strength: number, color: string): CSSProperties | undefined {
  if (strength <= 0) return undefined
  const alpha = Math.min(0.42, strength / 240)
  return {
    backgroundColor: `color-mix(in srgb, ${color} ${Math.max(34, 100 - strength)}%, rgba(255,255,255,${alpha}))`,
    backdropFilter: `blur(${Math.round(strength / 14)}px) saturate(${100 + Math.round(strength * 0.45)}%)`,
  }
}

export function getDraftNoteCardStyle(item: JournalDraftItem, note: Note | undefined, untitled: string, empty: string): NoteCardStyle {
  return getNoteCardStyleFromPayload(item.stylePayload, note, untitled, empty)
}

export function getDraftImageItemStyle(item: JournalDraftItem): ImageItemStyle {
  return getImageItemStyleFromPayload(item.stylePayload)
}

export function getJournalNoteCardStyle(item: JournalItemWithNote, untitled: string, empty: string): NoteCardStyle | null {
  return getOptionalNoteCardStyleFromPayload(item.style_payload, item.note, untitled, empty)
}

export function getJournalImageItemStyle(item: JournalItemWithNote): ImageItemStyle | null {
  return getOptionalImageItemStyleFromPayload(item.style_payload)
}

function coerceImageItemStyle(raw: Record<string, unknown>): ImageItemStyle {
  const defaults = createDefaultImageStyle()
  const frame = isImageFrameStyle(raw.frame) ? raw.frame : defaults.frame
  return {
    fit: raw.fit === 'cover' ? 'cover' : defaults.fit,
    frame,
    borderWidth: asNumber(raw.borderWidth, frame === 'none' ? 0 : 2),
    borderColor: asString(raw.borderColor) || defaults.borderColor,
    radius: asNumber(raw.radius, defaults.radius),
    shadow: asNumber(raw.shadow, frame === 'none' ? 0 : 16),
    backgroundColor: asString(raw.backgroundColor) || (frame === 'none' ? 'transparent' : '#ffffff'),
  }
}

function isImageFrameStyle(value: unknown): value is ImageFrameStyle {
  return value === 'simple' || value === 'paper' || value === 'polaroid' || value === 'none'
}
