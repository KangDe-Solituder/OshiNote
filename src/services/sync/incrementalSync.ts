import { BaseDirectory, exists, readFile } from '@tauri-apps/plugin-fs'
import { getDb } from '../../database'
import {
  activateSyncCacheFile,
  downloadWebDavAppDataFile,
  readWebDavText,
  testWebDavConnection,
  uploadWebDavAppDataFile,
  writeWebDavText,
  type WebDavConfig,
  type WebDavRepositoryInspection,
} from './webdavService'
import {
  canonicalJson,
  diffSnapshot,
  emptySnapshot,
  mergeSnapshots,
  sha256Bytes,
  sha256Text,
  SYNC_PROTOCOL_VERSION,
  SYNC_SCHEMA_VERSION,
  type SyncCommit,
  type SyncConflictDraft,
  type SyncOperation,
  type SyncPack,
  type SyncSnapshot,
} from './syncModel'
import {
  applySyncOperations,
  buildLocalSyncDataset,
  incomingBlobCachePath,
  noteImageBlobFromOperation,
  type LocalSyncDataset,
} from './syncDataset'

const REPOSITORY_PATH = 'repository.json'
const REF_PATH = 'sync/v1/refs/main.json'
const LOCAL_STATE_KEY = 'repository'
const PENDING_MERGE_KEY = 'pendingMerge'

interface RepositoryFile {
  format: 'oshinote-repository'
  protocol_version: number
  repository_id: string
  created_at: string
}

interface RemoteRef {
  repository_id: string
  head: string
  generation: number
  updated_by: string
}

interface LocalSyncState {
  repository_id: string
  device_id: string
  head: string | null
}

interface PendingMerge {
  repository_id: string
  remote_head: string
  remote_etag: string | null
  remote_snapshot: SyncSnapshot
  local_commit: string | null
  take_remote_records: string[]
  take_remote_media: string[]
  remote_operations: SyncOperation[]
}

interface RemoteChangeSet {
  operations: Map<string, SyncOperation>
}

export interface IncrementalSyncSummary {
  mode: SyncMode
  status: 'up-to-date' | 'pushed' | 'pulled' | 'merged' | 'conflicts'
  head: string | null
  uploadedRecords: number
  downloadedRecords: number
  transferredBytes: number
  conflicts: number
  remoteUpdatedAt: string | null
}

export interface StoredSyncConflict {
  id: string
  entity_key: string
  entity_type: string
  base_value: string | null
  local_value: string | null
  remote_value: string | null
  resolution: 'local' | 'remote' | null
  created_at: string
}

export type SyncMode = 'sync' | 'pull' | 'push'

export async function inspectIncrementalSync(config: WebDavConfig): Promise<WebDavRepositoryInspection> {
  return testWebDavConnection(config)
}

