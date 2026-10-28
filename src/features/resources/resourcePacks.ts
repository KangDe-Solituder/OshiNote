import { withResourceFiles } from './resourceFileLock'
import { BaseDirectory, exists, mkdir, readFile, writeFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { save } from '@tauri-apps/plugin-dialog'
import { generateId, getDb } from '../../database'
import type { ResourceTemplate } from '../../types'
import type { ResourceVersion } from './resourceLibrary'
import { reconcileResourceLibrary } from './resourceLibrary'
import { commitResources, decodeMaterialFile, loadMaterialLibrary, notifyResourcesChanged, type ResourceAsset, type ResourceStatement } from './resourceManagement'
import { resourceDependencies, freezeTemplatePayload } from './resourceReferences'
import { reusableTemplatePayload } from '../templates/templateService'
import { readReusableLayout } from '../journal/journalReusableLayouts'
import { sha256Bytes } from '../../services/sync/syncModel'
import { isRecord } from '../../utils/safeJson'
import { validateResourceGraph } from './resourceIntegrity'

interface ResourcePack { format: 'oshinote-resource-pack'; version: 1; template?: Pick<ResourceTemplate,'type'|'name'|'description'|'payload'>; assets: ResourceAsset[]; versions: ResourceVersion[]; files: Record<string,string> }
const FILE_PATH = /^media\/resources\/[a-f0-9-]{36}\.(png|jpg|webp|gif)$/i
function encode(bytes: Uint8Array) { let text = ''; for (let i=0;i<bytes.length;i+=8192) text += String.fromCharCode(...bytes.subarray(i,i+8192)); return btoa(text) }
function decode(value: string) { return Uint8Array.from(atob(value), char => char.charCodeAt(0)) }
export function validatePackShape(value: unknown): asserts value is ResourcePack {
  if (!isRecord(value) || value.format !== 'oshinote-resource-pack' || value.version !== 1 || !Array.isArray(value.assets) || !Array.isArray(value.versions) || !isRecord(value.files)) throw new Error('Invalid OshiNote resource pack')
  if (value.versions.length > 256 || value.assets.length > 256 || Object.keys(value.files).length > 256) throw new Error('Too many resources')
  if (value.template !== undefined && (!isRecord(value.template) || !['journal_page','note','stamp','material'].includes(String(value.template.type)) || typeof value.template.payload !== 'string' || typeof value.template.name !== 'string' || !value.template.name.trim() || value.template.name.length > 160 || typeof value.template.description !== 'string')) throw new Error('Invalid template')
  const ids = new Set<string>()
  for (const version of value.versions) {
    if (!isRecord(version) || typeof version.id !== 'string' || ids.has(version.id) || typeof version.asset_id !== 'string' || typeof version.payload !== 'string' || !['builtin-v1','material-image-v1'].includes(String(version.renderer))) throw new Error('Invalid resource version')
    ids.add(version.id)
    const definition = JSON.parse(version.payload)
    if (!isRecord(definition) || !['sticker','tape','paper','label'].includes(String(definition.kind)) || !isRecord(definition.defaultStyle) || typeof definition.id !== 'string' || !['defaultWidth','defaultHeight'].every(key => typeof definition[key] === 'number' && Number.isFinite(definition[key]) && Number(definition[key]) > 0 && Number(definition[key]) <= 4096)) throw new Error('Invalid material definition')
    if (version.renderer === 'material-image-v1') {
      if (typeof version.file_path !== 'string' || !FILE_PATH.test(version.file_path) || definition.imagePath !== version.file_path || definition.resourceVersionId !== version.id || definition.id !== version.asset_id || typeof version.content_hash !== 'string' || !/^[a-f0-9]{64}$/.test(version.content_hash)) throw new Error('Invalid material image path or hash')
      if (typeof value.files[version.file_path] !== 'string') throw new Error('Missing material image')
    } else if (version.file_path !== null || version.content_hash !== null || definition.imagePath) throw new Error('Invalid built-in resource')
  }
  const assetIds = new Set<string>()
  for (const asset of value.assets) {
    if (!isRecord(asset) || typeof asset.id !== 'string' || assetIds.has(asset.id) || typeof asset.name !== 'string' || !asset.name.trim() || asset.name.length > 160 || !['sticker','tape','paper','label'].includes(String(asset.kind)) || !['builtin','import'].includes(String(asset.source)) || typeof asset.current_version_id !== 'string' || !ids.has(asset.current_version_id) || typeof asset.metadata !== 'string') throw new Error('Invalid resource catalogue')
    if (!value.versions.some(v => isRecord(v) && v.id === asset.current_version_id && v.asset_id === asset.id)) throw new Error('Resource ownership mismatch')
    assetIds.add(asset.id)
  }
  if (value.versions.some(v => !assetIds.has((v as ResourceVersion).asset_id))) throw new Error('Missing resource catalogue')
  for (const path of Object.keys(value.files)) if (!FILE_PATH.test(path) || !value.versions.some(v => isRecord(v) && v.file_path === path)) throw new Error('Unexpected package file')
  if (value.template) {
    const template = value.template as ResourcePack['template']
    const payload = JSON.parse(template!.payload)
    if (!isRecord(payload) || resourceDependencies(payload).some(id => !ids.has(id))) throw new Error('Missing template dependency')
    if (template!.type === 'stamp') {
      const stamp = isRecord(payload.stamp) ? payload.stamp : payload
      if (typeof stamp.template_id !== 'string'
        || ['label','color','template_snapshot'].some(key => stamp[key] !== undefined && typeof stamp[key] !== 'string')
        || ['size','rotation','opacity','x','y'].some(key => stamp[key] !== undefined && (typeof stamp[key] !== 'number' || !Number.isFinite(stamp[key])))) throw new Error('Invalid stamp template')
    }
    if (template!.type === 'journal_page' && !readReusableLayout({ ...template, id: 'validation', source: 'user' } as ResourceTemplate, false)) throw new Error('Invalid journal layout')
  }
  validateResourceGraph([
    ...value.assets.map(asset => ({ key: `resource_assets:${asset.id}`, table: 'resource_assets', id: asset.id, value: asset })),
    ...value.versions.map(version => ({ key: `resource_versions:${version.id}`, table: 'resource_versions', id: version.id, value: version })),
    ...(value.template ? [{ key: 'templates:import', table: 'templates', id: 'import', value: value.template }] : []),
  ])
}
async function makePack(versionIds: string[], template?: ResourcePack['template']): Promise<ResourcePack> {
  const db = await getDb()
  const pack: ResourcePack = { format: 'oshinote-resource-pack', version: 1, template, assets: [], versions: [], files: {} }
  const assetIds = new Set<string>()
  for (const id of new Set(versionIds)) {
    const [version] = await db.select<ResourceVersion[]>('SELECT * FROM resource_versions WHERE id = ?', [id])
    if (!version) throw new Error('Missing version: ' + id)
    pack.versions.push(version)
    if (!assetIds.has(version.asset_id)) {
      const [asset] = await db.select<ResourceAsset[]>('SELECT * FROM resource_assets WHERE id = ?', [version.asset_id])
      pack.assets.push({ ...asset, current_version_id: version.id, archived: 0 })
      assetIds.add(version.asset_id)
    }
    if (version.file_path) {
      const bytes = new Uint8Array(await readFile(version.file_path, { baseDir: BaseDirectory.AppData }))
      if (await sha256Bytes(bytes) !== version.content_hash) throw new Error('Resource integrity check failed')
      pack.files[version.file_path] = encode(bytes)
    }
  }
  return pack
}
async function savePack(pack: ResourcePack, name: string) {
  const path = await save({ defaultPath: `${name.replace(/[<>:"/\\|?*]/g,'_')}.oshi-resource.json`, filters: [{ name: 'OshiNote resources', extensions: ['json'] }] })
  if (!path) return false
  const content = JSON.stringify(pack)
  if (content.length > 100 * 1024 * 1024) throw new Error('Resource pack exceeds 100 MB')
  await writeTextFile(path, content)
  return true
}
export async function exportMaterialPack(assetId: string, name: string) {
  const db = await getDb()
  const [asset] = await db.select<ResourceAsset[]>('SELECT * FROM resource_assets WHERE id = ?', [assetId])
  if (!asset) throw new Error('Resource not found')
  return savePack(await makePack([asset.current_version_id]), name)
}
export async function exportTemplatePack(template: ResourceTemplate, name: string) {
  await reconcileResourceLibrary(await getDb())
  const payload = freezeTemplatePayload(reusableTemplatePayload(template))
  return savePack(await makePack(resourceDependencies(JSON.parse(payload)), { type: template.type, name, description: template.source === 'builtin' ? '' : template.description, payload }), name)
}
async function importResourcePackUnlocked(file: File) {
  if (file.size > 100 * 1024 * 1024) throw new Error('Resource pack exceeds 100 MB')
  const pack: unknown = JSON.parse(await file.text())
  validatePackShape(pack)
  const db = await getDb()
  const statements: ResourceStatement[] = []
  const files = new Map<string, Uint8Array>()
  // Validate every file and version before writing anything. Existing versions are never overwritten.
  for (const version of pack.versions) {
    const [existing] = await db.select<ResourceVersion[]>('SELECT * FROM resource_versions WHERE id = ?', [version.id])
    if (existing && ['asset_id','renderer','payload','file_path','content_hash'].some(key => existing[key as keyof ResourceVersion] !== version[key as keyof ResourceVersion])) throw new Error('Resource version collision')
    if (version.file_path) {
      const bytes = decode(pack.files[version.file_path])
      if (await sha256Bytes(bytes) !== version.content_hash) throw new Error('Resource integrity check failed')
      const ext = version.file_path.split('.').pop()!
      const type = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
      await decodeMaterialFile(new File([bytes], 'material.'+ext, { type }))
      if (await exists(version.file_path, { baseDir: BaseDirectory.AppData })) {
        const local = new Uint8Array(await readFile(version.file_path, { baseDir: BaseDirectory.AppData }))
        if (await sha256Bytes(local) !== version.content_hash) throw new Error('Local file collision')
      } else files.set(version.file_path, bytes)
    }
  }
  for (const asset of pack.assets) statements.push({ query: 'INSERT OR IGNORE INTO resource_assets (id,kind,name,source,current_version_id,metadata,archived) VALUES (?,?,?,?,?,?,0)', values: [asset.id,asset.kind,asset.name,asset.source,asset.current_version_id,asset.metadata] })
  for (const v of pack.versions) statements.push({ query: 'INSERT OR IGNORE INTO resource_versions (id,asset_id,renderer,payload,file_path,content_hash) VALUES (?,?,?,?,?,?)', values: [v.id,v.asset_id,v.renderer,v.payload,v.file_path,v.content_hash] })
  const templateId = pack.template ? generateId() : null
  if (pack.template) statements.push({ query: "INSERT INTO templates (id,type,name,description,source,payload) VALUES (?,?,?,?,'user',?)", values: [templateId,pack.template.type,pack.template.name,pack.template.description,pack.template.payload] })
  if (files.size) await mkdir('media/resources', { baseDir: BaseDirectory.AppData, recursive: true })
  for (const [path,bytes] of files) await writeFile(path,bytes,{ baseDir: BaseDirectory.AppData })
  await commitResources(statements)
  await loadMaterialLibrary(db)
  notifyResourcesChanged()
  return templateId
}

export function importResourcePack(file: File) { return withResourceFiles(() => importResourcePackUnlocked(file)) }
