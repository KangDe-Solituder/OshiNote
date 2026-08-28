import { BaseDirectory, exists, mkdir, readFile, rename, writeFile } from '@tauri-apps/plugin-fs'
import { invoke } from '@tauri-apps/api/core'
import type Database from '@tauri-apps/plugin-sql'
import { getDb } from '../../database'
import {
  canonicalJson,
  sha256Bytes,
  sha256Text,
  type SyncOperation,
  type SyncRecord,
  type SyncSnapshot,
} from './syncModel'

const NOTE_IMAGE_BLOB_PREFIX = 'oshinote-blob-v1:'
const OUTGOING_CACHE = 'sync-cache/outgoing'
const INCOMING_CACHE = 'sync-cache/incoming'

interface TableDefinition {
  name: string
  primaryKey: string
  columns: readonly string[]
}

interface SyncDatabaseStatement {
  query: string
  values: unknown[]
}

const TABLES: readonly TableDefinition[] = [
  { name: 'oshis', primaryKey: 'id', columns: ['id', 'name', 'avatar', 'color', 'description', 'activity_links', 'anniversaries', 'created_at'] },
  { name: 'archives', primaryKey: 'id', columns: ['id', 'oshi_id', 'name', 'sort_order', 'created_at'] },
  { name: 'notes', primaryKey: 'id', columns: ['id', 'oshi_id', 'archive_id', 'title', 'content', 'plain_text', 'source_url', 'tags', 'favorite', 'created_at', 'updated_at'] },
  { name: 'illustrations', primaryKey: 'id', columns: ['id', 'oshi_id', 'category', 'title', 'original_path', 'thumbnail_path', 'original_filename', 'mime_type', 'file_size', 'width', 'height', 'date', 'owner', 'artist', 'source_url', 'tags', 'description', 'favorite', 'archived', 'created_at', 'updated_at'] },
  { name: 'journal_books', primaryKey: 'id', columns: ['id', 'oshi_id', 'title', 'description', 'cover_style', 'cover_color', 'cover_decoration', 'date_label', 'sort_order', 'created_at', 'updated_at'] },
  { name: 'journal_pages', primaryKey: 'id', columns: ['id', 'book_id', 'oshi_id', 'page_type', 'title', 'description', 'date_label', 'standalone', 'page_index', 'background', 'orientation', 'created_at', 'updated_at'] },
  { name: 'note_images', primaryKey: 'id', columns: ['id', 'note_id', 'data_url', 'sort_order', 'created_at'] },
  { name: 'journal_items', primaryKey: 'id', columns: ['id', 'page_id', 'note_id', 'illustration_id', 'journal_image_id', 'item_type', 'x', 'y', 'width', 'height', 'rotation', 'z_index', 'staged', 'sticker_style', 'color', 'border_style', 'material_id', 'material_snapshot', 'style_payload', 'created_at', 'updated_at'] },
  { name: 'journal_images', primaryKey: 'id', columns: ['id', 'oshi_id', 'file_path', 'original_filename', 'mime_type', 'file_size', 'width', 'height', 'created_at'] },
  { name: 'stamps', primaryKey: 'id', columns: ['id', 'target_type', 'target_id', 'template_id', 'template_snapshot', 'label', 'color', 'position', 'x', 'y', 'rotation', 'size', 'opacity', 'created_at', 'updated_at'] },
  { name: 'templates', primaryKey: 'id', columns: ['id', 'type', 'name', 'description', 'source', 'payload', 'hidden', 'deleted', 'created_at', 'updated_at'] },
  { name: 'oshi_schedules', primaryKey: 'id', columns: ['id', 'oshi_id', 'title', 'archive_id', 'kind', 'weekday', 'date', 'time', 'status', 'note_id', 'created_at', 'updated_at'] },
  { name: 'oshi_schedule_overrides', primaryKey: 'id', columns: ['id', 'schedule_id', 'date', 'status', 'note_id', 'created_at'] },
  { name: 'settings', primaryKey: 'key', columns: ['key', 'value'] },
]

const SETTINGS_ALLOWLIST = [
  'theme',
  'glassEnabled',
  'bgFilters',
  'hotkeys',
  'fontSize',
  'uiMotionDuration',
  'textTone',
  'locale',
]

const TABLE_BY_NAME = new Map(TABLES.map((table) => [table.name, table]))
const TABLE_ORDER = new Map(TABLES.map((table, index) => [table.name, index]))

export interface SyncMediaJob {
  logicalPath: string
  localPath: string
  hash: string
}

export interface LocalSyncDataset {
  records: Map<string, SyncRecord>
  snapshot: SyncSnapshot
  mediaJobs: Map<string, SyncMediaJob>
}

