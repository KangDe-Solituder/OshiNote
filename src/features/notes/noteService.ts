import { getDb, generateId } from '../../database'
import type {
  Note,
  NoteLibraryItem,
  NoteRow,
  CreateNoteInput,
  UpdateNoteInput,
  SearchParams,
  GlobalNoteSearchParams,
  NoteImage,
} from '../../types'

interface NoteLibraryRow extends NoteRow {
  oshi_name: string | null
  oshi_avatar: string | null
  oshi_color: string | null
  archive_name: string | null
}

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
      input.oshi_id || null,
      input.archive_id || null,
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
  if (input.oshi_id !== undefined) { sets.push('oshi_id = ?'); params.push(input.oshi_id) }
  if (input.archive_id !== undefined) { sets.push('archive_id = ?'); params.push(input.archive_id) }
  if (input.favorite !== undefined) { sets.push('favorite = ?'); params.push(input.favorite ? 1 : 0) }
  if (input.created_at !== undefined) { sets.push('created_at = ?'); params.push(input.created_at) }

  sets.push("updated_at = datetime('now', 'localtime')")

  if (sets.length > 0) {
    await db.execute(`UPDATE notes SET ${sets.join(', ')} WHERE id = ?`, [...params, id])
  }
}

export async function fetchAllNotes(params: GlobalNoteSearchParams): Promise<{ notes: NoteLibraryItem[]; total: number }> {
  const db = await getDb()
  const conditions: string[] = []
  const bindings: unknown[] = []

  if (params.query?.trim()) {
    const query = `%${escapeLike(params.query.trim())}%`
    conditions.push(`(
      n.title LIKE ? ESCAPE '\\' OR
      n.plain_text LIKE ? ESCAPE '\\' OR
      n.content LIKE ? ESCAPE '\\' OR
      n.tags LIKE ? ESCAPE '\\'
    )`)
    bindings.push(query, query, query, query)
  }

  if (params.oshiId) {
    conditions.push('n.oshi_id = ?')
    bindings.push(params.oshiId)
  }

  if (params.archiveId) {
    conditions.push('n.archive_id = ?')
    bindings.push(params.archiveId)
  }

  if (params.tag) {
    conditions.push("n.tags LIKE ? ESCAPE '\\'")
    bindings.push(buildTagLikePattern(params.tag))
  }

  if (params.favorite) {
    conditions.push('n.favorite = 1')
  }

  if (params.ownership === 'unassigned') conditions.push('n.oshi_id IS NULL')
  if (params.ownership === 'unfiled') conditions.push('n.archive_id IS NULL')
  if (params.ownership === 'untagged') conditions.push("n.tags = '[]'")
  if (params.ownership === 'needs-sorting') {
    conditions.push("(n.oshi_id IS NULL OR n.archive_id IS NULL OR n.tags = '[]')")
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const orderBy = params.sort === 'oldest'
    ? 'n.created_at ASC'
    : params.sort === 'updated'
      ? 'n.updated_at DESC'
      : 'n.created_at DESC'
  const offset = (params.page - 1) * params.pageSize

  const countRows = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM notes n ${where}`,
    bindings
  )
  const rows = await db.select<NoteLibraryRow[]>(
    `SELECT
       n.*,
       o.name as oshi_name,
       o.avatar as oshi_avatar,
       o.color as oshi_color,
       a.name as archive_name
     FROM notes n
     LEFT JOIN oshis o ON o.id = n.oshi_id
     LEFT JOIN archives a ON a.id = n.archive_id
     ${where}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [...bindings, params.pageSize, offset]
  )

  return {
    notes: rows.map(deserializeLibraryNote),
    total: countRows[0]?.count || 0,
  }
}

export async function deleteNote(id: string): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM note_images WHERE note_id = ?', [id])
  await db.execute('DELETE FROM notes WHERE id = ?', [id])
}

export async function fetchNoteImages(noteId: string): Promise<NoteImage[]> {
  const db = await getDb()
  return db.select<NoteImage[]>(
    'SELECT * FROM note_images WHERE note_id = ? ORDER BY sort_order ASC, created_at ASC',
    [noteId]
  )
}

