import { getDb, generateId } from '../../database'
import type {
  JournalItem,
  JournalItemRow,
  JournalItemWithNote,
  JournalBook,
  JournalPage,
  JournalStickerStyle,
  Note,
  NoteRow,
} from '../../types'
import { createInitialLayout } from './journalLayout'

interface JoinedJournalItemRow extends JournalItemRow {
  note_oshi_id: string | null
  note_archive_id: string | null
  note_title: string
  note_content: string
  note_plain_text: string
  note_tags: string
  note_favorite: number
  note_created_at: string
  note_updated_at: string
}

export interface JournalLayoutUpdate {
  x: number
  y: number
  width: number
  height: number
  rotation: number
  z_index?: number
}

export interface JournalStyleUpdate {
  sticker_style?: JournalStickerStyle
  color?: string | null
  border_style?: string | null
}

export async function fetchJournalBooks(oshiId: string): Promise<JournalBook[]> {
  const db = await getDb()
  return db.select<JournalBook[]>(
    `SELECT jb.*, COUNT(jp.id) as page_count
     FROM journal_books jb
     LEFT JOIN journal_pages jp ON jp.book_id = jb.id
     WHERE jb.oshi_id = ?
     GROUP BY jb.id
     ORDER BY jb.sort_order ASC, jb.created_at ASC`,
    [oshiId]
  )
}

export async function createJournalBook(oshiId: string, title: string): Promise<JournalBook> {
  const db = await getDb()
  const id = generateId()
  const rows = await db.select<{ next_order: number }[]>(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM journal_books WHERE oshi_id = ?',
    [oshiId]
  )
  const colors = ['#8B5CF6', '#EC4899', '#3B82F6', '#10B981', '#F59E0B']
  const sortOrder = rows[0]?.next_order ?? 0
  await db.execute(
    `INSERT INTO journal_books (id, oshi_id, title, cover_color, sort_order)
     VALUES (?, ?, ?, ?, ?)`,
    [id, oshiId, title, colors[sortOrder % colors.length], sortOrder]
  )
  await createJournalPage(id, 'Page 1')
  return (await fetchJournalBookById(id))!
}

export async function updateJournalBook(id: string, title: string): Promise<void> {
  const db = await getDb()
  await db.execute(
    "UPDATE journal_books SET title = ?, updated_at = datetime('now', 'localtime') WHERE id = ?",
    [title, id]
  )
}

export async function deleteJournalBook(id: string): Promise<void> {
  const db = await getDb()
  const pages = await fetchJournalPages(id)
  for (const page of pages) {
    await db.execute('DELETE FROM journal_items WHERE page_id = ?', [page.id])
  }
  await db.execute('DELETE FROM journal_pages WHERE book_id = ?', [id])
  await db.execute('DELETE FROM journal_books WHERE id = ?', [id])
}

export async function fetchJournalPages(bookId: string): Promise<JournalPage[]> {
  const db = await getDb()
  return db.select<JournalPage[]>(
    'SELECT * FROM journal_pages WHERE book_id = ? ORDER BY page_index ASC',
    [bookId]
  )
}

export async function ensureJournalPage(bookId: string): Promise<JournalPage> {
  const pages = await fetchJournalPages(bookId)
  if (pages[0]) return pages[0]
  return createJournalPage(bookId, 'Page 1')
}

export async function createJournalPage(bookId: string, title?: string): Promise<JournalPage> {
  const db = await getDb()
  const rows = await db.select<{ next_index: number }[]>(
    'SELECT COALESCE(MAX(page_index), -1) + 1 as next_index FROM journal_pages WHERE book_id = ?',
    [bookId]
  )
  const id = generateId()
  const pageIndex = rows[0]?.next_index ?? 0
  await db.execute(
    `INSERT INTO journal_pages (id, book_id, title, page_index, background)
     VALUES (?, ?, ?, ?, 'paper')`,
    [id, bookId, title || `Page ${pageIndex + 1}`, pageIndex]
  )
  return (await fetchJournalPageById(id))!
}

export async function updateJournalPage(
  id: string,
  input: Partial<Pick<JournalPage, 'title' | 'background'>>
): Promise<void> {
  const db = await getDb()
  const sets: string[] = []
  const params: unknown[] = []
  if (input.title !== undefined) { sets.push('title = ?'); params.push(input.title) }
  if (input.background !== undefined) { sets.push('background = ?'); params.push(input.background) }
  sets.push("updated_at = datetime('now', 'localtime')")
  await db.execute(`UPDATE journal_pages SET ${sets.join(', ')} WHERE id = ?`, [...params, id])
}

export async function deleteJournalPage(id: string): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM journal_items WHERE page_id = ?', [id])
  await db.execute('DELETE FROM journal_pages WHERE id = ?', [id])
}

export async function fetchJournalItems(pageId: string): Promise<JournalItemWithNote[]> {
  const db = await getDb()
  const rows = await db.select<JoinedJournalItemRow[]>(
    `SELECT
       ji.*,
       n.oshi_id as note_oshi_id,
       n.archive_id as note_archive_id,
       n.title as note_title,
       n.content as note_content,
       n.plain_text as note_plain_text,
       n.tags as note_tags,
       n.favorite as note_favorite,
       n.created_at as note_created_at,
       n.updated_at as note_updated_at
     FROM journal_items ji
     JOIN notes n ON n.id = ji.note_id
     WHERE ji.page_id = ?
     ORDER BY ji.z_index ASC, ji.created_at ASC`,
    [pageId]
  )
  return rows.map(deserializeJoinedItem)
}