export async function runIncrementalSync(
  config: WebDavConfig,
  mode: SyncMode = 'sync'
): Promise<IncrementalSyncSummary> {
  const repository = await ensureRepository(config)
  const inspection = await testWebDavConnection(config)
  const remoteRefObject = await readWebDavText(config, REF_PATH)
  const remoteRef = parseRemoteRef(remoteRefObject.text)
  if (remoteRef && remoteRef.repository_id !== repository.repository_id) {
    throw new Error('The remote HEAD belongs to a different OshiNote repository.')
  }
  let localState = await readLocalState()
  if (localState && localState.repository_id !== repository.repository_id) {
    throw new Error('The selected WebDAV folder belongs to a different OshiNote repository.')
  }
  if (!localState) {
    localState = {
      repository_id: repository.repository_id,
      device_id: crypto.randomUUID(),
      head: null,
    }
    await writeLocalState(localState)
  }

  const baseCommit = localState.head
    ? await readCommit(config, localState.head)
    : null
  const baseSnapshot = baseCommit?.snapshot || emptySnapshot()
  const remoteHead = remoteRef?.head || null
  const remoteCommit = remoteHead ? await readCommit(config, remoteHead) : null
  const remoteSnapshot = remoteCommit?.snapshot || emptySnapshot()
  const localDataset = await buildLocalSyncDataset()

  if (mode === 'push' && remoteHead !== localState.head) {
    throw new Error('The remote repository has newer commits. Pull or use Check and sync first.')
  }

  let localCommit: SyncCommit | null = null
  let localUpload = { records: 0, bytes: 0 }
  if (mode !== 'pull') {
    const localDiff = diffSnapshot(baseSnapshot, localDataset.snapshot, localDataset.records)
    const forceInitialCommit = remoteHead === null && localState.head === null
    if (forceInitialCommit || localDiff.operations.length > 0 || localDiff.mediaOperations.length > 0) {
      const created = await createAndUploadCommit(
        config,
        repository.repository_id,
        localState.device_id,
        localState.head ? [localState.head] : [],
        (baseCommit?.generation || 0) + 1,
        localDataset,
        baseSnapshot,
        localDataset.snapshot
      )
      localCommit = created.commit
      localUpload = { records: created.records, bytes: created.bytes }
    }
  }

  if (remoteHead === localState.head) {
    if (!localCommit || mode === 'pull') {
      return summary(mode, 'up-to-date', remoteHead, 0, 0, 0, 0, inspection.remote_updated_at)
    }
    const write = await updateRemoteRef(config, repository.repository_id, localCommit, localState.device_id, remoteRefObject.etag, remoteRefObject.exists)
    localState.head = localCommit.id
    await writeLocalState(localState)
    await clearPendingMerge()
    return summary(mode, 'pushed', localCommit.id, localUpload.records, 0, localUpload.bytes, 0, write.last_modified)
  }

  if (!remoteHead || !remoteCommit || !remoteRef) {
    if (mode === 'pull') {
      return summary(mode, 'up-to-date', null, 0, 0, 0, 0, inspection.remote_updated_at)
    }
    if (!localCommit) throw new Error('Could not create the initial sync commit.')
    const write = await updateRemoteRef(config, repository.repository_id, localCommit, localState.device_id, remoteRefObject.etag, remoteRefObject.exists)
    localState.head = localCommit.id
    await writeLocalState(localState)
    return summary(mode, 'pushed', localCommit.id, localUpload.records, 0, localUpload.bytes, 0, write.last_modified)
  }

  const remoteChanges = await collectRemoteChanges(config, remoteHead, localState.head)
  const merge = mergeSnapshots(baseSnapshot, localDataset.snapshot, remoteSnapshot)
  if (merge.conflicts.length > 0) {
    await storeConflicts(merge.conflicts, localDataset, remoteChanges)
    await writeSyncState(PENDING_MERGE_KEY, {
      repository_id: repository.repository_id,
      remote_head: remoteHead,
      remote_etag: remoteRefObject.etag,
      remote_snapshot: remoteSnapshot,
      local_commit: localCommit?.id || null,
      take_remote_records: merge.take_remote_records,
      take_remote_media: merge.take_remote_media,
      remote_operations: Array.from(remoteChanges.operations.values()),
    } satisfies PendingMerge)
    return summary(mode, 'conflicts', remoteHead, localUpload.records, 0, localUpload.bytes, merge.conflicts.length, remoteRefObject.last_modified)
  }

  const remoteOperations = selectOperations(remoteChanges.operations, merge.take_remote_records)
  const downloadedBytes = await prepareRemoteFiles(config, remoteOperations, merge.take_remote_media, remoteSnapshot)
  await applySyncOperations(remoteOperations)
  localState.head = remoteHead
  await writeLocalState(localState)

  if (mode === 'pull') {
    await clearPendingMerge()
    return summary(mode, 'pulled', remoteHead, 0, remoteOperations.length, downloadedBytes, 0, remoteRefObject.last_modified)
  }

  const mergedDataset = await buildLocalSyncDataset()
  const mergedDiff = diffSnapshot(remoteSnapshot, mergedDataset.snapshot, mergedDataset.records)
  if (mergedDiff.operations.length === 0 && mergedDiff.mediaOperations.length === 0) {
    await clearPendingMerge()
    return summary(mode, 'pulled', remoteHead, 0, remoteOperations.length, downloadedBytes, 0, remoteRefObject.last_modified)
  }

  const parents = localCommit ? [remoteHead, localCommit.id] : [remoteHead]
  const mergedUpload = await createAndUploadCommit(
    config,
    repository.repository_id,
    localState.device_id,
    parents,
    remoteCommit.generation + 1,
    mergedDataset,
    remoteSnapshot,
    mergedDataset.snapshot
  )
  const write = await updateRemoteRef(config, repository.repository_id, mergedUpload.commit, localState.device_id, remoteRefObject.etag, remoteRefObject.exists)
  localState.head = mergedUpload.commit.id
  await writeLocalState(localState)
  await clearPendingMerge()
  return summary(
    mode,
    'merged',
    mergedUpload.commit.id,
    mergedUpload.records,
    remoteOperations.length,
    localUpload.bytes + mergedUpload.bytes + downloadedBytes,
    0,
    write.last_modified
  )
}