export async function replaceNoteImages(noteId: string, dataUrls: string[]): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM note_images WHERE note_id = ?', [noteId])
  for (const [sortOrder, dataUrl] of dataUrls.entries()) {
    await db.execute(
      'INSERT INTO note_images (id, note_id, data_url, sort_order) VALUES (?, ?, ?, ?)',
      [generateId(), noteId, dataUrl, sortOrder]
    )
  }
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

  // Use FTS5 when a text query is provided for better ranking and performance.
  const ftsQuery = params.query ? buildFts5Query(params.query.trim()) : ''
  const hasFullTextQuery = ftsQuery.length > 0

  if (hasFullTextQuery) {
    const conditions: string[] = ['n.oshi_id = ?']
    const bindings: unknown[] = [oshiId]

    if (params.tag) {
      conditions.push("n.tags LIKE ? ESCAPE '\\'")
      bindings.push(buildTagLikePattern(params.tag))
    }

    if (params.dateFrom) {
      conditions.push('n.created_at >= ?')
      bindings.push(params.dateFrom)
    }

    if (params.dateTo) {
      conditions.push('n.created_at <= ?')
      bindings.push(params.dateTo)
    }

    const ftsWhere = [...conditions, 'notes_fts MATCH ?'].join(' AND ')
    const ftsRows = await db.select<NoteRow[]>(
      `SELECT n.* FROM notes n
       JOIN notes_fts ON n.rowid = notes_fts.rowid
       WHERE ${ftsWhere}
       ORDER BY rank`,
      [...bindings, ftsQuery]
    )

    const query = `%${escapeLike(params.query!.trim())}%`
    const likeWhere = [
      ...conditions,
      `(
        n.title LIKE ? ESCAPE '\\' OR
        n.plain_text LIKE ? ESCAPE '\\' OR
        n.content LIKE ? ESCAPE '\\' OR
        n.tags LIKE ? ESCAPE '\\'
      )`,
    ].join(' AND ')
    const likeRows = await db.select<NoteRow[]>(
      `SELECT n.* FROM notes n
       WHERE ${likeWhere}
       ORDER BY n.created_at DESC`,
      [...bindings, query, query, query, query]
    )

    const merged = new Map<string, Note>()
    for (const row of ftsRows) {
      merged.set(row.id, deserializeNote(row))
    }
    for (const row of likeRows) {
      if (!merged.has(row.id)) {
        merged.set(row.id, deserializeNote(row))
      }
    }

    const offset = (params.page - 1) * params.pageSize
    const notes = Array.from(merged.values())

    return {
      notes: notes.slice(offset, offset + params.pageSize),
      total: notes.length,
    }
  }

  // Fallback: no text query — use existing simple filters (tag, date range only).
  const conditions: string[] = ['n.oshi_id = ?']
  const bindings: unknown[] = [oshiId]

  if (params.query?.trim()) {
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
    conditions.push("n.tags LIKE ? ESCAPE '\\'")
    bindings.push(buildTagLikePattern(params.tag))
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

/**
 * Build a safe FTS5 query string from raw user input.
 * Each token gets a * suffix for prefix matching (e.g. "stream" matches "streaming").
 * Special FTS5 query characters are stripped from each token.
 */
function buildFts5Query(raw: string): string {
  return raw
    .replace(/[*"()^~:@]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => `"${token}"*`)
    .join(' ')
}

export async function fetchNotesByTag(tag: string): Promise<Note[]> {
  const db = await getDb()
  const rows = await db.select<NoteRow[]>(
    "SELECT * FROM notes WHERE tags LIKE ? ESCAPE '\\' ORDER BY created_at DESC",
    [buildTagLikePattern(tag)]
  )
  return rows.map(deserializeNote).filter((note) => note.tags.includes(tag))
}

export async function fetchNotesByTagPaginated(
  tag: string,
  options: { page: number; pageSize: number; sort: 'newest' | 'oldest' }
): Promise<{ notes: Note[]; total: number }> {
  const db = await getDb()
  const order = options.sort === 'oldest' ? 'ASC' : 'DESC'
  const offset = (options.page - 1) * options.pageSize
  const rows = await db.select<NoteRow[]>(
    `SELECT * FROM notes WHERE tags LIKE ? ESCAPE '\\' ORDER BY created_at ${order}`,
    [buildTagLikePattern(tag)]
  )
  const matchingNotes = rows.map(deserializeNote).filter((note) => note.tags.includes(tag))
  return {
    notes: matchingNotes.slice(offset, offset + options.pageSize),
    total: matchingNotes.length,
  }
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

function buildTagLikePattern(tag: string): string {
  return `%${escapeLike(JSON.stringify(tag))}%`
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

function deserializeLibraryNote(row: NoteLibraryRow): NoteLibraryItem {
  return {
    ...deserializeNote(row),
    oshi_name: row.oshi_name,
    oshi_avatar: row.oshi_avatar,
    oshi_color: row.oshi_color,
    archive_name: row.archive_name,
  }
}