export async function ensureJournalItemsForNotes(pageId: string, notes: Note[]): Promise<void> {
  const existing = await fetchJournalItemNoteIds(pageId)
  const db = await getDb()
  let nextIndex = existing.size

  for (const note of notes) {
    if (existing.has(note.id)) continue
    const layout = createInitialLayout(nextIndex)
    await db.execute(
      `INSERT OR IGNORE INTO journal_items
       (id, page_id, note_id, item_type, x, y, width, height, rotation, z_index, sticker_style, color)
       VALUES (?, ?, ?, 'note', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        generateId(),
        pageId,
        note.id,
        layout.x,
        layout.y,
        layout.width,
        layout.height,
        layout.rotation,
        layout.z_index,
        layout.sticker_style,
        layout.color,
      ]
    )
    nextIndex += 1
  }
}

export async function createJournalItemForNote(pageId: string, noteId: string): Promise<JournalItem> {
  const db = await getDb()
  const existing = await db.select<JournalItemRow[]>(
    'SELECT * FROM journal_items WHERE page_id = ? AND note_id = ?',
    [pageId, noteId]
  )
  if (existing[0]) return deserializeItem(existing[0])

  const rows = await db.select<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM journal_items WHERE page_id = ?',
    [pageId]
  )
  const layout = createInitialLayout(rows[0]?.count || 0)
  const id = generateId()
  await db.execute(
    `INSERT INTO journal_items
     (id, page_id, note_id, item_type, x, y, width, height, rotation, z_index, sticker_style, color)
     VALUES (?, ?, ?, 'note', ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      pageId,
      noteId,
      layout.x,
      layout.y,
      layout.width,
      layout.height,
      layout.rotation,
      layout.z_index,
      layout.sticker_style,
      layout.color,
    ]
  )
  return (await fetchJournalItemById(id))!
}

export async function fetchUnplacedNotes(pageId: string, oshiId: string): Promise<Note[]> {
  const db = await getDb()
  const rows = await db.select<NoteRow[]>(
    `SELECT n.* FROM notes n
     WHERE n.oshi_id = ?
       AND NOT EXISTS (
         SELECT 1 FROM journal_items ji
         WHERE ji.page_id = ? AND ji.note_id = n.id
       )
     ORDER BY n.created_at DESC`,
    [oshiId, pageId]
  )
  return rows.map(deserializeNote)
}

export async function updateJournalItemLayout(id: string, input: JournalLayoutUpdate): Promise<void> {
  const db = await getDb()
  await db.execute(
    `UPDATE journal_items
     SET x = ?, y = ?, width = ?, height = ?, rotation = ?,
         z_index = COALESCE(?, z_index),
         updated_at = datetime('now', 'localtime')
     WHERE id = ?`,
    [input.x, input.y, input.width, input.height, input.rotation, input.z_index ?? null, id]
  )
}

export async function updateJournalItemStyle(id: string, input: JournalStyleUpdate): Promise<void> {
  const db = await getDb()
  const sets: string[] = []
  const params: unknown[] = []
  if (input.sticker_style !== undefined) { sets.push('sticker_style = ?'); params.push(input.sticker_style) }
  if (input.color !== undefined) { sets.push('color = ?'); params.push(input.color) }
  if (input.border_style !== undefined) { sets.push('border_style = ?'); params.push(input.border_style) }
  sets.push("updated_at = datetime('now', 'localtime')")
  await db.execute(`UPDATE journal_items SET ${sets.join(', ')} WHERE id = ?`, [...params, id])
}

export async function removeJournalItem(id: string): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM journal_items WHERE id = ?', [id])
}

async function fetchJournalPageById(id: string): Promise<JournalPage | null> {
  const db = await getDb()
  const rows = await db.select<JournalPage[]>('SELECT * FROM journal_pages WHERE id = ?', [id])
  return rows[0] || null
}

async function fetchJournalBookById(id: string): Promise<JournalBook | null> {
  const db = await getDb()
  const rows = await db.select<JournalBook[]>(
    `SELECT jb.*, COUNT(jp.id) as page_count
     FROM journal_books jb
     LEFT JOIN journal_pages jp ON jp.book_id = jb.id
     WHERE jb.id = ?
     GROUP BY jb.id`,
    [id]
  )
  return rows[0] || null
}

async function fetchJournalItemById(id: string): Promise<JournalItem | null> {
  const db = await getDb()
  const rows = await db.select<JournalItemRow[]>('SELECT * FROM journal_items WHERE id = ?', [id])
  return rows[0] ? deserializeItem(rows[0]) : null
}

async function fetchJournalItemNoteIds(pageId: string): Promise<Set<string>> {
  const db = await getDb()
  const rows = await db.select<{ note_id: string }[]>(
    'SELECT note_id FROM journal_items WHERE page_id = ?',
    [pageId]
  )
  return new Set(rows.map((row) => row.note_id))
}

function deserializeJoinedItem(row: JoinedJournalItemRow): JournalItemWithNote {
  return {
    ...deserializeItem(row),
    note: deserializeNote({
      id: row.note_id,
      oshi_id: row.note_oshi_id,
      archive_id: row.note_archive_id,
      title: row.note_title,
      content: row.note_content,
      plain_text: row.note_plain_text,
      tags: row.note_tags,
      favorite: row.note_favorite,
      created_at: row.note_created_at,
      updated_at: row.note_updated_at,
    }),
  }
}

function deserializeItem(row: JournalItemRow): JournalItem {
  return {
    ...row,
    item_type: 'note',
    sticker_style: isStickerStyle(row.sticker_style) ? row.sticker_style : 'sticky',
  }
}

function deserializeNote(row: NoteRow): Note {
  return {
    ...row,
    tags: JSON.parse(row.tags || '[]'),
    favorite: row.favorite === 1,
  }
}

function isStickerStyle(value: string): value is JournalStickerStyle {
  return value === 'sticky' || value === 'memo' || value === 'ticket'
}
