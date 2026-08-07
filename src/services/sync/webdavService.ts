import { invoke, isTauri } from '@tauri-apps/api/core'
import { closeDb, getDb } from '../../database'
import { isRecord, safeJsonParse, asString } from '../../utils/safeJson'
import { readLocalStorage, writeLocalStorage } from '../../utils/safeLocalStorage'

const WEBDAV_CONFIG_KEY = 'oshinote.webdav.config'

export interface WebDavConfig {
  baseUrl: string
  username: string
  password: string
  remotePath: string
  allowInvalidCert: boolean
}

export interface WebDavSummary {
  remote_path: string
  file_name: string
  bytes: number
}

export interface WebDavRepositoryInspection {
  connected: boolean
  repository_initialized: boolean
  server_date: string | null
  remote_updated_at: string | null
  remote_head: string | null
  remote_generation: number | null
  head_etag: string | null
  supports_etag: boolean
  supports_move: boolean
}

export interface WebDavTextObject {
  exists: boolean
  text: string | null
  etag: string | null
  last_modified: string | null
  server_date: string | null
}

export interface WebDavWriteResult {
  bytes: number
  etag: string | null
  last_modified: string | null
  server_date: string | null
}

export interface SyncCacheSummary {
  bytes: number
  files: number
}

const DEFAULT_CONFIG: WebDavConfig = {
  baseUrl: 'https://192.168.3.37:5006',
  username: 'KangDe',
  password: '',
  remotePath: 'BackUp/OshiNote',
  allowInvalidCert: false,
}

export function readWebDavConfig(): WebDavConfig {
  const parsed = safeJsonParse<Partial<WebDavConfig>>(readLocalStorage(WEBDAV_CONFIG_KEY), {}, isRecord)
  return {
    baseUrl: asString(parsed.baseUrl, DEFAULT_CONFIG.baseUrl),
    username: asString(parsed.username, DEFAULT_CONFIG.username),
    password: asString(parsed.password),
    remotePath: asString(parsed.remotePath, DEFAULT_CONFIG.remotePath),
    allowInvalidCert: parsed.allowInvalidCert === true,
  }
}

export function saveWebDavConfig(config: WebDavConfig): void {
  writeLocalStorage(WEBDAV_CONFIG_KEY, JSON.stringify(config))
}

function requireTauri(): void {
  if (!isTauri()) throw new Error('WebDAV sync is available in the desktop app.')
}

function toCommandConfig(config: WebDavConfig) {
  return {
    base_url: config.baseUrl.trim(),
    username: config.username.trim(),
    password: config.password,
    remote_path: config.remotePath.trim(),
    allow_invalid_cert: config.allowInvalidCert,
  }
}

export async function testWebDavConnection(config: WebDavConfig): Promise<WebDavRepositoryInspection> {
  requireTauri()
  return invoke<WebDavRepositoryInspection>('inspect_webdav_repository', { config: toCommandConfig(config) })
}

export async function uploadWebDavBackup(config: WebDavConfig): Promise<WebDavSummary> {
  requireTauri()
  const syncMetadata = await readBackupSyncMetadata()
  await closeDb()
  return invoke<WebDavSummary>('upload_webdav_backup', {
    config: toCommandConfig(config),
    sync_metadata: syncMetadata,
  })
}

export async function downloadAndRestoreWebDavBackup(config: WebDavConfig): Promise<void> {
  requireTauri()
  await invoke<string>('download_webdav_backup', { config: toCommandConfig(config) })
  await closeDb()
  await invoke('restore_downloaded_webdav_backup')
  window.location.reload()
}

export async function readWebDavText(config: WebDavConfig, relativePath: string): Promise<WebDavTextObject> {
  requireTauri()
  return invoke<WebDavTextObject>('read_webdav_text', {
    config: toCommandConfig(config),
    relativePath,
  })
}

export async function writeWebDavText(
  config: WebDavConfig,
  relativePath: string,
  text: string,
  options: { ifMatch?: string | null; ifNoneMatch?: boolean } = {}
): Promise<WebDavWriteResult> {
  requireTauri()
  return invoke<WebDavWriteResult>('write_webdav_text', {
    config: toCommandConfig(config),
    relativePath,
    text,
    ifMatch: options.ifMatch || null,
    ifNoneMatch: options.ifNoneMatch === true,
  })
}

export async function uploadWebDavAppDataFile(
  config: WebDavConfig,
  localRelativePath: string,
  remoteRelativePath: string,
  ifNoneMatch = true
): Promise<WebDavWriteResult> {
  requireTauri()
  return invoke<WebDavWriteResult>('upload_webdav_app_data_file', {
    config: toCommandConfig(config),
    localRelativePath,
    remoteRelativePath,
    ifNoneMatch,
  })
}

export async function downloadWebDavAppDataFile(
  config: WebDavConfig,
  remoteRelativePath: string,
  localRelativePath: string
): Promise<string> {
  requireTauri()
  return invoke<string>('download_webdav_app_data_file', {
    config: toCommandConfig(config),
    remoteRelativePath,
    localRelativePath,
  })
}

export async function activateSyncCacheFile(
  cacheRelativePath: string,
  mediaRelativePath: string
): Promise<string> {
  requireTauri()
  return invoke<string>('activate_sync_cache_file', {
    cacheRelativePath,
    mediaRelativePath,
  })
}

export async function inspectSyncCache(): Promise<SyncCacheSummary> {
  requireTauri()
  return invoke<SyncCacheSummary>('inspect_sync_cache')
}

export async function clearSyncCache(): Promise<SyncCacheSummary> {
  requireTauri()
  return invoke<SyncCacheSummary>('clear_sync_cache')
}

async function readBackupSyncMetadata() {
  const db = await getDb()
  const rows = await db.select<{ value: string }[]>("SELECT value FROM sync_state WHERE key = 'repository'")
  if (!rows[0]?.value) return null
  try {
    const state = JSON.parse(rows[0].value) as { repository_id?: string; head?: string | null }
    return {
      repository_id: state.repository_id || null,
      head_commit: state.head || null,
      schema_version: 1,
    }
  } catch {
    return null
  }
}
