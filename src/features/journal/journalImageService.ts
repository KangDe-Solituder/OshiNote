import { isTauri } from '@tauri-apps/api/core'
import { BaseDirectory, exists, mkdir, remove, writeFile } from '@tauri-apps/plugin-fs'
import { getDb, generateId } from '../../database'
import { discardCachedMediaPath } from '../../services/media/illustrationMedia'
import type { JournalImage, JournalImageRow } from '../../types'

const JOURNAL_IMAGE_ROOT = 'media/journal'

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

function deserializeImage(row: JournalImageRow): JournalImage {
  return { ...row, oshi_id: row.oshi_id || null }
}

export async function fetchJournalImages(oshiId?: string): Promise<JournalImage[]> {
  const db = await getDb()
  const rows = oshiId
    ? await db.select<JournalImageRow[]>('SELECT * FROM journal_images WHERE oshi_id = ? OR oshi_id IS NULL ORDER BY created_at DESC', [oshiId])
    : await db.select<JournalImageRow[]>('SELECT * FROM journal_images ORDER BY created_at DESC')
  return rows.map(deserializeImage)
}

export async function getJournalImageById(id: string): Promise<JournalImage | null> {
  const db = await getDb()
  const rows = await db.select<JournalImageRow[]>('SELECT * FROM journal_images WHERE id = ?', [id])
  return rows[0] ? deserializeImage(rows[0]) : null
}

/** Copy a picked local image into the managed journal library (AppData) and register it. */
export async function storeJournalImage(file: File, oshiId: string | null): Promise<JournalImage> {
  const error = validateJournalImageFile(file)
  if (error) throw new Error(error)
  if (!isTauri()) throw new Error('Importing journal images requires the desktop app')

  const db = await getDb()
  const id = generateId()
  const ext = EXTENSION_BY_MIME[file.type] || 'png'
  const filePath = `${JOURNAL_IMAGE_ROOT}/${id}.${ext}`
  if (!(await exists(JOURNAL_IMAGE_ROOT, { baseDir: BaseDirectory.AppData }))) {
    await mkdir(JOURNAL_IMAGE_ROOT, { baseDir: BaseDirectory.AppData, recursive: true })
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  await writeFile(filePath, bytes, { baseDir: BaseDirectory.AppData })
  const dimensions = await readImageDimensions(file)

  try {
    await db.execute(
      `INSERT INTO journal_images (id, oshi_id, file_path, original_filename, mime_type, file_size, width, height)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, oshiId, filePath, file.name, file.type || 'image/png', file.size, dimensions.width, dimensions.height]
    )
  } catch (error) {
    try {
      await remove(filePath, { baseDir: BaseDirectory.AppData })
    } catch {
      // Preserve the database error; orphan cleanup can handle a failed compensating delete.
    }
    throw error
  }
  return (await getJournalImageById(id))!
}

/** Remove a library image, any journal items referencing it, and the backing file. */
export async function deleteJournalImage(id: string): Promise<void> {
  const db = await getDb()
  const rows = await db.select<JournalImageRow[]>('SELECT * FROM journal_images WHERE id = ?', [id])
  const image = rows[0] ? deserializeImage(rows[0]) : null
  await db.execute('DELETE FROM journal_items WHERE journal_image_id = ?', [id])
  await db.execute('DELETE FROM journal_images WHERE id = ?', [id])
  if (!image) return
  discardCachedMediaPath(image.file_path)
  try {
    if (await exists(image.file_path, { baseDir: BaseDirectory.AppData })) {
      await remove(image.file_path, { baseDir: BaseDirectory.AppData })
    }
  } catch {
    // A missing file is fine — the row is already gone.
  }
}

export function validateJournalImageFile(file: File): string | null {
  if (!EXTENSION_BY_MIME[file.type]) return 'Only JPEG, PNG, WebP, and GIF images are supported.'
  if (file.size > 20 * 1024 * 1024) return 'Journal images must be 20 MB or smaller.'
  return null
}

function readImageDimensions(file: File): Promise<{ width: number | null; height: number | null }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: image.naturalWidth || null, height: image.naturalHeight || null })
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      resolve({ width: null, height: null })
    }
    image.src = url
  })
}
