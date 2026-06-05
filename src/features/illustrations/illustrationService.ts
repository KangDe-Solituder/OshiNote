import { getDb, generateId } from '../../database'
import type {
  CreateIllustrationInput,
  Illustration,
  IllustrationCategory,
  IllustrationRow,
  IllustrationSearchParams,
  UpdateIllustrationInput,
} from '../../types'
import { removeIllustrationFiles } from '../../services/media/illustrationMedia'

export async function fetchIllustrations(params: IllustrationSearchParams): Promise<Illustration[]> {
  const db = await getDb()
  const conditions: string[] = []
  const bindings: unknown[] = []

  if (params.oshiId) {
    conditions.push('oshi_id = ?')
    bindings.push(params.oshiId)
  }
  if (params.category) {
    conditions.push('category = ?')
    bindings.push(params.category)
  }
  if (params.favorite) {
    conditions.push('favorite = 1')
  }
  if (!params.includeArchived) {
    conditions.push('archived = 0')
  }
  if (params.query?.trim()) {
    const query = `%${escapeLike(params.query.trim())}%`
    conditions.push(`(
      title LIKE ? ESCAPE '\\' OR
      artist LIKE ? ESCAPE '\\' OR
      owner LIKE ? ESCAPE '\\' OR
      source_url LIKE ? ESCAPE '\\' OR
      tags LIKE ? ESCAPE '\\' OR
      description LIKE ? ESCAPE '\\'
    )`)
    bindings.push(query, query, query, query, query, query)
  }
  if (params.tag) {
    conditions.push("tags LIKE ? ESCAPE '\\'")
    bindings.push(buildTagLikePattern(params.tag))
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const orderBy = params.sort === 'oldest'
    ? 'COALESCE(date, created_at) ASC, created_at ASC'
    : params.sort === 'title'
      ? 'title COLLATE NOCASE ASC, created_at DESC'
      : 'COALESCE(date, created_at) DESC, created_at DESC'

  const rows = await db.select<IllustrationRow[]>(
    `SELECT * FROM illustrations ${where} ORDER BY ${orderBy}`,
    bindings
  )
  return rows.map(deserializeIllustration)
}

export async function fetchIllustrationById(id: string): Promise<Illustration | null> {
  const db = await getDb()
  const rows = await db.select<IllustrationRow[]>('SELECT * FROM illustrations WHERE id = ?', [id])
  return rows[0] ? deserializeIllustration(rows[0]) : null
}

export async function getIllustrationCountByOshi(oshiId: string): Promise<number> {
  const db = await getDb()
  const rows = await db.select<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM illustrations WHERE oshi_id = ? AND archived = 0',
    [oshiId]
  )
  return rows[0]?.count || 0
}

export async function createIllustration(input: CreateIllustrationInput): Promise<Illustration> {
  const db = await getDb()
  const id = input.id || generateId()
  await db.execute(
    `INSERT INTO illustrations (
      id, oshi_id, category, title, original_path, thumbnail_path, original_filename,
      mime_type, file_size, width, height, date, owner, artist, source_url, tags, description
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.oshi_id || null,
      input.category,
      input.title,
      input.original_path,
      input.thumbnail_path || null,
      input.original_filename,
      input.mime_type,
      input.file_size,
      input.width ?? null,
      input.height ?? null,
      input.date || null,
      input.owner || '',
      input.artist || '',
      input.source_url || '',
      JSON.stringify(input.tags || []),
      input.description || '',
    ]
  )
  return (await fetchIllustrationById(id))!
}

export async function updateIllustration(id: string, input: UpdateIllustrationInput): Promise<void> {
  const db = await getDb()
  const sets: string[] = []
  const params: unknown[] = []

  if (input.oshi_id !== undefined) { sets.push('oshi_id = ?'); params.push(input.oshi_id) }
  if (input.category !== undefined) { sets.push('category = ?'); params.push(input.category) }
  if (input.title !== undefined) { sets.push('title = ?'); params.push(input.title) }
  if (input.date !== undefined) { sets.push('date = ?'); params.push(input.date) }
  if (input.owner !== undefined) { sets.push('owner = ?'); params.push(input.owner) }
  if (input.artist !== undefined) { sets.push('artist = ?'); params.push(input.artist) }
  if (input.source_url !== undefined) { sets.push('source_url = ?'); params.push(input.source_url) }
  if (input.tags !== undefined) { sets.push('tags = ?'); params.push(JSON.stringify(input.tags)) }
  if (input.description !== undefined) { sets.push('description = ?'); params.push(input.description) }
  if (input.favorite !== undefined) { sets.push('favorite = ?'); params.push(input.favorite ? 1 : 0) }
  if (input.archived !== undefined) { sets.push('archived = ?'); params.push(input.archived ? 1 : 0) }

  if (sets.length === 0) return
  sets.push("updated_at = datetime('now', 'localtime')")
  await db.execute(`UPDATE illustrations SET ${sets.join(', ')} WHERE id = ?`, [...params, id])
}

export async function toggleIllustrationFavorite(id: string): Promise<void> {
  const db = await getDb()
  await db.execute(
    "UPDATE illustrations SET favorite = CASE WHEN favorite = 1 THEN 0 ELSE 1 END, updated_at = datetime('now', 'localtime') WHERE id = ?",
    [id]
  )
}

export async function deleteIllustration(id: string): Promise<void> {
  const illustration = await fetchIllustrationById(id)
  const db = await getDb()
  await db.execute('DELETE FROM illustrations WHERE id = ?', [id])
  if (illustration) {
    await removeIllustrationFiles([illustration.original_path, illustration.thumbnail_path])
  }
}

export async function getIllustrationTags(oshiId?: string): Promise<{ tag: string; count: number }[]> {
  const db = await getDb()
  const rows = await db.select<Pick<IllustrationRow, 'tags'>[]>(
    oshiId ? 'SELECT tags FROM illustrations WHERE oshi_id = ?' : 'SELECT tags FROM illustrations',
    oshiId ? [oshiId] : []
  )
  const counts = new Map<string, number>()
  for (const row of rows) {
    const tags = parseTags(row.tags)
    for (const tag of tags) {
      counts.set(tag, (counts.get(tag) || 0) + 1)
    }
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

export function createIllustrationId(): string {
  return generateId()
}

function deserializeIllustration(row: IllustrationRow): Illustration {
  return {
    ...row,
    category: isIllustrationCategory(row.category) ? row.category : 'official',
    tags: parseTags(row.tags),
    favorite: row.favorite === 1,
    archived: row.archived === 1,
  }
}

function isIllustrationCategory(value: string): value is IllustrationCategory {
  return value === 'official' || value === 'fanart'
}

function parseTags(value: string): string[] {
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === 'string') : []
  } catch {
    return []
  }
}

function buildTagLikePattern(tag: string): string {
  return `%${escapeLike(JSON.stringify(tag))}%`
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}
