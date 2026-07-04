import { getDb, generateId } from '../../database'
import type { Archive } from '../../types'

const DEFAULT_ARCHIVES = ['Spring', 'Summer', 'Autumn', 'Winter']

export async function fetchArchivesByOshi(oshiId: string): Promise<Archive[]> {
  const db = await getDb()
  return await db.select<Archive[]>(
    'SELECT * FROM archives WHERE oshi_id = ? ORDER BY sort_order ASC',
    [oshiId]
  )
}

export async function createArchive(oshiId: string, name: string): Promise<Archive> {
  const db = await getDb()
  const id = generateId()
  const maxSort = await db.select<{ max_sort: number }[]>(
    'SELECT COALESCE(MAX(sort_order), -1) as max_sort FROM archives WHERE oshi_id = ?',
    [oshiId]
  )
  const sortOrder = (maxSort[0]?.max_sort ?? -1) + 1
  await db.execute(
    'INSERT INTO archives (id, oshi_id, name, sort_order) VALUES (?, ?, ?, ?)',
    [id, oshiId, name, sortOrder]
  )
  const rows = await db.select<Archive[]>('SELECT * FROM archives WHERE id = ?', [id])
  return rows[0]
}

export async function updateArchive(id: string, name: string): Promise<void> {
  const db = await getDb()
  await db.execute('UPDATE archives SET name = ? WHERE id = ?', [name, id])
}

export async function updateArchiveList(archives: { id: string; name: string }[]): Promise<void> {
  const db = await getDb()
  for (const [sortOrder, archive] of archives.entries()) {
    await db.execute(
      'UPDATE archives SET name = ?, sort_order = ? WHERE id = ?',
      [archive.name, sortOrder, archive.id]
    )
  }
}

export async function deleteArchive(id: string): Promise<void> {
  const db = await getDb()
  // Removing an archive keeps its notes and moves them back to the default unfiled state.
  await db.execute("UPDATE notes SET archive_id = NULL, updated_at = datetime('now', 'localtime') WHERE archive_id = ?", [id])
  await db.execute('DELETE FROM archives WHERE id = ?', [id])
}

export async function fetchAllArchives(): Promise<Archive[]> {
  const db = await getDb()
  return db.select<Archive[]>('SELECT * FROM archives ORDER BY name ASC')
}

export async function getArchiveNoteCount(id: string): Promise<number> {
  const db = await getDb()
  const rows = await db.select<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM notes WHERE archive_id = ?',
    [id]
  )
  return rows[0]?.count || 0
}

export async function createDefaultArchives(oshiId: string): Promise<void> {
  const db = await getDb()
  for (let i = 0; i < DEFAULT_ARCHIVES.length; i++) {
    const id = generateId()
    await db.execute(
      'INSERT INTO archives (id, oshi_id, name, sort_order) VALUES (?, ?, ?, ?)',
      [id, oshiId, DEFAULT_ARCHIVES[i], i]
    )
  }
}
