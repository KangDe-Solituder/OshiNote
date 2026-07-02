import { generateId, getDb } from '../../database'
import type { Stamp, StampInput, StampPosition, StampRow, StampTargetType, StampTemplateId } from '../../types'

const VALID_TARGETS: StampTargetType[] = ['note', 'illustration', 'journal_page', 'postcard']
const VALID_POSITIONS: StampPosition[] = ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right']

export const STAMP_TEMPLATES: {
  id: StampTemplateId
  labelKey: string
  defaultLabel: string
  color: string
  rotation: number
}[] = [
  { id: 'recorded', labelKey: 'stamps.template.recorded', defaultLabel: 'Recorded', color: '#8B5CF6', rotation: -8 },
  { id: 'favorite', labelKey: 'stamps.template.favorite', defaultLabel: 'Favorite', color: '#EC4899', rotation: -6 },
  { id: 'collected', labelKey: 'stamps.template.collected', defaultLabel: 'Collected', color: '#2563EB', rotation: 7 },
  { id: 'precious', labelKey: 'stamps.template.precious', defaultLabel: 'Precious', color: '#F59E0B', rotation: -10 },
  { id: 'anniversary', labelKey: 'stamps.template.anniversary', defaultLabel: 'Anniversary', color: '#10B981', rotation: 5 },
]

export function createStampInputFromTemplate(templateId: StampTemplateId, label: string): StampInput {
  const template = STAMP_TEMPLATES.find((item) => item.id === templateId) || STAMP_TEMPLATES[0]
  const position: StampPosition = 'bottom-right'
  return {
    template_id: template.id,
    template_snapshot: JSON.stringify(template),
    label: label || template.defaultLabel,
    color: template.color,
    position,
    ...getPositionCoordinates(position),
    rotation: template.rotation,
    size: 1,
    opacity: 0.92,
  }
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
    template_snapshot: input.template_snapshot || '{}',
    label: input.label,
    color: input.color || '#8B5CF6',
    position,
    x: input.x ?? coordinates.x,
    y: input.y ?? coordinates.y,
    rotation: input.rotation ?? -8,
    size: input.size ?? 1,
    opacity: input.opacity ?? 0.92,
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
