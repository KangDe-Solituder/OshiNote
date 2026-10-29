import { withResourceFiles } from './resourceFileLock'
import type Database from '@tauri-apps/plugin-sql'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { BaseDirectory, mkdir, writeFile } from '@tauri-apps/plugin-fs'
import { generateId, getDb } from '../../database'
import type { JournalMaterialKind } from '../../types'
import { JOURNAL_MATERIALS, getMaterialSnapshot, registerLibraryMaterials, resolveMaterialSnapshot, type JournalMaterialDefinition } from '../journal/journalMaterials'
import { sha256Bytes } from '../../services/sync/syncModel'
import { validateJournalImageFile } from '../journal/journalImageService'
import { isRecord, safeJsonParse } from '../../utils/safeJson'
import type { ResourceVersion } from './resourceLibrary'

export interface ResourceAsset {
  id: string; kind: string; name: string; source: string; current_version_id: string; metadata: string; archived: number
}
export interface LibraryMaterial extends JournalMaterialDefinition { assetId: string; archived: boolean; favorite: boolean; source: string }
export interface ResourceStatement { query: string; values: unknown[] }
export async function commitResources(statements: ResourceStatement[]) {
  await getDb()
  await invoke('execute_sync_transaction', { statements })
}
export function notifyResourcesChanged() { window.dispatchEvent(new Event('resources-changed')) }
export async function loadMaterialLibrary(database?: Database): Promise<LibraryMaterial[]> {
  const db = database || await getDb()
  const rows = await db.select<(ResourceAsset & { payload: string; file_path: string | null })[]>(
    "SELECT a.*, v.payload, v.file_path FROM resource_assets a JOIN resource_versions v ON v.id = a.current_version_id WHERE a.kind IN ('sticker','tape','paper','label') ORDER BY a.source, a.name")
  const materials = rows.flatMap(row => {
    const definition = resolveMaterialSnapshot(row.payload)
    if (!definition) return []
    const metadata = safeJsonParse<Record<string, unknown>>(row.metadata, {}, isRecord)
    if (metadata.deleted === true) return []
    const builtin = JOURNAL_MATERIALS.find(item => `builtin:${item.id}` === row.id)
    return [{ ...definition, kind: row.kind as JournalMaterialKind,
      displayName: builtin?.nameKey === row.name ? undefined : row.name,
      imagePath: row.file_path || undefined, resourceVersionId: row.current_version_id,
      group: ['live','nature','cosmos','misc'].includes(String(metadata.group)) ? metadata.group as JournalMaterialDefinition['group'] : definition.group,
      assetId: row.id, archived: Boolean(row.archived), favorite: metadata.favorite === true, source: row.source }]
  })
  registerLibraryMaterials(materials)
  return materials.sort((a,b) => Number(b.favorite) - Number(a.favorite)
    || Number(b.source === 'import') - Number(a.source === 'import')
    || (a.source === 'builtin' && b.source === 'builtin' ? JOURNAL_MATERIALS.findIndex(item => item.id === a.id) - JOURNAL_MATERIALS.findIndex(item => item.id === b.id) : 0))
}
export async function updateResource(assetId: string, changes: { name?: string; archived?: boolean; favorite?: boolean; kind?: JournalMaterialKind; group?: string }) {
  const db = await getDb()
  const [asset] = await db.select<ResourceAsset[]>('SELECT * FROM resource_assets WHERE id = ?', [assetId])
  if (!asset) throw new Error('Resource not found')
  const name = changes.name === undefined ? asset.name : changes.name.trim()
  if (!name || name.length > 160) throw new Error('Name must contain 1–160 characters')
  const metadata = safeJsonParse<Record<string, unknown>>(asset.metadata, {}, isRecord)
  if (changes.favorite !== undefined) metadata.favorite = changes.favorite
  if (changes.group !== undefined) metadata.group = changes.group
  const statements: ResourceStatement[] = [{ query: 'UPDATE resource_assets SET name = ?, kind = ?, metadata = ?, archived = ? WHERE id = ?', values: [name, changes.kind || asset.kind, JSON.stringify(metadata), changes.archived === undefined ? asset.archived : Number(changes.archived), assetId] }]
  if (asset.source === 'upload') statements.push({ query: 'UPDATE journal_images SET original_filename = ?, archived = ? WHERE id = ?', values: [name, changes.archived === undefined ? asset.archived : Number(changes.archived), assetId.slice(7)] })
  await commitResources(statements)
  await loadMaterialLibrary(db)
  notifyResourcesChanged()
}
/** Remove a material from the library without invalidating placed or synced versions. */
export async function deleteMaterial(assetId: string) {
  const db = await getDb()
  const [asset] = await db.select<ResourceAsset[]>('SELECT * FROM resource_assets WHERE id = ?', [assetId])
  if (!asset || !['sticker', 'tape', 'paper', 'label'].includes(asset.kind)) throw new Error('Material not found')
  const metadata = safeJsonParse<Record<string, unknown>>(asset.metadata, {}, isRecord)
  metadata.deleted = true
  // The marker travels with resource metadata in sync/backups; archived also hides it from older pickers.
  await commitResources([{ query: 'UPDATE resource_assets SET metadata = ?, archived = 1 WHERE id = ?', values: [JSON.stringify(metadata), assetId] }])
  await loadMaterialLibrary(db)
  notifyResourcesChanged()
}

