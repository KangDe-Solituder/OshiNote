import type Database from '@tauri-apps/plugin-sql'
import { getDb } from '../../database'
import { JOURNAL_MATERIALS, getMaterialSnapshot } from '../journal/journalMaterials'
import { isRecord, safeJsonParse } from '../../utils/safeJson'
import { sha256Text } from '../../services/sync/syncModel'
import { sha256Bytes } from '../../services/sync/syncModel'
import { isTauri } from '@tauri-apps/api/core'
import { BaseDirectory, exists, readFile } from '@tauri-apps/plugin-fs'

export interface ResourceVersion {
  id: string; asset_id: string; renderer: string; payload: string
  file_path: string | null; content_hash: string | null
}
export interface ResourceUsage { id: string; title: string; type: 'page' | 'template' }

function assertSameVersion(stored: ResourceVersion, version: ResourceVersion) {
  for (const key of ['asset_id', 'renderer', 'payload', 'file_path', 'content_hash'] as const) {
    if (stored[key] !== version[key]) throw new Error(`Resource version collision: ${version.id}`)
  }
}

export async function registerVersion(db: Database, version: ResourceVersion, name: string, kind: string, source: string) {
  await db.execute(`INSERT OR IGNORE INTO resource_assets (id, kind, name, source, current_version_id) VALUES (?, ?, ?, ?, ?)`,
    [version.asset_id, kind, name, source, version.id])
  const existing = await db.select<ResourceVersion[]>('SELECT * FROM resource_versions WHERE id = ?', [version.id])
  if (existing[0]) {
    if (JSON.stringify(existing[0]) === JSON.stringify(version)) return
    for (const key of ['asset_id', 'renderer', 'payload', 'file_path', 'content_hash'] as const) {
      if (existing[0][key] !== version[key]) throw new Error(`Resource version collision: ${version.id}`)
    }
    return
  }
  await db.execute(`INSERT OR IGNORE INTO resource_versions (id, asset_id, renderer, payload, file_path, content_hash) VALUES (?, ?, ?, ?, ?, ?)`,
    [version.id, version.asset_id, version.renderer, version.payload, version.file_path, version.content_hash])
  // Reconciliation can be requested by both a picker and a sync/backup operation.
  // A concurrent insert is idempotent only if its immutable definition is identical.
  const [stored] = await db.select<ResourceVersion[]>('SELECT * FROM resource_versions WHERE id = ?', [version.id])
  for (const key of ['asset_id', 'renderer', 'payload', 'file_path', 'content_hash'] as const) {
    if (!stored || stored[key] !== version[key]) throw new Error(`Resource version collision: ${version.id}`)
  }
}

