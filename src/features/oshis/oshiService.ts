import { getDb, generateId } from '../../database'
import type { Oshi, OshiRow, CreateOshiInput, UpdateOshiInput } from '../../types'

function deserializeOshi(row: OshiRow): Oshi {
  return {
    ...row,
    description: row.description || '',
    activity_links: JSON.parse(row.activity_links || '[]'),
  }
}

export async function fetchAllOshis(): Promise<Oshi[]> {
  const db = await getDb()
  const rows = await db.select<OshiRow[]>('SELECT * FROM oshis ORDER BY created_at DESC')
  return rows.map(deserializeOshi)
}

export async function fetchOshiById(id: string): Promise<Oshi | null> {
  const db = await getDb()
  const rows = await db.select<OshiRow[]>('SELECT * FROM oshis WHERE id = ?', [id])
  return rows[0] ? deserializeOshi(rows[0]) : null
}

export async function createOshi(input: CreateOshiInput): Promise<Oshi> {
  const db = await getDb()
  const id = generateId()
  await db.execute(
    'INSERT INTO oshis (id, name, avatar, color, description, activity_links) VALUES (?, ?, ?, ?, ?, ?)',
    [
      id,
      input.name,
      input.avatar || null,
      input.color || null,
      input.description || '',
      JSON.stringify(input.activity_links || []),
    ]
  )
  return (await fetchOshiById(id))!
}

export async function updateOshi(id: string, input: UpdateOshiInput): Promise<void> {
  const db = await getDb()
  const sets: string[] = []
  const params: unknown[] = []

  if (input.name !== undefined) { sets.push('name = ?'); params.push(input.name) }
  if (input.avatar !== undefined) { sets.push('avatar = ?'); params.push(input.avatar) }
  if (input.color !== undefined) { sets.push('color = ?'); params.push(input.color) }
  if (input.description !== undefined) { sets.push('description = ?'); params.push(input.description) }
  if (input.activity_links !== undefined) { sets.push('activity_links = ?'); params.push(JSON.stringify(input.activity_links)) }

  if (sets.length > 0) {
    await db.execute(`UPDATE oshis SET ${sets.join(', ')} WHERE id = ?`, [...params, id])
  }
}

export async function deleteOshi(id: string): Promise<void> {
  const db = await getDb()
  await db.execute("UPDATE notes SET oshi_id = NULL, archive_id = NULL, updated_at = datetime('now', 'localtime') WHERE oshi_id = ?", [id])
  await db.execute('DELETE FROM archives WHERE oshi_id = ?', [id])
  await db.execute('DELETE FROM oshis WHERE id = ?', [id])
}

export async function getOshiNoteCount(oshiId: string): Promise<number> {
  const db = await getDb()
  const rows = await db.select<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM notes WHERE oshi_id = ?',
    [oshiId]
  )
  return rows[0]?.count || 0
}

export async function getOshiArchiveCount(oshiId: string): Promise<number> {
  const db = await getDb()
  const rows = await db.select<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM archives WHERE oshi_id = ?',
    [oshiId]
  )
  return rows[0]?.count || 0
}