export async function decodeMaterialFile(file: File) {
  const error = validateJournalImageFile(file)
  if (error) throw new Error(error)
  const bytes = new Uint8Array(await file.arrayBuffer())
  const bitmap = await createImageBitmap(new Blob([bytes], { type: file.type }))
  const { width, height } = bitmap
  bitmap.close()
  if (!width || !height || width * height > 64_000_000) throw new Error('Image dimensions exceed the limit')
  return { bytes, width, height }
}
async function importMaterialUnlocked(file: File, kind: JournalMaterialKind, replaceAssetId?: string) {
  if (!isTauri()) throw new Error('Import requires the desktop app')
  const db = await getDb()
  const { bytes, width, height } = await decodeMaterialFile(file)
  const [existing] = replaceAssetId ? await db.select<ResourceAsset[]>('SELECT * FROM resource_assets WHERE id = ?', [replaceAssetId]) : []
  if (replaceAssetId && (!existing || existing.source !== 'import')) throw new Error('Only imported materials can be replaced')
  const id = existing?.id || `material:${generateId()}`
  const versionId = `material-version:${generateId()}`
  const ext = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' })[file.type]!
  const filePath = `media/resources/${generateId()}.${ext}`
  const name = existing?.name || file.name.replace(/\.[^.]+$/, '').slice(0,160) || 'Material'
  const scale = (kind === 'paper' ? 220 : kind === 'tape' ? 260 : 120) / Math.max(width, height)
  const definition: JournalMaterialDefinition = { id, displayName: name, resourceVersionId: versionId, imagePath: filePath, kind,
    nameKey: 'journalInspector.selectedMaterial', categoryKey: `journalMaterials.category.${kind}`, group: 'misc',
    defaultWidth: Math.max(8, Math.round(width * scale)), defaultHeight: Math.max(8, Math.round(height * scale)), defaultRotation: 0, defaultStyle: {} }
  const version: ResourceVersion = { id: versionId, asset_id: id, renderer: 'material-image-v1', payload: getMaterialSnapshot(definition), file_path: filePath, content_hash: await sha256Bytes(bytes) }
  await mkdir('media/resources', { baseDir: BaseDirectory.AppData, recursive: true })
  await writeFile(filePath, bytes, { baseDir: BaseDirectory.AppData })
  // Files are published before the transaction. Failed imports leave only an unreferenced file for cleanup.
  await commitResources([
    { query: "INSERT OR IGNORE INTO resource_assets (id,kind,name,source,current_version_id,metadata) VALUES (?,?,?,'import',?,?)", values: [id, kind, name, versionId, JSON.stringify({ importedAt: new Date().toISOString() })] },
    { query: 'INSERT INTO resource_versions (id,asset_id,renderer,payload,file_path,content_hash) VALUES (?,?,?,?,?,?)', values: [version.id, id, version.renderer, version.payload, filePath, version.content_hash] },
    { query: 'UPDATE resource_assets SET current_version_id = ?, kind = ?, archived = 0 WHERE id = ?', values: [versionId, kind, id] },
  ])
  await loadMaterialLibrary(db)
  notifyResourcesChanged()
  return id
}

/** Turn a reusable material definition into a separately managed library item. */
export async function instantiateMaterialTemplate(raw: string, name: string) {
  const db = await getDb()
  const payload = JSON.parse(raw)
  const original = resolveMaterialSnapshot(payload.materialSnapshot, payload.material_type === 'paper' ? 'memo-cream' : undefined)
  if (!original) throw new Error('Invalid material template')
  const previousId = original.resourceVersionId || `builtin:${original.id}:1`
  const [previous] = await db.select<ResourceVersion[]>('SELECT * FROM resource_versions WHERE id = ?', [previousId])
  if (!previous) throw new Error('Missing material version')
  if (original.imagePath && original.imagePath !== previous.file_path) throw new Error('Material image version mismatch')
  const id = `material:${generateId()}`, versionId = `material-version:${generateId()}`
  const definition = { ...original, id, resourceVersionId: versionId, displayName: name }
  await commitResources([
    { query: "INSERT INTO resource_assets (id,kind,name,source,current_version_id) VALUES (?,?,?,'import',?)", values: [id,definition.kind,name,versionId] },
    { query: 'INSERT INTO resource_versions (id,asset_id,renderer,payload,file_path,content_hash) VALUES (?,?,?,?,?,?)', values: [versionId,id,previous.renderer,getMaterialSnapshot(definition),previous.file_path,previous.content_hash] },
  ])
  await loadMaterialLibrary(db); notifyResourcesChanged()
  return id
}

export function importMaterial(file: File, kind: JournalMaterialKind, replaceAssetId?: string) {
  return withResourceFiles(() => importMaterialUnlocked(file, kind, replaceAssetId))
}