export async function listSyncConflicts(): Promise<StoredSyncConflict[]> {
  const db = await getDb()
  return db.select<StoredSyncConflict[]>(
    'SELECT * FROM sync_conflicts ORDER BY created_at ASC, entity_key ASC'
  )
}

export async function resolveSyncConflict(id: string, resolution: 'local' | 'remote'): Promise<void> {
  const db = await getDb()
  await db.execute('UPDATE sync_conflicts SET resolution = ? WHERE id = ?', [resolution, id])
}

export async function resetIncrementalSyncState(): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM sync_conflicts')
  await db.execute("DELETE FROM sync_state WHERE key IN (?, ?)", [LOCAL_STATE_KEY, PENDING_MERGE_KEY])
}

export async function finishPendingMerge(config: WebDavConfig): Promise<IncrementalSyncSummary> {
  const pending = await readSyncState<PendingMerge>(PENDING_MERGE_KEY)
  if (!pending) throw new Error('There is no pending sync merge.')
  const conflicts = await listSyncConflicts()
  if (conflicts.some((conflict) => !conflict.resolution)) {
    throw new Error('Resolve every conflict before completing the merge.')
  }
  const remoteRefObject = await readWebDavText(config, REF_PATH)
  const remoteRef = parseRemoteRef(remoteRefObject.text)
  if (!remoteRef || remoteRef.head !== pending.remote_head) {
    throw new Error('The remote repository changed again. Run Check and sync to refresh the merge.')
  }
  const localState = await readLocalState()
  if (!localState || localState.repository_id !== pending.repository_id) {
    throw new Error('The local sync repository no longer matches the pending merge.')
  }

  const remoteOperationMap = new Map(pending.remote_operations.map((operation) => [operation.key, operation]))
  const takeRemoteRecords = new Set(pending.take_remote_records)
  const takeRemoteMedia = new Set(pending.take_remote_media)
  for (const conflict of conflicts) {
    if (conflict.resolution !== 'remote') continue
    if (conflict.entity_type === 'media') takeRemoteMedia.add(conflict.entity_key)
    else takeRemoteRecords.add(conflict.entity_key)
  }
  const operations = selectOperations(remoteOperationMap, Array.from(takeRemoteRecords))
  const downloadedBytes = await prepareRemoteFiles(
    config,
    operations,
    Array.from(takeRemoteMedia),
    pending.remote_snapshot
  )
  await applySyncOperations(operations)
  localState.head = pending.remote_head
  await writeLocalState(localState)

  const remoteCommit = await readCommit(config, pending.remote_head)
  const dataset = await buildLocalSyncDataset()
  const upload = await createAndUploadCommit(
    config,
    pending.repository_id,
    localState.device_id,
    pending.local_commit ? [pending.remote_head, pending.local_commit] : [pending.remote_head],
    remoteCommit.generation + 1,
    dataset,
    pending.remote_snapshot,
    dataset.snapshot
  )
  const write = await updateRemoteRef(
    config,
    pending.repository_id,
    upload.commit,
    localState.device_id,
    remoteRefObject.etag,
    remoteRefObject.exists
  )
  localState.head = upload.commit.id
  await writeLocalState(localState)
  await clearPendingMerge()
  return summary('sync', 'merged', upload.commit.id, upload.records, operations.length, upload.bytes + downloadedBytes, 0, write.last_modified)
}

