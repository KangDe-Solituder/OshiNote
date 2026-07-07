import { getDb, generateId } from '../../database'
import type {
  JournalItem,
  JournalItemRow,
  JournalItemWithNote,
  JournalBook,
  JournalCoverDecoration,
  JournalCoverStyle,
  JournalDraftItem,
  JournalPage,
  JournalPageOrientation,
  JournalPageType,
  JournalItemStyle,
  JournalItemType,
  JournalStickerStyle,
  JournalTapeStyle,
  Illustration,
  IllustrationRow,
  Note,
  NoteRow,
  StampInput,
} from '../../types'
import { createInitialLayout } from './journalLayout'
import { deleteStampForTarget, persistStampForTarget } from '../stamps/stampService'
import { getJournalMaterialDefinition, getMaterialSnapshot } from './journalMaterials'

interface JoinedJournalItemRow extends JournalItemRow {
  note_oshi_id: string | null
  note_archive_id: string | null
  note_title: string | null
  note_content: string | null
  note_plain_text: string | null
  note_source_url: string | null
  note_tags: string | null
  note_favorite: number | null
  note_created_at: string | null
  note_updated_at: string | null
  illustration_oshi_id: string | null
  illustration_category: string | null
  illustration_title: string | null
  illustration_original_path: string | null
  illustration_thumbnail_path: string | null
  illustration_original_filename: string | null
  illustration_mime_type: string | null
  illustration_file_size: number | null
  illustration_width: number | null
  illustration_height: number | null
  illustration_date: string | null
  illustration_owner: string | null
  illustration_artist: string | null
  illustration_source_url: string | null
  illustration_tags: string | null
  illustration_description: string | null
  illustration_favorite: number | null
  illustration_archived: number | null
  illustration_created_at: string | null
  illustration_updated_at: string | null
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
  sticker_style?: JournalItemStyle
  color?: string | null
  border_style?: string | null
  style_payload?: string
}

export interface CreateJournalPageDraftInput {
  oshiId: string
  bookId?: string | null
  title: string
  description: string
  dateLabel: string
  background: string
  orientation?: JournalPageOrientation
  items?: JournalDraftItem[]
  noteIds?: string[]
  illustrationIds?: string[]
  materialIds?: string[]
  stamp: StampInput | null
}

interface JournalPageRow extends Omit<JournalPage, 'page_type' | 'standalone' | 'orientation'> {
  page_type: string
  standalone: number
  orientation: string
}

export async function fetchJournalBooks(oshiId: string): Promise<JournalBook[]> {
  const db = await getDb()
  const rows = await db.select<JournalBook[]>(
    `SELECT jb.*, COUNT(jp.id) as page_count
     FROM journal_books jb
     LEFT JOIN journal_pages jp ON jp.book_id = jb.id AND jp.standalone = 0
     WHERE jb.oshi_id = ?
     GROUP BY jb.id
     ORDER BY jb.sort_order ASC, jb.created_at ASC`,
    [oshiId]
  )
  return rows.map(deserializeBook)
}

export async function getJournalBookCountByOshi(oshiId: string): Promise<number> {
  const db = await getDb()
  const rows = await db.select<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM journal_books WHERE oshi_id = ?',
    [oshiId]
  )
  return rows[0]?.count || 0
}

