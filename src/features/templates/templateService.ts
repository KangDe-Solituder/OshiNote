import { generateId, getDb } from '../../database'
import type { ResourceTemplate, ResourceTemplateRow, ResourceTemplateType, TemplateSnapshot } from '../../types'
import { JOURNAL_PAGE_TEMPLATES, toResourceTemplate } from '../journal/journalPageTemplates'

const VALID_TEMPLATE_TYPES: ResourceTemplateType[] = ['note', 'journal_page', 'stamp', 'material']

export const BUILTIN_TEMPLATES: ResourceTemplate[] = [
  createBuiltinTemplate('builtin-note-memory', 'note', 'templates.builtin.noteMemory.name', 'templates.builtin.noteMemory.description', {
    style: 'memory-note',
    fields: ['title', 'date', 'mood', 'body'],
  }),
  ...JOURNAL_PAGE_TEMPLATES.map(toResourceTemplate),
  createBuiltinTemplate('builtin-stamp-recorded', 'stamp', 'templates.builtin.stampRecorded.name', 'templates.builtin.stampRecorded.description', {
    template_id: 'recorded',
    position: 'bottom-right',
  }),
  createBuiltinTemplate('builtin-material-paper', 'material', 'templates.builtin.paper.name', 'templates.builtin.paper.description', {
    material_type: 'paper',
    background: 'paper',
  }),
]

export async function fetchResourceTemplates(type?: ResourceTemplateType, includeDeleted = false): Promise<ResourceTemplate[]> {
  const builtins = type ? BUILTIN_TEMPLATES.filter((template) => template.type === type) : BUILTIN_TEMPLATES
  try {
    const db = await getDb()
    const bindings: unknown[] = []
    const where = ['1 = 1']
    if (type) {
      where.push('type = ?')
      bindings.push(type)
    }
    const rows = await db.select<ResourceTemplateRow[]>(
      `SELECT * FROM templates WHERE ${where.join(' AND ')} ORDER BY created_at DESC`,
      bindings
    )
    const merged = new Map(builtins.map(template => [template.id, template]))
    rows.map(deserializeTemplate).forEach(template => merged.set(template.id, template))
    return [...merged.values()].filter(template => includeDeleted || (!template.deleted && !template.hidden))
  } catch {
    return builtins
  }
}

export async function updateResourceTemplate(template: ResourceTemplate, changes: { name?: string; description?: string; deleted?: boolean }) {
  const name = changes.name?.trim() ?? template.name
  if (!name || name.length > 160) throw new Error('Name must contain 1–160 characters')
  const db = await getDb()
  await db.execute(`INSERT INTO templates (id,type,name,description,source,payload,hidden,deleted) VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, deleted=excluded.deleted, updated_at=datetime('now','localtime')`,
    [template.id, template.type, name, changes.description ?? template.description, template.source, template.payload, Number(template.hidden), Number(changes.deleted ?? template.deleted)])
}

export function reusableTemplatePayload(template: ResourceTemplate): string {
  const payload = JSON.parse(template.payload)
  if (template.type === 'journal_page' && !payload.layout) return JSON.stringify({ version: 1, layout: payload })
  return template.payload
}

export async function duplicateResourceTemplate(template: ResourceTemplate, name: string) {
  return createResourceTemplate({ type: template.type, name, description: template.source === 'builtin' ? '' : template.description, payload: reusableTemplatePayload(template) })
}

export async function createResourceTemplate(input: {
  type: ResourceTemplateType
  name: string
  description?: string
  payload?: string
}): Promise<ResourceTemplate> {
  const db = await getDb()
  const id = generateId()
  await db.execute(
    `INSERT INTO templates (id, type, name, description, source, payload)
     VALUES (?, ?, ?, ?, 'user', ?)`,
    [id, input.type, input.name, input.description || '', input.payload || '{}']
  )
  const rows = await db.select<ResourceTemplateRow[]>('SELECT * FROM templates WHERE id = ?', [id])
  return deserializeTemplate(rows[0])
}

export function createTemplateSnapshot(template: ResourceTemplate): TemplateSnapshot {
  return {
    template_id: template.id,
    template_type: template.type,
    name: template.name,
    payload: template.payload,
    captured_at: new Date().toISOString(),
  }
}

function createBuiltinTemplate(
  id: string,
  type: ResourceTemplateType,
  name: string,
  description: string,
  payload: Record<string, unknown>
): ResourceTemplate {
  return {
    id,
    type,
    name,
    description,
    source: 'builtin',
    payload: JSON.stringify(payload),
    hidden: false,
    deleted: false,
    created_at: '',
    updated_at: '',
  }
}

function deserializeTemplate(row: ResourceTemplateRow): ResourceTemplate {
  return {
    ...row,
    type: VALID_TEMPLATE_TYPES.includes(row.type as ResourceTemplateType) ? row.type as ResourceTemplateType : 'note',
    source: row.source === 'builtin' ? 'builtin' : 'user',
    hidden: row.hidden === 1,
    deleted: row.deleted === 1,
  }
}
