import { generateId, getDb } from '../../database'
import type {
  Stamp,
  StampInput,
  StampMaterialId,
  StampPosition,
  StampRow,
  StampSnapshotV2,
  StampTargetType,
  StampTemplateId,
} from '../../types'

const VALID_TARGETS: StampTargetType[] = ['note', 'illustration', 'journal_page', 'postcard']
const VALID_POSITIONS: StampPosition[] = ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right']

export const STAMP_COORDINATE_MIN = 0
export const STAMP_COORDINATE_MAX = 100
export const STAMP_SIZE_MIN = 0.6
export const STAMP_SIZE_MAX = 1.8
export const STAMP_ROTATION_MIN = -25
export const STAMP_ROTATION_MAX = 25
export const STAMP_OPACITY_MIN = 0.45
export const STAMP_OPACITY_MAX = 1

export interface StampTemplateDefinition {
  id: StampTemplateId
  labelKey: string
  defaultLabel: string
  color: string
  rotation: number
}

export interface StampMaterialDefinition {
  id: StampMaterialId
  labelKey: string
  shape: StampSnapshotV2['shape']
  texture: StampSnapshotV2['texture']
  borderStyle: StampSnapshotV2['border_style']
  defaultSize: number
  defaultOpacity: number
  rotationOffset: number
  visible?: boolean
}

export const STAMP_TEMPLATES: StampTemplateDefinition[] = [
  { id: 'recorded', labelKey: 'stamps.template.recorded', defaultLabel: 'Recorded', color: '#8B5CF6', rotation: -8 },
  { id: 'favorite', labelKey: 'stamps.template.favorite', defaultLabel: 'Favorite', color: '#EC4899', rotation: -6 },
  { id: 'collected', labelKey: 'stamps.template.collected', defaultLabel: 'Collected', color: '#2563EB', rotation: 7 },
  { id: 'precious', labelKey: 'stamps.template.precious', defaultLabel: 'Precious', color: '#F59E0B', rotation: -10 },
  { id: 'anniversary', labelKey: 'stamps.template.anniversary', defaultLabel: 'Anniversary', color: '#10B981', rotation: 5 },
]

export const STAMP_MATERIALS: StampMaterialDefinition[] = [
  { id: 'round', labelKey: 'stamps.material.round', shape: 'round', texture: 'ink', borderStyle: 'double', defaultSize: 1, defaultOpacity: 0.92, rotationOffset: 0 },
  { id: 'oval', labelKey: 'stamps.material.oval', shape: 'oval', texture: 'ink', borderStyle: 'double', defaultSize: 1, defaultOpacity: 0.9, rotationOffset: 0, visible: false },
  { id: 'date', labelKey: 'stamps.material.date', shape: 'date', texture: 'ink', borderStyle: 'solid', defaultSize: 1, defaultOpacity: 0.9, rotationOffset: 0 },
  { id: 'ticket', labelKey: 'stamps.material.ticket', shape: 'ticket', texture: 'ticket', borderStyle: 'perforated', defaultSize: 1.03, defaultOpacity: 0.94, rotationOffset: 2, visible: false },
  { id: 'wax', labelKey: 'stamps.material.wax', shape: 'wax', texture: 'wax', borderStyle: 'solid', defaultSize: 0.92, defaultOpacity: 0.96, rotationOffset: 0 },
  { id: 'paper-label', labelKey: 'stamps.material.paperLabel', shape: 'paper-label', texture: 'paper', borderStyle: 'dashed', defaultSize: 1, defaultOpacity: 0.95, rotationOffset: -2 },
  { id: 'seal-script', labelKey: 'stamps.material.sealScript', shape: 'seal-script', texture: 'seal', borderStyle: 'solid', defaultSize: 0.98, defaultOpacity: 0.94, rotationOffset: -4, visible: false },
  { id: 'running-script', labelKey: 'stamps.material.flourish', shape: 'flourish', texture: 'ink', borderStyle: 'solid', defaultSize: 1, defaultOpacity: 0.9, rotationOffset: -3, visible: false },
  { id: 'flourish', labelKey: 'stamps.material.flourish', shape: 'flourish', texture: 'ink', borderStyle: 'solid', defaultSize: 1, defaultOpacity: 0.9, rotationOffset: -3 },
  { id: 'calligraphy', labelKey: 'stamps.material.calligraphy', shape: 'calligraphy', texture: 'ink', borderStyle: 'solid', defaultSize: 0.98, defaultOpacity: 0.92, rotationOffset: -4 },
]