async function ensureRepository(config: WebDavConfig): Promise<RepositoryFile> {
  const existing = await readWebDavText(config, REPOSITORY_PATH)
  if (existing.exists && existing.text) return parseRepository(existing.text)
  const repository: RepositoryFile = {
    format: 'oshinote-repository',
    protocol_version: SYNC_PROTOCOL_VERSION,
    repository_id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
  }
  try {
    await writeWebDavText(config, REPOSITORY_PATH, canonicalJson(repository), { ifNoneMatch: true })
    return repository
  } catch (error) {
    if (!String(error).includes('WEBDAV_PRECONDITION_FAILED')) throw error
    const raced = await readWebDavText(config, REPOSITORY_PATH)
    if (!raced.text) throw error
    return parseRepository(raced.text)
  }
}

async function createAndUploadCommit(
  config: WebDavConfig,
  repositoryId: string,
  deviceId: string,
  parents: string[],
  generation: number,
  dataset: LocalSyncDataset,
  base: SyncSnapshot,
  current: SyncSnapshot
): Promise<{ commit: SyncCommit; records: number; bytes: number }> {
  const changes = diffSnapshot(base, current, dataset.records)
  const pack: SyncPack = {
    format: 'oshinote-sync-pack',
    protocol_version: SYNC_PROTOCOL_VERSION,
    operations: changes.operations,
    media_operations: changes.mediaOperations,
  }
  let transferredBytes = 0
  for (const media of changes.mediaOperations) {
    if (media.operation !== 'upsert' || !media.hash) continue
    const job = dataset.mediaJobs.get(media.path)
    if (!job || job.hash !== media.hash) throw new Error(`Missing local sync media: ${media.path}`)
    const write = await uploadWebDavAppDataFile(config, job.localPath, blobPath(media.hash), true)
    transferredBytes += write.bytes
  }

  const packText = canonicalJson(pack)
  const packHash = await sha256Text(packText)
  await writeImmutableJson(config, packPath(packHash), packText)
  transferredBytes += new TextEncoder().encode(packText).byteLength

  const unsigned = {
    format: 'oshinote-sync-commit' as const,
    protocol_version: SYNC_PROTOCOL_VERSION,
    repository_id: repositoryId,
    parents,
    device_id: deviceId,
    schema_version: SYNC_SCHEMA_VERSION,
    generation,
    created_at: new Date().toISOString(),
    pack: packHash,
    snapshot: current,
  }
  const id = await sha256Text(canonicalJson(unsigned))
  const commit: SyncCommit = { ...unsigned, id }
  const commitText = canonicalJson(commit)
  await writeImmutableJson(config, commitPath(id), commitText)
  transferredBytes += new TextEncoder().encode(commitText).byteLength
  return { commit, records: changes.operations.length, bytes: transferredBytes }
}

async function writeImmutableJson(config: WebDavConfig, path: string, text: string): Promise<void> {
  try {
    await writeWebDavText(config, path, text, { ifNoneMatch: true })
  } catch (error) {
    if (!String(error).includes('WEBDAV_PRECONDITION_FAILED')) throw error
    const existing = await readWebDavText(config, path)
    if (!existing.text || canonicalJson(JSON.parse(existing.text)) !== canonicalJson(JSON.parse(text))) throw error
  }
}

async function updateRemoteRef(
  config: WebDavConfig,
  repositoryId: string,
  commit: SyncCommit,
  deviceId: string,
  etag: string | null,
  referenceExists: boolean
) {
  const reference: RemoteRef = {
    repository_id: repositoryId,
    head: commit.id,
    generation: commit.generation,
    updated_by: deviceId,
  }
  if (etag) {
    return writeWebDavText(config, REF_PATH, canonicalJson(reference), { ifMatch: etag })
  }
  if (!referenceExists) {
    return writeWebDavText(config, REF_PATH, canonicalJson(reference), { ifNoneMatch: true })
  }
  const latest = await readWebDavText(config, REF_PATH)
  const latestRef = parseRemoteRef(latest.text)
  const expectedHead = commit.parents[0] || null
  if (!latestRef || latestRef.head !== expectedHead) {
    throw new Error('WEBDAV_PRECONDITION_FAILED: the remote HEAD changed before it could be updated.')
  }
  return writeWebDavText(config, REF_PATH, canonicalJson(reference))
}

