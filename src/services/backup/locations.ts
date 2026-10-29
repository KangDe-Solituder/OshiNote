import { invoke } from '@tauri-apps/api/core'
import { readLocalStorage } from '../../utils/safeLocalStorage'
import { readWebDavConfig, type WebDavConfig } from '../sync/webdavService'
import { isRecord, safeJsonParse } from '../../utils/safeJson'

export type DataLocation = { id: string; name: string } & (
  { kind: 'local'; directory: string } | { kind: 'webdav'; config: WebDavConfig }
)
export interface LocationSettings { locations: DataLocation[]; syncId: string; backupId: string }
const KEY = 'oshinote.data.locations.v1'

export function readLocations(): LocationSettings {
  const stored = readLocalStorage(KEY)
  if (stored) {
    const value = safeJsonParse<Record<string, unknown>>(stored, {}, isRecord)
    const locations = Array.isArray(value.locations) ? value.locations.filter(isLocation) : []
    return { locations,
      syncId: locations.some(x => x.kind === 'webdav' && x.id === value.syncId) ? String(value.syncId) : '',
      backupId: locations.some(x => x.id === value.backupId) ? String(value.backupId) : '' }
  }
  // Import the existing connection only when the user actually saved one.
  if (readLocalStorage('oshinote.webdav.config')) {
    const location: DataLocation = { id: 'legacy-webdav', name: 'WebDAV', kind: 'webdav', config: readWebDavConfig() }
    return { locations: [location], syncId: location.id, backupId: location.id }
  }
  return { locations: [], syncId: '', backupId: '' }
}

function isLocation(value: unknown): value is DataLocation {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') return false
  if (value.kind === 'local') return typeof value.directory === 'string'
  return value.kind === 'webdav' && isRecord(value.config) &&
    ['baseUrl', 'username', 'password', 'remotePath'].every(key => typeof (value.config as Record<string, unknown>)[key] === 'string') &&
    typeof value.config.allowInvalidCert === 'boolean'
}

export function validateLocation(location: DataLocation): void {
  if (!location.name.trim()) throw new Error('请输入配置名称 / Enter a configuration name.')
  if (location.kind === 'local') {
    if (!/^(?:[A-Za-z]:[\\/]|\\\\|\/)/.test(location.directory)) throw new Error('请选择本地备份目录 / Choose an absolute backup directory.')
  } else {
    const url = new URL(location.config.baseUrl)
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('无效的 WebDAV 地址 / Invalid WebDAV URL.')
    if (!location.config.remotePath.trim() || location.config.remotePath.replaceAll('\\', '/').split('/').some(x => x === '..' || x === '.')) throw new Error('无效的远程目录 / Invalid remote directory.')
  }
}

export async function saveLocations(settings: LocationSettings): Promise<void> {
  settings.locations.forEach(validateLocation)
  const locations = await Promise.all(settings.locations.map(async location => location.kind === 'local' ? location : {
    ...location, config: { ...location.config, password: '', protectedPassword: location.config.password
      ? await invoke<number[]>('protect_connection_secret', { secret: location.config.password }) : (location.config.protectedPassword || []) },
  }))
  // Only replace the old record after every password was protected successfully.
  localStorage.setItem(KEY, JSON.stringify({ ...settings, locations }))
  localStorage.removeItem('oshinote.webdav.config')
}

export async function loadLocations(): Promise<{ settings: LocationSettings; locked: boolean }> {
  const settings = readLocations()
  let locked = false
  for (const location of settings.locations) {
    if (location.kind !== 'webdav') continue
    const config = location.config as WebDavConfig & { protectedPassword?: number[] }
    if (config.protectedPassword?.length) {
      try { config.password = await invoke<string>('unprotect_connection_secret', { encrypted: config.protectedPassword }) }
      catch { config.password = ''; locked = true }
    }
  }
  // Preserve encrypted data on a different Windows account; let the user re-enter it in the editor.
  if (!locked && settings.locations.length) await saveLocations(settings)
  return { settings, locked }
}
