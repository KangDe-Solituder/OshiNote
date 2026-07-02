import { generateId, getDb } from '../../database'
import type { ResourceTemplate, ResourceTemplateRow, ResourceTemplateType, TemplateSnapshot } from '../../types'

const VALID_TEMPLATE_TYPES: ResourceTemplateType[] = ['note', 'journal_page', 'stamp', 'material']

export const BUILTIN_TEMPLATES: ResourceTemplate[] = [
  createBuiltinTemplate('builtin-note-memory', 'note', 'templates.builtin.noteMemory.name', 'templates.builtin.noteMemory.description', {
    style: 'memory-note',
    fields: ['title', 'date', 'mood', 'body'],
  }),
  createBuiltinTemplate('builtin-journal-page-live', 'journal_page', 'templates.builtin.journalLive.name', 'templates.builtin.journalLive.description', {
    background: 'grid',
    slots: ['date', 'title', 'illustration', 'reflection'],
  }),
  createBuiltinTemplate('builtin-stamp-recorded', 'stamp', 'templates.builtin.stampRecorded.name', 'templates.builtin.stampRecorded.description', {
    template_id: 'recorded',
    position: 'bottom-right',
  }),
  createBuiltinTemplate('builtin-material-paper', 'material', 'templates.builtin.paper.name', 'templates.builtin.paper.description', {
    material_type: 'paper',
    background: 'paper',
  }),
]

export async function fetchResourceTemplates(type?: ResourceTemplateType): Promise<ResourceTemplate[]> {
  const db = await getDb()
  const bindings: unknown[] = []
  const where = ['deleted = 0', 'hidden = 0']
  if (type) {
    where.push('type = ?')
    bindings.push(type)
  }
  const rows = await db.select<ResourceTemplateRow[]>(
    `SELECT * FROM templates WHERE ${where.join(' AND ')} ORDER BY created_at DESC`,
    bindings
  )
  const userTemplates = rows.map(deserializeTemplate)
  const builtins = type ? BUILTIN_TEMPLATES.filter((template) => template.type === type) : BUILTIN_TEMPLATES
  return [...builtins, ...userTemplates]
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
