import { invoke, isTauri } from '@tauri-apps/api/core'
import { closeDb } from '../../database'
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

export async function testWebDavConnection(config: WebDavConfig): Promise<void> {
  requireTauri()
  await invoke('test_webdav_connection', { config: toCommandConfig(config) })
}

export async function uploadWebDavBackup(config: WebDavConfig): Promise<WebDavSummary> {
  requireTauri()
  await closeDb()
  return invoke<WebDavSummary>('upload_webdav_backup', { config: toCommandConfig(config) })
}

export async function downloadAndRestoreWebDavBackup(config: WebDavConfig): Promise<void> {
  requireTauri()
  await invoke<string>('download_webdav_backup', { config: toCommandConfig(config) })
  await closeDb()
  await invoke('restore_downloaded_webdav_backup')
  window.location.reload()
}