async function collectRemoteChanges(
  config: WebDavConfig,
  head: string,
  stop: string | null
): Promise<RemoteChangeSet> {
  const commits: SyncCommit[] = []
  let cursor: string | null = head
  while (cursor && cursor !== stop) {
    const commit = await readCommit(config, cursor)
    commits.push(commit)
    cursor = commit.parents[0] || null
  }
  if (stop && cursor !== stop) throw new Error('The local sync base is not an ancestor of the remote HEAD.')
  commits.reverse()
  const operations = new Map<string, SyncOperation>()
  for (const commit of commits) {
    const pack = await readPack(config, commit.pack)
    for (const operation of pack.operations) operations.set(operation.key, operation)
  }
  return { operations }
}

async function prepareRemoteFiles(
  config: WebDavConfig,
  operations: SyncOperation[],
  mediaPaths: string[],
  remoteSnapshot: SyncSnapshot
): Promise<number> {
  let bytes = 0
  const requested = new Map<string, { hash: string; localPath: string; targetPath: string | null }>()
  for (const path of mediaPaths) {
    const hash = remoteSnapshot.media_hashes[path]
    if (!hash) continue
    requested.set(`${path}:${hash}`, { hash, localPath: incomingBlobCachePath(hash), targetPath: path.startsWith('media/') ? path : null })
  }
  for (const operation of operations) {
    const blob = noteImageBlobFromOperation(operation)
    if (blob) requested.set(`note-images/${operation.id}:${blob.hash}`, { hash: blob.hash, localPath: incomingBlobCachePath(blob.hash), targetPath: null })
  }
  for (const { hash, localPath, targetPath } of requested.values()) {
    if (!(await fileMatchesHash(localPath, hash))) {
      await downloadWebDavAppDataFile(config, blobPath(hash), localPath)
      const file = new Uint8Array(await readFile(localPath, { baseDir: BaseDirectory.AppData }))
      const actual = await sha256Bytes(file)
      if (actual !== hash) throw new Error(`Downloaded media failed verification: ${hash}`)
      bytes += file.byteLength
    }
    if (targetPath && !(await fileMatchesHash(targetPath, hash))) {
      await activateSyncCacheFile(localPath, targetPath)
    }
  }
  return bytes
}

async function fileMatchesHash(path: string, expected: string): Promise<boolean> {
  if (!(await exists(path, { baseDir: BaseDirectory.AppData }))) return false
  const bytes = new Uint8Array(await readFile(path, { baseDir: BaseDirectory.AppData }))
  return (await sha256Bytes(bytes)) === expected
}

async function storeConflicts(
  drafts: SyncConflictDraft[],
  local: LocalSyncDataset,
  remote: RemoteChangeSet
): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM sync_conflicts')
  for (const draft of drafts) {
    const remoteOperation = remote.operations.get(draft.key)
    const entityType = draft.kind === 'media'
      ? 'media'
      : local.records.get(draft.key)?.table || remoteOperation?.table || 'record'
    const localValue = draft.kind === 'media'
      ? draft.local_hash && JSON.stringify({ hash: draft.local_hash })
      : local.records.get(draft.key)?.value
        ? JSON.stringify(local.records.get(draft.key)!.value)
        : null
    const remoteValue = draft.kind === 'media'
      ? draft.remote_hash && JSON.stringify({ hash: draft.remote_hash })
      : remoteOperation?.value
        ? JSON.stringify(remoteOperation.value)
        : null
    await db.execute(
      `INSERT INTO sync_conflicts
       (id, entity_key, entity_type, base_value, local_value, remote_value, resolution)
       VALUES (?, ?, ?, ?, ?, ?, NULL)`,
      [
        crypto.randomUUID(),
        draft.key,
        entityType,
        draft.base_hash ? JSON.stringify({ hash: draft.base_hash }) : null,
        localValue,
        remoteValue,
      ]
    )
  }
}

