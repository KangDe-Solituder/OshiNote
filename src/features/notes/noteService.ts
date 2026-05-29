import { getDb, generateId } from '../../database'
import type { Note, NoteRow, CreateNoteInput, UpdateNoteInput, SearchParams } from '../../types'

function deserializeNote(row: NoteRow): Note {
  return {
    ...row,
    tags: JSON.parse(row.tags || '[]'),
    favorite: row.favorite === 1,
  }
}

export async function fetchNotesByArchive(archiveId: string, page = 1, pageSize = 20): Promise<{ notes: Note[]; total: number }> {
  const db = await getDb()
  const offset = (page - 1) * pageSize
  const countResult = await db.select<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM notes WHERE archive_id = ?', [archiveId]
  )
  const rows = await db.select<NoteRow[]>(
    'SELECT * FROM notes WHERE archive_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [archiveId, pageSize, offset]
  )
  return {
    notes: rows.map(deserializeNote),
    total: countResult[0]?.count || 0,
  }
}

export async function fetchNoteById(id: string): Promise<Note | null> {
  const db = await getDb()
  const rows = await db.select<NoteRow[]>('SELECT * FROM notes WHERE id = ?', [id])
  return rows[0] ? deserializeNote(rows[0]) : null
}

export async function createNote(input: CreateNoteInput): Promise<Note> {
  const db = await getDb()
  const id = generateId()
  await db.execute(
    `INSERT INTO notes (id, oshi_id, archive_id, title, content, plain_text, tags, favorite, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, COALESCE(?, datetime('now', 'localtime')), COALESCE(?, datetime('now', 'localtime')))`,
    [
      id,
      input.oshi_id,
      input.archive_id,
      input.title,
      input.content,
      input.plain_text,
      JSON.stringify(input.tags),
      input.created_at,
      input.created_at,
    ]
  )
  return (await fetchNoteById(id))!
}

export async function updateNote(id: string, input: UpdateNoteInput): Promise<void> {
  const db = await getDb()
  const sets: string[] = []
  const params: unknown[] = []

  if (input.title !== undefined) { sets.push('title = ?'); params.push(input.title) }
  if (input.content !== undefined) { sets.push('content = ?'); params.push(input.content) }
  if (input.plain_text !== undefined) { sets.push('plain_text = ?'); params.push(input.plain_text) }
  if (input.tags !== undefined) { sets.push('tags = ?'); params.push(JSON.stringify(input.tags)) }
  if (input.archive_id !== undefined) { sets.push('archive_id = ?'); params.push(input.archive_id) }
  if (input.favorite !== undefined) { sets.push('favorite = ?'); params.push(input.favorite ? 1 : 0) }
  if (input.created_at !== undefined) { sets.push('created_at = ?'); params.push(input.created_at) }

  sets.push("updated_at = datetime('now', 'localtime')")

  if (sets.length > 0) {
    await db.execute(`UPDATE notes SET ${sets.join(', ')} WHERE id = ?`, [...params, id])
  }
}

export async function deleteNote(id: string): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM notes WHERE id = ?', [id])
}

export async function toggleFavorite(id: string): Promise<void> {
  const db = await getDb()
  await db.execute("UPDATE notes SET favorite = CASE WHEN favorite = 1 THEN 0 ELSE 1 END, updated_at = datetime('now', 'localtime') WHERE id = ?", [id])
}

export async function fetchFavoriteNotes(): Promise<Note[]> {
  const db = await getDb()
  const rows = await db.select<NoteRow[]>(
    'SELECT * FROM notes WHERE favorite = 1 ORDER BY updated_at DESC LIMIT 10'
  )
  return rows.map(deserializeNote)
}

export async function fetchRecentNotes(limit = 6): Promise<Note[]> {
  const db = await getDb()
  const rows = await db.select<NoteRow[]>(
    'SELECT * FROM notes ORDER BY created_at DESC LIMIT ?', [limit]
  )
  return rows.map(deserializeNote)
}

export async function searchNotes(oshiId: string, params: SearchParams): Promise<{ notes: Note[]; total: number }> {
  const db = await getDb()
  const conditions: string[] = ['n.oshi_id = ?']
  const bindings: unknown[] = [oshiId]

  if (params.query) {
    const query = `%${escapeLike(params.query.trim())}%`
    conditions.push(`(
      n.title LIKE ? ESCAPE '\\' OR
      n.plain_text LIKE ? ESCAPE '\\' OR
      n.content LIKE ? ESCAPE '\\' OR
      n.tags LIKE ? ESCAPE '\\'
    )`)
    bindings.push(query, query, query, query)
  }

  if (params.tag) {
    conditions.push('n.tags LIKE ?')
    bindings.push(`%"${params.tag}"%`)
  }

  if (params.dateFrom) {
    conditions.push('n.created_at >= ?')
    bindings.push(params.dateFrom)
  }

  if (params.dateTo) {
    conditions.push('n.created_at <= ?')
    bindings.push(params.dateTo)
  }

  const where = conditions.join(' AND ')
  const countResult = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM notes n WHERE ${where}`, bindings
  )

  const offset = (params.page - 1) * params.pageSize
  const rows = await db.select<NoteRow[]>(
    `SELECT n.* FROM notes n WHERE ${where} ORDER BY n.created_at DESC LIMIT ? OFFSET ?`,
    [...bindings, params.pageSize, offset]
  )

  return {
    notes: rows.map(deserializeNote),
    total: countResult[0]?.count || 0,
  }
}

export async function fetchNotesByTag(tag: string): Promise<Note[]> {
  const db = await getDb()
  const rows = await db.select<NoteRow[]>(
    'SELECT * FROM notes WHERE tags LIKE ? ORDER BY created_at DESC',
    [`%"${tag}"%`]
  )
  return rows.map(deserializeNote).filter((note) => note.tags.includes(tag))
}

export async function getAllTags(): Promise<{ tag: string; count: number }[]> {
  const db = await getDb()
  const rows = await db.select<NoteRow[]>('SELECT tags FROM notes')
  const tagCounts: Record<string, number> = {}
  for (const row of rows) {
    const tags: string[] = JSON.parse(row.tags || '[]')
    for (const tag of tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1
    }
  }
  return Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
}

export async function getTotalNoteCount(): Promise<number> {
  const db = await getDb()
  const rows = await db.select<{ count: number }[]>('SELECT COUNT(*) as count FROM notes')
  return rows[0]?.count || 0
}

export async function getTotalOshiCount(): Promise<number> {
  const db = await getDb()
  const rows = await db.select<{ count: number }[]>('SELECT COUNT(*) as count FROM oshis')
  return rows[0]?.count || 0
}

export async function getTotalTagCount(): Promise<number> {
  const tags = await getAllTags()
  return tags.length
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}
