import type { SyncRecord } from '../../services/sync/syncModel'
import { isRecord, safeJsonParse } from '../../utils/safeJson'

/** Validate the projected state before a sync transaction can remove dependencies. */
export function validateResourceGraph(records: Iterable<SyncRecord>) {
  const rows = Array.from(records)
  const assets = new Set(rows.filter(row => row.table === 'resource_assets').map(row => row.id))
  const versions = new Map(rows.filter(row => row.table === 'resource_versions').map(row => [row.id, row.value]))
  const requireVersion = (id: unknown) => {
    if (typeof id === 'string' && !versions.has(id)) throw new Error(`Missing resource version: ${id}`)
  }
  for (const row of rows) {
    if (row.table === 'resource_assets') {
      requireVersion(row.value.current_version_id)
      const version = versions.get(String(row.value.current_version_id))
      if (version && version.asset_id !== row.id) throw new Error('Resource version ownership mismatch')
    }
    if (row.table === 'resource_versions') {
      if (!assets.has(String(row.value.asset_id))) throw new Error(`Missing resource asset: ${row.value.asset_id}`)
      if (!['builtin-v1', 'image-v1', 'material-image-v1'].includes(String(row.value.renderer))) throw new Error(`Unsupported resource renderer: ${row.value.renderer}`)
      if (row.value.renderer === 'material-image-v1') {
        const definition = safeJsonParse<Record<string, unknown>>(String(row.value.payload), {}, isRecord)
        if (typeof row.value.file_path !== 'string' || !/^media\/resources\/[a-f0-9-]{36}\.(png|jpg|webp|gif)$/i.test(row.value.file_path)
          || definition.imagePath !== row.value.file_path || definition.resourceVersionId !== row.id || definition.id !== row.value.asset_id
          || !/^[a-f0-9]{64}$/.test(String(row.value.content_hash))) throw new Error('Invalid material image version')
      }
    }
    const raw = row.table === 'journal_items' ? row.value.material_snapshot : row.table === 'templates' ? row.value.payload : null
    if (typeof raw !== 'string') continue
    const visit = (value: unknown): void => {
      if (Array.isArray(value)) { value.forEach(visit); return }
      if (!isRecord(value)) return
      requireVersion(value.resourceVersionId)
      if (value.imagePath !== undefined) {
        const version = versions.get(String(value.resourceVersionId))
        if (!version || version.renderer !== 'material-image-v1' || value.imagePath !== version.file_path) throw new Error('Material image does not match its saved version')
      }
      if (Array.isArray(value.resourceDependencies)) value.resourceDependencies.forEach(requireVersion)
      if (typeof value.materialSnapshot === 'string') visit(safeJsonParse(value.materialSnapshot, {}, isRecord))
      Object.values(value).forEach(visit)
    }
    visit(safeJsonParse(raw, {}, isRecord))
  }
}