function selectOperations(source: Map<string, SyncOperation>, keys: string[]): SyncOperation[] {
  return keys.map((key) => source.get(key)).filter((operation): operation is SyncOperation => Boolean(operation))
}

async function readCommit(config: WebDavConfig, id: string): Promise<SyncCommit> {
  const object = await readWebDavText(config, commitPath(id))
  if (!object.text) throw new Error(`Missing sync commit: ${id}`)
  const commit = JSON.parse(object.text) as SyncCommit
  if (commit.format !== 'oshinote-sync-commit' || commit.protocol_version !== SYNC_PROTOCOL_VERSION || commit.id !== id) {
    throw new Error(`Invalid sync commit: ${id}`)
  }
  if (commit.schema_version > SYNC_SCHEMA_VERSION) {
    throw new Error('This sync repository was created by a newer OshiNote data schema.')
  }
  const { id: storedId, ...unsigned } = commit
  const actualId = await sha256Text(canonicalJson(unsigned))
  if (storedId !== actualId) throw new Error(`Sync commit failed verification: ${id}`)
  return commit
}

async function readPack(config: WebDavConfig, id: string): Promise<SyncPack> {
  const object = await readWebDavText(config, packPath(id))
  if (!object.text) throw new Error(`Missing sync pack: ${id}`)
  const actual = await sha256Text(object.text)
  if (actual !== id) throw new Error(`Sync pack failed verification: ${id}`)
  const pack = JSON.parse(object.text) as SyncPack
  if (pack.format !== 'oshinote-sync-pack' || pack.protocol_version !== SYNC_PROTOCOL_VERSION) {
    throw new Error(`Invalid sync pack: ${id}`)
  }
  return pack
}

function parseRepository(text: string): RepositoryFile {
  const repository = JSON.parse(text) as RepositoryFile
  if (repository.format !== 'oshinote-repository' || repository.protocol_version !== SYNC_PROTOCOL_VERSION || !repository.repository_id) {
    throw new Error('Unsupported OshiNote sync repository.')
  }
  return repository
}

function parseRemoteRef(text: string | null): RemoteRef | null {
  if (!text) return null
  const reference = JSON.parse(text) as RemoteRef
  return reference.head && reference.repository_id ? reference : null
}

async function readLocalState(): Promise<LocalSyncState | null> {
  return readSyncState<LocalSyncState>(LOCAL_STATE_KEY)
}

async function writeLocalState(value: LocalSyncState): Promise<void> {
  await writeSyncState(LOCAL_STATE_KEY, value)
}

async function readSyncState<T>(key: string): Promise<T | null> {
  const db = await getDb()
  const rows = await db.select<{ value: string }[]>('SELECT value FROM sync_state WHERE key = ?', [key])
  if (!rows[0]?.value) return null
  try {
    return JSON.parse(rows[0].value) as T
  } catch {
    return null
  }
}

async function writeSyncState(key: string, value: unknown): Promise<void> {
  const db = await getDb()
  await db.execute(
    `INSERT INTO sync_state (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, JSON.stringify(value)]
  )
}

async function clearPendingMerge(): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM sync_conflicts')
  await db.execute('DELETE FROM sync_state WHERE key = ?', [PENDING_MERGE_KEY])
}

function commitPath(id: string): string {
  return `sync/v1/objects/commits/${id.slice(0, 2)}/${id}.json`
}

function packPath(id: string): string {
  return `sync/v1/objects/packs/${id.slice(0, 2)}/${id}.json`
}

function blobPath(id: string): string {
  return `sync/v1/objects/blobs/sha256/${id.slice(0, 2)}/${id}`
}

function summary(
  mode: SyncMode,
  status: IncrementalSyncSummary['status'],
  head: string | null,
  uploadedRecords: number,
  downloadedRecords: number,
  transferredBytes: number,
  conflicts: number,
  remoteUpdatedAt: string | null
): IncrementalSyncSummary {
  return { mode, status, head, uploadedRecords, downloadedRecords, transferredBytes, conflicts, remoteUpdatedAt }
}