export const VISIBLE_STAMP_MATERIALS = STAMP_MATERIALS.filter((material) => material.visible !== false)

export function createStampInputFromTemplate(templateId: StampTemplateId, label: string, materialId: StampMaterialId = 'round'): StampInput {
  const template = getStampTemplate(templateId)
  const material = getStampMaterial(materialId)
  const position: StampPosition = 'bottom-right'
  return {
    template_id: template.id,
    template_snapshot: createStampSnapshot(template.id, material.id),
    label: label || template.defaultLabel,
    color: template.color,
    position,
    ...getPositionCoordinates(position),
    rotation: clampStampRotation(template.rotation + material.rotationOffset),
    size: material.defaultSize,
    opacity: material.defaultOpacity,
  }
}

export function getStampTemplate(templateId: StampTemplateId | string): StampTemplateDefinition {
  return STAMP_TEMPLATES.find((item) => item.id === templateId) || STAMP_TEMPLATES[0]
}

export function getStampMaterial(materialId: StampMaterialId | string | undefined): StampMaterialDefinition {
  return STAMP_MATERIALS.find((item) => item.id === materialId) || STAMP_MATERIALS[0]
}

export function createStampSnapshot(templateId: StampTemplateId | string, materialId: StampMaterialId | string | undefined = 'round'): string {
  const template = getStampTemplate(templateId)
  const material = getStampMaterial(materialId)
  const snapshot: StampSnapshotV2 = {
    version: 2,
    template_id: template.id,
    label_key: template.labelKey,
    default_label: template.defaultLabel,
    color: template.color,
    rotation: template.rotation,
    material_id: material.id,
    shape: material.shape,
    texture: material.texture,
    border_style: material.borderStyle,
  }
  return JSON.stringify(snapshot)
}

export function parseStampSnapshot(snapshot: string | null | undefined, templateId?: StampTemplateId | string): StampSnapshotV2 {
  const parsed = parseJsonObject(snapshot)
  const candidateTemplateId = asString(parsed?.template_id) || asString(parsed?.id) || templateId || 'recorded'
  const template = getStampTemplate(candidateTemplateId)
  const material = getStampMaterial(asString(parsed?.material_id))
  return {
    version: 2,
    template_id: asString(parsed?.template_id) || asString(parsed?.id) || template.id,
    label_key: asString(parsed?.label_key) || asString(parsed?.labelKey) || template.labelKey,
    default_label: asString(parsed?.default_label) || asString(parsed?.defaultLabel) || template.defaultLabel,
    color: asString(parsed?.color) || template.color,
    rotation: asNumber(parsed?.rotation, template.rotation),
    material_id: material.id,
    shape: material.shape,
    texture: material.texture,
    border_style: material.borderStyle,
  }
}

export function getStampMaterialId(stamp: Pick<StampInput, 'template_snapshot' | 'template_id'> | Pick<Stamp, 'template_snapshot' | 'template_id'> | null): StampMaterialId {
  return parseStampSnapshot(stamp?.template_snapshot, stamp?.template_id).material_id
}

export function getPositionCoordinates(position: StampPosition): { x: number; y: number } {
  switch (position) {
    case 'top-left':
      return { x: 18, y: 18 }
    case 'top-right':
      return { x: 82, y: 18 }
    case 'center':
      return { x: 50, y: 50 }
    case 'bottom-left':
      return { x: 18, y: 82 }
    case 'bottom-right':
    default:
      return { x: 82, y: 82 }
  }
}

export function getPresetPositionFromCoordinates(x: number, y: number): StampPosition {
  if (x < 34 && y < 34) return 'top-left'
  if (x > 66 && y < 34) return 'top-right'
  if (x < 34 && y > 66) return 'bottom-left'
  if (x > 66 && y > 66) return 'bottom-right'
  return 'center'
}

export function normalizeStampInput(stamp: Stamp | StampInput): StampInput {
  const position = coercePosition(stamp.position)
  const coordinates = getPositionCoordinates(position)
  const template = getStampTemplate(stamp.template_id || 'recorded')
  return {
    template_id: stamp.template_id || template.id,
    template_snapshot: stamp.template_snapshot || createStampSnapshot(template.id, 'round'),
    label: stamp.label,
    color: stamp.color || template.color,
    position,
    x: clampStampCoordinate(stamp.x ?? coordinates.x),
    y: clampStampCoordinate(stamp.y ?? coordinates.y),
    rotation: clampStampRotation(stamp.rotation ?? template.rotation),
    size: clampStampSize(stamp.size ?? 1),
    opacity: clampStampOpacity(stamp.opacity ?? 0.92),
  }
}

