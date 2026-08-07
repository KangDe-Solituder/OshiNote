export const SYNC_PROTOCOL_VERSION = 1
export const SYNC_SCHEMA_VERSION = 1

export interface SyncRecord {
  key: string
  table: string
  id: string
  value: Record<string, unknown>
}

export interface SyncSnapshot {
  record_hashes: Record<string, string>
  media_hashes: Record<string, string>
}

export interface SyncOperation {
  key: string
  table: string
  id: string
  operation: 'upsert' | 'delete'
  value?: Record<string, unknown>
}

export interface SyncMediaOperation {
  path: string
  operation: 'upsert' | 'delete'
  hash?: string
}

export interface SyncPack {
  format: 'oshinote-sync-pack'
  protocol_version: number
  operations: SyncOperation[]
  media_operations: SyncMediaOperation[]
}

export interface SyncCommit {
  format: 'oshinote-sync-commit'
  protocol_version: number
  repository_id: string
  id: string
  parents: string[]
  device_id: string
  schema_version: number
  generation: number
  created_at: string
  pack: string
  snapshot: SyncSnapshot
}

export interface SyncConflictDraft {
  key: string
  kind: 'record' | 'media'
  base_hash: string | null
  local_hash: string | null
  remote_hash: string | null
}

export interface SyncMergeResult {
  snapshot: SyncSnapshot
  take_remote_records: string[]
  take_remote_media: string[]
  conflicts: SyncConflictDraft[]
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortCanonical(value))
}

export async function sha256Text(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  return sha256Bytes(bytes)
}

export async function sha256Bytes(value: Uint8Array): Promise<string> {
  const source = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer
  const digest = await crypto.subtle.digest('SHA-256', source)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function diffSnapshot(
  base: SyncSnapshot,
  current: SyncSnapshot,
  records: ReadonlyMap<string, SyncRecord>
): { operations: SyncOperation[]; mediaOperations: SyncMediaOperation[] } {
  const operations: SyncOperation[] = []
  for (const key of unionKeys(base.record_hashes, current.record_hashes)) {
    if (valueAt(base.record_hashes, key) === valueAt(current.record_hashes, key)) continue
    const record = records.get(key)
    if (record) {
      operations.push({ key, table: record.table, id: record.id, operation: 'upsert', value: record.value })
    } else {
      const [table, ...idParts] = key.split(':')
      operations.push({ key, table, id: idParts.join(':'), operation: 'delete' })
    }
  }

  const mediaOperations: SyncMediaOperation[] = []
  for (const path of unionKeys(base.media_hashes, current.media_hashes)) {
    const before = valueAt(base.media_hashes, path)
    const after = valueAt(current.media_hashes, path)
    if (before === after) continue
    mediaOperations.push(after
      ? { path, operation: 'upsert', hash: after }
      : { path, operation: 'delete' })
  }
  return { operations, mediaOperations }
}

export function mergeSnapshots(base: SyncSnapshot, local: SyncSnapshot, remote: SyncSnapshot): SyncMergeResult {
  const recordMerge = mergeHashMap(base.record_hashes, local.record_hashes, remote.record_hashes, 'record')
  const mediaMerge = mergeHashMap(base.media_hashes, local.media_hashes, remote.media_hashes, 'media')
  return {
    snapshot: {
      record_hashes: recordMerge.values,
      media_hashes: mediaMerge.values,
    },
    take_remote_records: recordMerge.takeRemote,
    take_remote_media: mediaMerge.takeRemote,
    conflicts: [...recordMerge.conflicts, ...mediaMerge.conflicts],
  }
}

export function emptySnapshot(): SyncSnapshot {
  return { record_hashes: {}, media_hashes: {} }
}

function mergeHashMap(
  base: Record<string, string>,
  local: Record<string, string>,
  remote: Record<string, string>,
  kind: 'record' | 'media'
) {
  const values: Record<string, string> = {}
  const takeRemote: string[] = []
  const conflicts: SyncConflictDraft[] = []
  for (const key of unionKeys(base, local, remote)) {
    const baseHash = valueAt(base, key)
    const localHash = valueAt(local, key)
    const remoteHash = valueAt(remote, key)
    if (localHash === remoteHash) {
      if (localHash) values[key] = localHash
      continue
    }
    if (localHash === baseHash) {
      if (remoteHash) values[key] = remoteHash
      takeRemote.push(key)
      continue
    }
    if (remoteHash === baseHash) {
      if (localHash) values[key] = localHash
      continue
    }
    if (localHash) values[key] = localHash
    conflicts.push({
      key,
      kind,
      base_hash: baseHash,
      local_hash: localHash,
      remote_hash: remoteHash,
    })
  }
  return { values, takeRemote, conflicts }
}

function valueAt(source: Record<string, string>, key: string): string | null {
  return Object.prototype.hasOwnProperty.call(source, key) ? source[key] : null
}

function unionKeys(...sources: Record<string, string>[]): string[] {
  const keys = new Set<string>()
  for (const source of sources) Object.keys(source).forEach((key) => keys.add(key))
  return Array.from(keys).sort()
}

function sortCanonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortCanonical)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortCanonical(child)])
    )
  }
  return value
}
