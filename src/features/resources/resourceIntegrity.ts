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
    if (row.table === 'resource_assets') requireVersion(row.value.current_version_id)
    if (row.table === 'resource_versions') {
      if (!assets.has(String(row.value.asset_id))) throw new Error(`Missing resource asset: ${row.value.asset_id}`)
      if (!['builtin-v1', 'image-v1'].includes(String(row.value.renderer))) throw new Error(`Unsupported resource renderer: ${row.value.renderer}`)
    }
    const raw = row.table === 'journal_items' ? row.value.material_snapshot : row.table === 'templates' ? row.value.payload : null
    if (typeof raw !== 'string') continue
    const visit = (value: unknown): void => {
      if (Array.isArray(value)) { value.forEach(visit); return }
      if (!isRecord(value)) return
      requireVersion(value.resourceVersionId)
      if (Array.isArray(value.resourceDependencies)) value.resourceDependencies.forEach(requireVersion)
      if (typeof value.materialSnapshot === 'string') visit(safeJsonParse(value.materialSnapshot, {}, isRecord))
      Object.values(value).forEach(visit)
    }
    visit(safeJsonParse(raw, {}, isRecord))
  }
}