export function clampStampCoordinate(value: number): number {
  return clampNumber(value, STAMP_COORDINATE_MIN, STAMP_COORDINATE_MAX)
}

export function clampStampSize(value: number): number {
  return clampNumber(value, STAMP_SIZE_MIN, STAMP_SIZE_MAX)
}

export function clampStampRotation(value: number): number {
  return clampNumber(value, STAMP_ROTATION_MIN, STAMP_ROTATION_MAX)
}

export function clampStampOpacity(value: number): number {
  return clampNumber(value, STAMP_OPACITY_MIN, STAMP_OPACITY_MAX)
}

export async function fetchStampForTarget(targetType: StampTargetType, targetId: string): Promise<Stamp | null> {
  const db = await getDb()
  const rows = await db.select<StampRow[]>(
    'SELECT * FROM stamps WHERE target_type = ? AND target_id = ? LIMIT 1',
    [targetType, targetId]
  )
  return rows[0] ? deserializeStamp(rows[0]) : null
}

export async function upsertStampForTarget(targetType: StampTargetType, targetId: string, input: StampInput): Promise<Stamp> {
  const db = await getDb()
  const existing = await fetchStampForTarget(targetType, targetId)
  const position = coercePosition(input.position)
  const coordinates = getPositionCoordinates(position)
  const values = {
    template_id: input.template_id || 'recorded',
    template_snapshot: input.template_snapshot || createStampSnapshot(input.template_id || 'recorded', 'round'),
    label: input.label,
    color: input.color || '#8B5CF6',
    position,
    x: clampStampCoordinate(input.x ?? coordinates.x),
    y: clampStampCoordinate(input.y ?? coordinates.y),
    rotation: clampStampRotation(input.rotation ?? -8),
    size: clampStampSize(input.size ?? 1),
    opacity: clampStampOpacity(input.opacity ?? 0.92),
  }

  if (existing) {
    await db.execute(
      `UPDATE stamps
       SET template_id = ?, template_snapshot = ?, label = ?, color = ?, position = ?, x = ?, y = ?, rotation = ?, size = ?, opacity = ?, updated_at = datetime('now', 'localtime')
       WHERE id = ?`,
      [
        values.template_id,
        values.template_snapshot,
        values.label,
        values.color,
        values.position,
        values.x,
        values.y,
        values.rotation,
        values.size,
        values.opacity,
        existing.id,
      ]
    )
    return (await fetchStampForTarget(targetType, targetId))!
  }

  const id = generateId()
  await db.execute(
    `INSERT INTO stamps (
      id, target_type, target_id, template_id, template_snapshot, label, color, position, x, y, rotation, size, opacity
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      targetType,
      targetId,
      values.template_id,
      values.template_snapshot,
      values.label,
      values.color,
      values.position,
      values.x,
      values.y,
      values.rotation,
      values.size,
      values.opacity,
    ]
  )
  return (await fetchStampForTarget(targetType, targetId))!
}

export async function deleteStampForTarget(targetType: StampTargetType, targetId: string): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM stamps WHERE target_type = ? AND target_id = ?', [targetType, targetId])
}

export async function persistStampForTarget(
  targetType: StampTargetType,
  targetId: string,
  stamp: Stamp | StampInput | null
): Promise<Stamp | null> {
  if (stamp && stamp.label.trim()) {
    return upsertStampForTarget(targetType, targetId, {
      template_id: stamp.template_id,
      template_snapshot: stamp.template_snapshot,
      label: stamp.label.trim(),
      color: stamp.color,
      position: stamp.position,
      x: stamp.x,
      y: stamp.y,
      rotation: stamp.rotation,
      size: stamp.size,
      opacity: stamp.opacity,
    })
  }

  await deleteStampForTarget(targetType, targetId)
  return null
}

function deserializeStamp(row: StampRow): Stamp {
  return {
    ...row,
    target_type: coerceTarget(row.target_type),
    position: coercePosition(row.position),
  }
}

function coerceTarget(value: string): StampTargetType {
  return VALID_TARGETS.includes(value as StampTargetType) ? value as StampTargetType : 'note'
}

function coercePosition(value: string): StampPosition {
  return VALID_POSITIONS.includes(value as StampPosition) ? value as StampPosition : 'bottom-right'
}

function parseJsonObject(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null
  } catch {
    return null
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