export async function buildLocalSyncDataset(): Promise<LocalSyncDataset> {
  const db = await getDb()
  const records = new Map<string, SyncRecord>()
  const mediaJobs = new Map<string, SyncMediaJob>()
  const recordHashes: Record<string, string> = {}
  const mediaHashes: Record<string, string> = {}

  for (const table of TABLES) {
    const rows = table.name === 'settings'
      ? await db.select<Record<string, unknown>[]>(
        `SELECT ${table.columns.join(', ')} FROM settings WHERE key IN (${SETTINGS_ALLOWLIST.map(() => '?').join(', ')}) ORDER BY key`,
        SETTINGS_ALLOWLIST
      )
      : await db.select<Record<string, unknown>[]>(
        `SELECT ${table.columns.join(', ')} FROM ${table.name} ORDER BY ${table.primaryKey}`
      )

    for (const originalRow of rows) {
      const id = String(originalRow[table.primaryKey])
      const key = `${table.name}:${id}`
      const row = { ...originalRow }
      if (table.name === 'note_images' && typeof row.data_url === 'string') {
        const parsed = parseDataUrl(row.data_url)
        if (parsed) {
          const hash = await sha256Bytes(parsed.bytes)
          const localPath = `${OUTGOING_CACHE}/${hash}`
          await ensureCacheFile(localPath, parsed.bytes)
          const logicalPath = `note-images/${id}`
          row.data_url = `${NOTE_IMAGE_BLOB_PREFIX}${parsed.mimeType}:${hash}`
          mediaHashes[logicalPath] = hash
          mediaJobs.set(logicalPath, { logicalPath, localPath, hash })
        }
      }

      const record: SyncRecord = { key, table: table.name, id, value: row }
      records.set(key, record)
      recordHashes[key] = await sha256Text(canonicalJson(record))

      if (table.name === 'illustrations' && typeof row.original_path === 'string' && row.original_path) {
        const localPath = normalizeManagedMediaPath(row.original_path)
        if (!(await exists(localPath, { baseDir: BaseDirectory.AppData }))) {
          throw new Error(`Missing illustration media: ${localPath}`)
        }
        const bytes = new Uint8Array(await readFile(localPath, { baseDir: BaseDirectory.AppData }))
        const hash = await sha256Bytes(bytes)
        mediaHashes[localPath] = hash
        mediaJobs.set(localPath, { logicalPath: localPath, localPath, hash })
      }

      if (table.name === 'journal_images' && typeof row.file_path === 'string' && row.file_path) {
        const localPath = normalizeManagedMediaPath(row.file_path)
        if (!(await exists(localPath, { baseDir: BaseDirectory.AppData }))) {
          throw new Error(`Missing journal image media: ${localPath}`)
        }
        const bytes = new Uint8Array(await readFile(localPath, { baseDir: BaseDirectory.AppData }))
        const hash = await sha256Bytes(bytes)
        mediaHashes[localPath] = hash
        mediaJobs.set(localPath, { logicalPath: localPath, localPath, hash })
      }
    }
  }

  return {
    records,
    snapshot: { record_hashes: recordHashes, media_hashes: mediaHashes },
    mediaJobs,
  }
}

export async function applySyncOperations(operations: SyncOperation[]): Promise<void> {
  if (operations.length === 0) return
  const db = await getDb()
  const supersededMedia = await findSupersededIllustrationMedia(db, operations)
  const deletes = operations
    .filter((operation) => operation.operation === 'delete')
    .sort((left, right) => tableOrder(right.table) - tableOrder(left.table))
  const upserts = operations
    .filter((operation) => operation.operation === 'upsert')
    .sort((left, right) => tableOrder(left.table) - tableOrder(right.table))

  const statements: SyncDatabaseStatement[] = deletes.map(buildDeleteStatement)
  for (const operation of upserts) statements.push(await buildUpsertStatement(operation))

  await invoke('execute_sync_transaction', { statements })
  await quarantineSupersededMedia(supersededMedia)
}

async function findSupersededIllustrationMedia(db: Database, operations: SyncOperation[]): Promise<string[]> {
  const paths = new Set<string>()
  for (const operation of operations) {
    if (operation.table !== 'illustrations' && operation.table !== 'journal_images') continue
    const pathColumn = operation.table === 'illustrations' ? 'original_path' : 'file_path'
    const rows = await db.select<Record<string, string | null>[]>(`SELECT ${pathColumn} AS primary_path FROM ${operation.table} WHERE id = ?`, [operation.id])
    const existing = rows[0]
    if (!existing) continue
    const nextPrimary = operation.operation === 'upsert' && typeof operation.value?.[pathColumn] === 'string'
      ? operation.value[pathColumn] as string
      : null
    const previousPrimary = typeof existing.primary_path === 'string' ? existing.primary_path : null
    if (previousPrimary && previousPrimary !== nextPrimary) paths.add(previousPrimary)
  }
  return Array.from(paths)
}