/** Idempotent migration, also run before sync/backup to capture newly placed resources. */
export async function reconcileResourceLibrary(db: Database) {
  // Read immutable definitions together instead of issuing an INSERT + SELECT
  // for every built-in on every startup. Missing versions still use the
  // concurrency-safe registration path; existing definitions are still checked.
  const versions = new Map((await db.select<ResourceVersion[]>(
    "SELECT * FROM resource_versions WHERE id LIKE 'builtin:%' OR id LIKE 'upload:%'"
  )).map(version => [version.id, version]))
  for (const material of JOURNAL_MATERIALS) {
    const payload = getMaterialSnapshot(material)
    const version = { id: `builtin:${material.id}:1`, asset_id: `builtin:${material.id}`, renderer: 'builtin-v1', payload, file_path: null, content_hash: null }
    const stored = versions.get(version.id)
    if (stored) assertSameVersion(stored, version)
    else await registerVersion(db, version, material.nameKey, material.kind, 'builtin')
  }
  const items = await db.select<{ id: string; material_id: string | null; material_snapshot: string }[]>(
    "SELECT id, material_id, material_snapshot FROM journal_items WHERE item_type IN ('material', 'tape')")
  for (const item of items) {
    const old = safeJsonParse<Record<string, unknown>>(item.material_snapshot, {}, isRecord)
    if (typeof old.resourceVersionId === 'string') continue
    const material = JOURNAL_MATERIALS.find(value => value.id === (item.material_id || old.id))
    if (!material) continue // Unknown legacy content is preserved, never replaced with a different sticker.
    const snapshot = { ...JSON.parse(getMaterialSnapshot(material)), ...old, rendererVersion: 1 }
    delete snapshot.resourceVersionId
    const id = `legacy:${await sha256Text(JSON.stringify(snapshot))}`
    snapshot.resourceVersionId = id
    const payload = JSON.stringify(snapshot)
    await registerVersion(db, { id, asset_id: `builtin:${material.id}`, renderer: 'builtin-v1', payload, file_path: null, content_hash: null }, material.nameKey, material.kind, 'builtin')
    await db.execute('UPDATE journal_items SET material_snapshot = ? WHERE id = ?', [payload, item.id])
  }
  const images = await db.select<{ id: string; file_path: string; original_filename: string; archived: number; asset_archived: number | null }[]>(
    "SELECT i.id, i.file_path, i.original_filename, i.archived, a.archived AS asset_archived FROM journal_images i LEFT JOIN resource_assets a ON a.id = 'upload:' || i.id")
  for (const image of images) {
    const previous = versions.get(`upload:${image.id}:1`)
    let contentHash = previous?.content_hash || null
    if (!previous && isTauri() && await exists(image.file_path, { baseDir: BaseDirectory.AppData })) {
      contentHash = await sha256Bytes(new Uint8Array(await readFile(image.file_path, { baseDir: BaseDirectory.AppData })))
    }
    const version = { id: `upload:${image.id}:1`, asset_id: `upload:${image.id}`, renderer: 'image-v1',
      payload: JSON.stringify({ journalImageId: image.id }), file_path: image.file_path, content_hash: contentHash }
    if (previous) assertSameVersion(previous, version)
    else await registerVersion(db, version, image.original_filename, 'image', 'upload')
    if (image.asset_archived !== image.archived) {
      await db.execute('UPDATE resource_assets SET archived = ? WHERE id = ?', [image.archived, `upload:${image.id}`])
    }
  }
  const templates = await db.select<{ id: string; payload: string }[]>("SELECT id, payload FROM templates WHERE type = 'journal_page'")
  for (const template of templates) {
    const data = safeJsonParse<Record<string, unknown>>(template.payload, {}, isRecord)
    if (Array.isArray(data.resourceDependencies)) continue
    const freezeDecorations = (value: unknown): void => {
      if (Array.isArray(value)) { value.forEach(freezeDecorations); return }
      if (!isRecord(value)) return
      const material = JOURNAL_MATERIALS.find(item => item.id === value.materialId)
      if (material && !value.materialSnapshot) value.materialSnapshot = getMaterialSnapshot(material)
      Object.values(value).forEach(freezeDecorations)
    }
    freezeDecorations(data)
    const dependencies = JOURNAL_MATERIALS.filter(material => referencesMaterial(data, material.id))
      .map(material => `builtin:${material.id}:1`)
    await db.execute('UPDATE templates SET payload = ? WHERE id = ?', [JSON.stringify({ ...data, resourceDependencies: dependencies }), template.id])
  }
}

export function referencesMaterial(value: unknown, id: string): boolean {
  if (Array.isArray(value)) return value.some(child => referencesMaterial(child, id))
  if (!isRecord(value)) return false
  return value.materialId === id || value.material_id === id || Object.values(value).some(child => referencesMaterial(child, id))
}

export async function findResourceUsage(kind: 'material' | 'upload', id: string): Promise<ResourceUsage[]> {
  const db = await getDb()
  const column = kind === 'material' ? 'material_id' : 'journal_image_id'
  const pages = await db.select<{ id: string; title: string }[]>(`SELECT DISTINCT p.id, p.title FROM journal_pages p JOIN journal_items i ON i.page_id = p.id WHERE i.${column} = ?`, [id])
  const result: ResourceUsage[] = pages.map(page => ({ ...page, type: 'page' }))
  if (kind === 'material') {
    const templates = await db.select<{ id: string; name: string; payload: string }[]>('SELECT id, name, payload FROM templates WHERE deleted = 0')
    for (const template of templates) {
      if (referencesMaterial(safeJsonParse(template.payload, {}, isRecord), id)) result.push({ id: template.id, title: template.name, type: 'template' })
    }
  }
  return result
}