export async function createJournalBook(oshiId: string, title: string): Promise<JournalBook> {
  const db = await getDb()
  const id = generateId()
  const rows = await db.select<{ next_order: number }[]>(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM journal_books WHERE oshi_id = ?',
    [oshiId]
  )
  const colors = ['#c9c5f3', '#f2c4ce', '#d7e4f5', '#efe2cc', '#29314b', '#e8e5dd']
  const styles: JournalCoverStyle[] = ['cloth', 'paper', 'minimal', 'classic', 'night', 'postcard']
  const decorations: JournalCoverDecoration[] = ['ticket', 'flower', 'camera', 'heart', 'moon', 'none']
  const sortOrder = rows[0]?.next_order ?? 0
  await db.execute(
    `INSERT INTO journal_books
     (id, oshi_id, title, cover_color, cover_style, cover_decoration, date_label, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      oshiId,
      title,
      colors[sortOrder % colors.length],
      styles[sortOrder % styles.length],
      decorations[sortOrder % decorations.length],
      String(new Date().getFullYear()),
      sortOrder,
    ]
  )
  await createJournalPage(id, 'Page 1')
  return (await fetchJournalBookById(id))!
}

export async function updateJournalBook(
  id: string,
  input: Partial<Pick<JournalBook, 'title' | 'description' | 'cover_style' | 'cover_color' | 'cover_decoration' | 'date_label'>>
): Promise<void> {
  const db = await getDb()
  const sets: string[] = []
  const params: unknown[] = []
  if (input.title !== undefined) { sets.push('title = ?'); params.push(input.title) }
  if (input.description !== undefined) { sets.push('description = ?'); params.push(input.description) }
  if (input.cover_style !== undefined) { sets.push('cover_style = ?'); params.push(input.cover_style) }
  if (input.cover_color !== undefined) { sets.push('cover_color = ?'); params.push(input.cover_color) }
  if (input.cover_decoration !== undefined) { sets.push('cover_decoration = ?'); params.push(input.cover_decoration) }
  if (input.date_label !== undefined) { sets.push('date_label = ?'); params.push(input.date_label) }
  if (sets.length === 0) return
  sets.push("updated_at = datetime('now', 'localtime')")
  await db.execute(`UPDATE journal_books SET ${sets.join(', ')} WHERE id = ?`, [...params, id])
}

export async function deleteJournalBook(id: string): Promise<void> {
  const db = await getDb()
  const pages = await fetchJournalPages(id)
  for (const page of pages) {
    await db.execute('DELETE FROM journal_items WHERE page_id = ?', [page.id])
    await deleteStampForTarget('journal_page', page.id)
  }
  await db.execute('DELETE FROM journal_pages WHERE book_id = ?', [id])
  await db.execute('DELETE FROM journal_books WHERE id = ?', [id])
}

export async function fetchJournalPages(bookId: string): Promise<JournalPage[]> {
  const db = await getDb()
  const rows = await db.select<JournalPageRow[]>(
    'SELECT * FROM journal_pages WHERE book_id = ? AND standalone = 0 ORDER BY page_index ASC',
    [bookId]
  )
  return rows.map(deserializePage)
}

export async function fetchStandalonePostcards(oshiId: string): Promise<JournalPage[]> {
  const db = await getDb()
  const rows = await db.select<JournalPageRow[]>(
    `SELECT * FROM journal_pages
     WHERE oshi_id = ? AND page_type = 'postcard' AND standalone = 1
     ORDER BY updated_at DESC, created_at DESC`,
    [oshiId]
  )
  return rows.map(deserializePage)
}

export async function ensureJournalPage(bookId: string): Promise<JournalPage> {
  const pages = await fetchJournalPages(bookId)
  if (pages[0]) return pages[0]
  return createJournalPage(bookId, 'Page 1')
}

export async function createJournalPage(bookId: string, title?: string): Promise<JournalPage> {
  const db = await getDb()
  const bookRows = await db.select<{ oshi_id: string }[]>('SELECT oshi_id FROM journal_books WHERE id = ?', [bookId])
  const oshiId = bookRows[0]?.oshi_id || ''
  const rows = await db.select<{ next_index: number }[]>(
    'SELECT COALESCE(MAX(page_index), -1) + 1 as next_index FROM journal_pages WHERE book_id = ? AND standalone = 0',
    [bookId]
  )
  const id = generateId()
  const pageIndex = rows[0]?.next_index ?? 0
  await db.execute(
    `INSERT INTO journal_pages (id, book_id, oshi_id, page_type, title, page_index, background, orientation, standalone)
     VALUES (?, ?, ?, 'book_page', ?, ?, 'paper', 'portrait', 0)`,
    [id, bookId, oshiId, title || `Page ${pageIndex + 1}`, pageIndex]
  )
  return (await fetchJournalPageById(id))!
}

export async function createStandalonePostcard(oshiId: string, title: string): Promise<JournalPage> {
  const db = await getDb()
  const id = generateId()
  const label = String(new Date().getFullYear())
  await db.execute(
    `INSERT INTO journal_pages
     (id, book_id, oshi_id, page_type, title, description, date_label, page_index, background, orientation, standalone)
     VALUES (?, NULL, ?, 'postcard', ?, '', ?, 0, 'postcard', 'portrait', 1)`,
    [id, oshiId, title, label]
  )
  return (await fetchJournalPageById(id))!
}

export async function createJournalPageFromDraft(input: CreateJournalPageDraftInput): Promise<JournalPage> {
  const title = input.title.trim() || 'Untitled page'
  const page = input.bookId
    ? await createJournalPage(input.bookId, title)
    : await createStandalonePostcard(input.oshiId, title)
  await updateJournalPage(page.id, {
    title,
    description: input.description.trim(),
    date_label: input.dateLabel.trim(),
    background: input.background || 'paper',
    orientation: input.orientation || 'portrait',
  })

  let zIndex = 1
  if (input.items) {
    for (const item of input.items) {
      const layout = draftItemToLayout(item)
      if (item.itemType === 'note' && item.sourceId) {
        const created = await createJournalItemForNote(page.id, item.sourceId, layout)
        if (item.stylePayload !== undefined) await updateJournalItemStyle(created.id, { style_payload: item.stylePayload })
      } else if (item.itemType === 'illustration' && item.sourceId) {
        const created = await createJournalItemForIllustration(page.id, item.sourceId, layout)
        if (item.stylePayload !== undefined) await updateJournalItemStyle(created.id, { style_payload: item.stylePayload })
      } else if (item.itemType === 'material' && item.materialId) {
        await createJournalItemForMaterial(page.id, item.materialId, layout, item.stylePayload)
      }
    }
  } else {
    for (const [index, noteId] of (input.noteIds || []).slice(0, 12).entries()) {
      await createJournalItemForNote(page.id, noteId, createDraftNoteLayout(index, zIndex++))
    }
    for (const [index, illustrationId] of (input.illustrationIds || []).slice(0, 12).entries()) {
      await createJournalItemForIllustration(page.id, illustrationId, createDraftIllustrationLayout(index, zIndex++))
    }
    for (const [index, materialId] of (input.materialIds || []).slice(0, 24).entries()) {
      await createJournalItemForMaterial(page.id, materialId, createDraftMaterialLayout(materialId, index, zIndex++))
    }
  }
  if (input.stamp) {
    await persistStampForTarget('journal_page', page.id, input.stamp)
  }

  return (await fetchJournalPageById(page.id)) || page
}

export async function updateJournalPage(
  id: string,
  input: Partial<Pick<JournalPage, 'title' | 'description' | 'date_label' | 'background' | 'orientation'>>
): Promise<void> {
  const db = await getDb()
  const sets: string[] = []
  const params: unknown[] = []
  if (input.title !== undefined) { sets.push('title = ?'); params.push(input.title) }
  if (input.description !== undefined) { sets.push('description = ?'); params.push(input.description) }
  if (input.date_label !== undefined) { sets.push('date_label = ?'); params.push(input.date_label) }
  if (input.background !== undefined) { sets.push('background = ?'); params.push(input.background) }
  if (input.orientation !== undefined) { sets.push('orientation = ?'); params.push(input.orientation) }
  sets.push("updated_at = datetime('now', 'localtime')")
  await db.execute(`UPDATE journal_pages SET ${sets.join(', ')} WHERE id = ?`, [...params, id])
}

export async function collectPostcardIntoBook(pageId: string, bookId: string): Promise<void> {
  const db = await getDb()
  const rows = await db.select<{ next_index: number }[]>(
    'SELECT COALESCE(MAX(page_index), -1) + 1 as next_index FROM journal_pages WHERE book_id = ? AND standalone = 0',
    [bookId]
  )
  await db.execute(
    `UPDATE journal_pages
     SET book_id = ?, standalone = 0, page_index = ?, updated_at = datetime('now', 'localtime')
     WHERE id = ?`,
    [bookId, rows[0]?.next_index ?? 0, pageId]
  )
}

export async function detachPageToPostcard(pageId: string, oshiId: string): Promise<void> {
  const db = await getDb()
  await db.execute(
    `UPDATE journal_pages
     SET book_id = NULL,
         oshi_id = ?,
         page_type = 'postcard',
         standalone = 1,
         page_index = 0,
         updated_at = datetime('now', 'localtime')
     WHERE id = ?`,
    [oshiId, pageId]
  )
}

export async function deleteJournalPage(id: string): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM journal_items WHERE page_id = ?', [id])
  await db.execute('DELETE FROM journal_pages WHERE id = ?', [id])
  await deleteStampForTarget('journal_page', id)
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
       n.source_url as note_source_url,
       n.tags as note_tags,
       n.favorite as note_favorite,
       n.created_at as note_created_at,
       n.updated_at as note_updated_at,
       i.oshi_id as illustration_oshi_id,
       i.category as illustration_category,
       i.title as illustration_title,
       i.original_path as illustration_original_path,
       i.thumbnail_path as illustration_thumbnail_path,
       i.original_filename as illustration_original_filename,
       i.mime_type as illustration_mime_type,
       i.file_size as illustration_file_size,
       i.width as illustration_width,
       i.height as illustration_height,
       i.date as illustration_date,
       i.owner as illustration_owner,
       i.artist as illustration_artist,
       i.source_url as illustration_source_url,
       i.tags as illustration_tags,
       i.description as illustration_description,
       i.favorite as illustration_favorite,
       i.archived as illustration_archived,
       i.created_at as illustration_created_at,
       i.updated_at as illustration_updated_at
     FROM journal_items ji
     LEFT JOIN notes n ON n.id = ji.note_id
     LEFT JOIN illustrations i ON i.id = ji.illustration_id
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

export async function createJournalItemForNote(pageId: string, noteId: string, initialLayout?: JournalLayoutUpdate): Promise<JournalItem> {
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
  const baseLayout = createInitialLayout(rows[0]?.count || 0)
  const layout = initialLayout ? { ...baseLayout, ...initialLayout } : baseLayout
  const id = generateId()
  await db.execute(
    `INSERT INTO journal_items
     (id, page_id, note_id, item_type, x, y, width, height, rotation, z_index, sticker_style, color, material_snapshot, style_payload)
     VALUES (?, ?, ?, 'note', ?, ?, ?, ?, ?, ?, ?, ?, '{}', '{}')`,
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

export async function createJournalItemForIllustration(pageId: string, illustrationId: string, initialLayout?: JournalLayoutUpdate): Promise<JournalItem> {
  const db = await getDb()
  const existing = await db.select<JournalItemRow[]>(
    'SELECT * FROM journal_items WHERE page_id = ? AND illustration_id = ?',
    [pageId, illustrationId]
  )
  if (existing[0]) return deserializeItem(existing[0])

  const rows = await db.select<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM journal_items WHERE page_id = ?',
    [pageId]
  )
  const baseLayout = createInitialLayout(rows[0]?.count || 0)
  const layout = initialLayout ? { ...baseLayout, ...initialLayout } : baseLayout
  const id = generateId()
  await db.execute(
    `INSERT INTO journal_items
     (id, page_id, illustration_id, item_type, x, y, width, height, rotation, z_index, sticker_style, color, material_snapshot, style_payload)
     VALUES (?, ?, ?, 'illustration', ?, ?, ?, ?, ?, ?, 'memo', ?, '{}', '{}')`,
    [
      id,
      pageId,
      illustrationId,
      layout.x,
      layout.y,
      Math.max(260, layout.width),
      Math.max(220, layout.height),
      layout.rotation,
      layout.z_index,
      '#eef6ff',
    ]
  )
  return (await fetchJournalItemById(id))!
}

export async function createJournalItemForMaterial(pageId: string, materialId: string, initialLayout?: JournalLayoutUpdate, stylePayloadOverride?: string): Promise<JournalItem> {
  const material = getJournalMaterialDefinition(materialId)
  if (!material) throw new Error(`Unknown journal material: ${materialId}`)

  const db = await getDb()
  const rows = await db.select<{ count: number; max_z: number | null }[]>(
    'SELECT COUNT(*) as count, MAX(z_index) as max_z FROM journal_items WHERE page_id = ?',
    [pageId]
  )
  const count = rows[0]?.count || 0
  const layout = {
    x: 130 + (count % 5) * 34,
    y: 150 + (count % 6) * 28,
    width: material.defaultWidth,
    height: material.defaultHeight,
    rotation: material.defaultRotation,
    z_index: (rows[0]?.max_z ?? count) + 1,
    ...initialLayout,
  }
  const stylePayload = stylePayloadOverride || JSON.stringify(material.defaultStyle)
  const styleColor = getStylePayloadColor(stylePayload) || (typeof material.defaultStyle.color === 'string' ? material.defaultStyle.color : null)
  const id = generateId()

  await db.execute(
    `INSERT INTO journal_items
     (id, page_id, item_type, x, y, width, height, rotation, z_index, sticker_style, color, border_style, material_id, material_snapshot, style_payload)
     VALUES (?, ?, 'material', ?, ?, ?, ?, ?, ?, 'sticky', ?, NULL, ?, ?, ?)`,
    [
      id,
      pageId,
      layout.x,
      layout.y,
      layout.width,
      layout.height,
      layout.rotation,
      layout.z_index,
      styleColor,
      material.id,
      getMaterialSnapshot(material),
      stylePayload,
    ]
  )
  return (await fetchJournalItemById(id))!
}

export async function createJournalItemForTape(pageId: string): Promise<JournalItem> {
  const db = await getDb()
  const rows = await db.select<{ count: number; max_z: number | null }[]>(
    'SELECT COUNT(*) as count, MAX(z_index) as max_z FROM journal_items WHERE page_id = ?',
    [pageId]
  )
  const count = rows[0]?.count || 0
  const id = generateId()
  const x = 120 + (count % 4) * 36
  const y = 150 + (count % 5) * 30
  const zIndex = (rows[0]?.max_z ?? count) + 1
  await db.execute(
    `INSERT INTO journal_items
     (id, page_id, item_type, x, y, width, height, rotation, z_index, sticker_style, color, border_style, material_snapshot, style_payload)
     VALUES (?, ?, 'tape', ?, ?, 260, 42, -6, ?, 'washi', ?, 'soft', '{}', '{}')`,
    [id, pageId, x, y, zIndex, '#d9c4ff']
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

export async function fetchUnplacedIllustrations(pageId: string, oshiId: string): Promise<Illustration[]> {
  const db = await getDb()
  const rows = await db.select<IllustrationRow[]>(
    `SELECT i.* FROM illustrations i
     WHERE i.archived = 0
       AND (i.oshi_id = ? OR i.oshi_id IS NULL)
       AND NOT EXISTS (
         SELECT 1 FROM journal_items ji
         WHERE ji.page_id = ? AND ji.illustration_id = i.id
       )
     ORDER BY COALESCE(i.date, i.created_at) DESC, i.created_at DESC`,
    [oshiId, pageId]
  )
  return rows.map(deserializeIllustration)
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
  if (input.style_payload !== undefined) { sets.push('style_payload = ?'); params.push(input.style_payload) }
  sets.push("updated_at = datetime('now', 'localtime')")
  await db.execute(`UPDATE journal_items SET ${sets.join(', ')} WHERE id = ?`, [...params, id])
}

export async function removeJournalItem(id: string): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM journal_items WHERE id = ?', [id])
}

export async function fetchJournalPageById(id: string): Promise<JournalPage | null> {
  const db = await getDb()
  const rows = await db.select<JournalPageRow[]>('SELECT * FROM journal_pages WHERE id = ?', [id])
  return rows[0] ? deserializePage(rows[0]) : null
}

export async function fetchJournalBookById(id: string): Promise<JournalBook | null> {
  const db = await getDb()
  const rows = await db.select<JournalBook[]>(
    `SELECT jb.*, COUNT(jp.id) as page_count
     FROM journal_books jb
     LEFT JOIN journal_pages jp ON jp.book_id = jb.id AND jp.standalone = 0
     WHERE jb.id = ?
     GROUP BY jb.id`,
    [id]
  )
  return rows[0] ? deserializeBook(rows[0]) : null
}

function deserializePage(row: JournalPageRow): JournalPage {
  return {
    ...row,
    page_type: isPageType(row.page_type) ? row.page_type : 'book_page',
    standalone: row.standalone === 1,
    description: row.description || '',
    date_label: row.date_label || '',
    orientation: row.orientation === 'landscape' ? 'landscape' : 'portrait',
  }
}

async function fetchJournalItemById(id: string): Promise<JournalItem | null> {
  const db = await getDb()
  const rows = await db.select<JournalItemRow[]>('SELECT * FROM journal_items WHERE id = ?', [id])
  return rows[0] ? deserializeItem(rows[0]) : null
}

async function fetchJournalItemNoteIds(pageId: string): Promise<Set<string>> {
  const db = await getDb()
  const rows = await db.select<{ note_id: string }[]>(
    'SELECT note_id FROM journal_items WHERE page_id = ? AND note_id IS NOT NULL',
    [pageId]
  )
  return new Set(rows.map((row) => row.note_id))
}

function deserializeJoinedItem(row: JoinedJournalItemRow): JournalItemWithNote {
  return {
    ...deserializeItem(row),
    note: row.note_id && row.note_title !== null ? deserializeNote({
      id: row.note_id,
      oshi_id: row.note_oshi_id,
      archive_id: row.note_archive_id,
      title: row.note_title || '',
      content: row.note_content || '{}',
      plain_text: row.note_plain_text || '',
      source_url: row.note_source_url || '',
      tags: row.note_tags || '[]',
      favorite: row.note_favorite || 0,
      created_at: row.note_created_at || '',
      updated_at: row.note_updated_at || '',
    }) : null,
    illustration: row.illustration_id && row.illustration_title !== null ? deserializeIllustration({
      id: row.illustration_id,
      oshi_id: row.illustration_oshi_id,
      category: row.illustration_category || 'official',
      title: row.illustration_title || '',
      original_path: row.illustration_original_path || '',
      thumbnail_path: row.illustration_thumbnail_path,
      original_filename: row.illustration_original_filename || '',
      mime_type: row.illustration_mime_type || '',
      file_size: row.illustration_file_size || 0,
      width: row.illustration_width,
      height: row.illustration_height,
      date: row.illustration_date,
      owner: row.illustration_owner || '',
      artist: row.illustration_artist || '',
      source_url: row.illustration_source_url || '',
      tags: row.illustration_tags || '[]',
      description: row.illustration_description || '',
      favorite: row.illustration_favorite || 0,
      archived: row.illustration_archived || 0,
      created_at: row.illustration_created_at || '',
      updated_at: row.illustration_updated_at || '',
    }) : null,
  }
}

function deserializeItem(row: JournalItemRow): JournalItem {
  const itemType = isJournalItemType(row.item_type) ? row.item_type : 'note'
  return {
    ...row,
    item_type: itemType,
    sticker_style: normalizeJournalItemStyle(itemType, row.sticker_style),
    material_id: row.material_id || null,
    material_snapshot: row.material_snapshot || '{}',
    style_payload: row.style_payload || '{}',
  }
}

function deserializeNote(row: NoteRow): Note {
  return {
    ...row,
    tags: JSON.parse(row.tags || '[]'),
    favorite: row.favorite === 1,
  }
}

function deserializeIllustration(row: IllustrationRow): Illustration {
  return {
    ...row,
    category: row.category === 'fanart' ? 'fanart' : 'official',
    tags: parseJsonStringArray(row.tags),
    favorite: row.favorite === 1,
    archived: row.archived === 1,
  }
}

function parseJsonStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function deserializeBook(row: JournalBook): JournalBook {
  return {
    ...row,
    cover_style: isCoverStyle(row.cover_style) ? row.cover_style : 'cloth',
    cover_decoration: isCoverDecoration(row.cover_decoration) ? row.cover_decoration : 'none',
    date_label: row.date_label || '',
  }
}

function isStickerStyle(value: string): value is JournalStickerStyle {
  return value === 'sticky' || value === 'memo' || value === 'ticket'
}

function isTapeStyle(value: string): value is JournalTapeStyle {
  return value === 'washi' || value === 'grid' || value === 'dots' || value === 'stripe' || value === 'torn'
}

function isJournalItemType(value: string): value is JournalItemType {
  return value === 'note' || value === 'illustration' || value === 'tape' || value === 'material' || value === 'memo'
}

function normalizeJournalItemStyle(itemType: JournalItemType, value: string): JournalItemStyle {
  if (itemType === 'tape') return isTapeStyle(value) ? value : 'washi'
  if (itemType === 'material') return isTapeStyle(value) ? value : isStickerStyle(value) ? value : 'sticky'
  return isStickerStyle(value) ? value : 'sticky'
}

function draftItemToLayout(item: JournalDraftItem): JournalLayoutUpdate {
  return {
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    rotation: item.rotation,
    z_index: item.zIndex,
  }
}

function getStylePayloadColor(stylePayload: string): string | null {
  try {
    const parsed = JSON.parse(stylePayload)
    return parsed && typeof parsed.color === 'string' ? parsed.color : null
  } catch {
    return null
  }
}

function createDraftNoteLayout(index: number, zIndex: number): JournalLayoutUpdate {
  return {
    x: 88 + (index % 2) * 42,
    y: 172 + index * 34,
    width: 260,
    height: 178,
    rotation: [-3, 2, -1][index % 3],
    z_index: zIndex,
  }
}

function createDraftIllustrationLayout(index: number, zIndex: number): JournalLayoutUpdate {
  return {
    x: 560 - (index % 2) * 38,
    y: 120 + index * 46,
    width: 300,
    height: 230,
    rotation: [2, -2, 3][index % 3],
    z_index: zIndex,
  }
}

function createDraftMaterialLayout(materialId: string, index: number, zIndex: number): JournalLayoutUpdate {
  const material = getJournalMaterialDefinition(materialId)
  const kind = material?.kind || 'sticker'
  if (kind === 'tape') {
    return {
      x: index % 2 === 0 ? 118 : 544,
      y: index % 2 === 0 ? 142 + index * 14 : 104 + index * 16,
      width: material?.defaultWidth || 260,
      height: material?.defaultHeight || 42,
      rotation: material?.defaultRotation ?? -5,
      z_index: zIndex,
    }
  }
  if (kind === 'paper' || kind === 'label') {
    return {
      x: 190 + (index % 3) * 160,
      y: 500 + (index % 2) * 34,
      width: material?.defaultWidth || 160,
      height: material?.defaultHeight || 90,
      rotation: material?.defaultRotation ?? 0,
      z_index: zIndex,
    }
  }
  return {
    x: [72, 842, 760, 458][index % 4],
    y: [110, 156, 492, 96][index % 4],
    width: material?.defaultWidth || 72,
    height: material?.defaultHeight || 72,
    rotation: material?.defaultRotation ?? 0,
    z_index: zIndex,
  }
}

function isPageType(value: string): value is JournalPageType {
  return value === 'book_page' || value === 'postcard'
}

function isCoverStyle(value: string): value is JournalCoverStyle {
  return value === 'classic' ||
    value === 'cloth' ||
    value === 'paper' ||
    value === 'night' ||
    value === 'postcard' ||
    value === 'minimal'
}

function isCoverDecoration(value: string): value is JournalCoverDecoration {
  return value === 'none' ||
    value === 'flower' ||
    value === 'moon' ||
    value === 'heart' ||
    value === 'camera' ||
    value === 'ticket'
}