async function quarantineSupersededMedia(paths: string[]): Promise<void> {
  const batch = `${Date.now()}-${crypto.randomUUID()}`
  for (const value of paths) {
    try {
      const path = normalizeManagedMediaPath(value)
      if (!(await exists(path, { baseDir: BaseDirectory.AppData }))) continue
      const destination = `sync-cache/orphans/${batch}/${path}`
      const parent = destination.slice(0, destination.lastIndexOf('/'))
      if (!(await exists(parent, { baseDir: BaseDirectory.AppData }))) {
        await mkdir(parent, { baseDir: BaseDirectory.AppData, recursive: true })
      }
      await rename(path, destination, {
        oldPathBaseDir: BaseDirectory.AppData,
        newPathBaseDir: BaseDirectory.AppData,
      })
    } catch {
      // A failed quarantine leaves the original file untouched and unreferenced.
    }
  }
}

export function noteImageBlobFromOperation(operation: SyncOperation): { hash: string; mimeType: string } | null {
  if (operation.table !== 'note_images' || operation.operation !== 'upsert') return null
  const value = operation.value?.data_url
  if (typeof value !== 'string' || !value.startsWith(NOTE_IMAGE_BLOB_PREFIX)) return null
  const marker = value.slice(NOTE_IMAGE_BLOB_PREFIX.length)
  const separator = marker.lastIndexOf(':')
  if (separator <= 0) return null
  return { mimeType: marker.slice(0, separator), hash: marker.slice(separator + 1) }
}

export function incomingBlobCachePath(hash: string): string {
  return `${INCOMING_CACHE}/${hash}`
}

async function buildUpsertStatement(operation: SyncOperation): Promise<SyncDatabaseStatement> {
  const table = TABLE_BY_NAME.get(operation.table)
  if (!table || !operation.value) throw new Error(`Unsupported sync table: ${operation.table}`)
  const value = { ...operation.value }
  if (table.name === 'note_images' && typeof value.data_url === 'string') {
    const blob = noteImageBlobFromOperation(operation)
    if (blob) {
      const path = incomingBlobCachePath(blob.hash)
      const bytes = new Uint8Array(await readFile(path, { baseDir: BaseDirectory.AppData }))
      const actualHash = await sha256Bytes(bytes)
      if (actualHash !== blob.hash) throw new Error(`Downloaded note image failed verification: ${blob.hash}`)
      value.data_url = bytesToDataUrl(bytes, blob.mimeType)
    }
  }

  const bindings = table.columns.map((column) => value[column] ?? null)
  const updates = table.columns
    .filter((column) => column !== table.primaryKey)
    .map((column) => `${column} = excluded.${column}`)
    .join(', ')
  const placeholders = table.columns.map(() => '?').join(', ')
  return {
    query: `INSERT INTO ${table.name} (${table.columns.join(', ')}) VALUES (${placeholders})
      ON CONFLICT(${table.primaryKey}) DO UPDATE SET ${updates}`,
    values: bindings,
  }
}

function buildDeleteStatement(operation: SyncOperation): SyncDatabaseStatement {
  const table = TABLE_BY_NAME.get(operation.table)
  if (!table) throw new Error(`Unsupported sync table: ${operation.table}`)
  return {
    query: `DELETE FROM ${table.name} WHERE ${table.primaryKey} = ?`,
    values: [operation.id],
  }
}

function tableOrder(table: string): number {
  return TABLE_ORDER.get(table) ?? Number.MAX_SAFE_INTEGER
}

async function ensureCacheFile(path: string, bytes: Uint8Array): Promise<void> {
  if (await exists(path, { baseDir: BaseDirectory.AppData })) return
  const directory = path.slice(0, path.lastIndexOf('/'))
  if (!(await exists(directory, { baseDir: BaseDirectory.AppData }))) {
    await mkdir(directory, { baseDir: BaseDirectory.AppData, recursive: true })
  }
  await writeFile(path, bytes, { baseDir: BaseDirectory.AppData })
}

function parseDataUrl(value: string): { mimeType: string; bytes: Uint8Array } | null {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(value)
  if (!match) return null
  const binary = atob(match[2])
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return { mimeType: match[1], bytes }
}

function bytesToDataUrl(bytes: Uint8Array, mimeType: string): string {
  const chunks: string[] = []
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + chunkSize)))
  }
  return `data:${mimeType};base64,${btoa(chunks.join(''))}`
}

function normalizeManagedMediaPath(value: string): string {
  const normalized = value.replace(/\\/g, '/')
  const managed = normalized.startsWith('media/illustrations/') || normalized.startsWith('media/journal/')
  if (!managed || normalized.includes('../') || normalized.includes(':')) {
    throw new Error(`Invalid managed media path: ${value}`)
  }
  return normalized
}
