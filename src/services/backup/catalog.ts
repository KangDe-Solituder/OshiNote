import { invoke } from '@tauri-apps/api/core'
import { appDataDir, join } from '@tauri-apps/api/path'
import { withClosedDatabase } from '../../database'
import { readBackupSyncMetadata, type BackupSummary } from './index'
import type { DataLocation } from './locations'
import { readWebDavText, writeWebDavText, uploadWebDavAppDataFile, downloadWebDavAppDataFile } from '../sync/webdavService'
import { withResourceFiles } from '../../features/resources/resourceFileLock'

export interface BackupEntry { name: string; path: string; bytes: number }
const INDEX = 'backups/index.json'
const validName = (name: string) => /^oshinote-[\d-]+\.oshi\.zip$/.test(name)

function parseIndex(text: string | null): BackupEntry[] {
  const value: unknown = JSON.parse(text || '[]')
  if (!Array.isArray(value) || !value.every(x => x && typeof x.name === 'string' && validName(x.name) && x.path === `backups/${x.name}` && typeof x.bytes === 'number' && x.bytes >= 0)) {
    throw new Error('云端备份目录无效 / Invalid cloud backup catalog.')
  }
  return value as BackupEntry[]
}

export async function createLocationBackup(location: DataLocation): Promise<string> {
  return withResourceFiles(() => createLocationBackupUnlocked(location))
}

async function createLocationBackupUnlocked(location: DataLocation): Promise<string> {
  const metadata = await readBackupSyncMetadata()
  const result = await withClosedDatabase(() => invoke<BackupSummary>('create_directory_backup', {
    directory: location.kind === 'local' ? location.directory : null, syncMetadata: metadata,
  }))
  if (location.kind === 'local') return result.path
  const name = result.path.replaceAll('\\', '/').split('/').pop()!
  if (!validName(name)) throw new Error('Invalid backup filename')
  const path = `backups/${name}`
  const uploaded = await uploadWebDavAppDataFile(location.config, path, path)
  // Compare-and-swap prevents two devices from dropping each other's backup entries.
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await readWebDavText(location.config, INDEX)
    if (current.exists && !current.etag) throw new Error(`备份文件已上传，但服务器未提供 ETag，未覆盖备份目录。文件：${path}`)
    const entries = parseIndex(current.text)
    const next = [{ name, path, bytes: uploaded.bytes }, ...entries.filter(x => x.path !== path)]
    try {
      await writeWebDavText(location.config, INDEX, JSON.stringify(next), { ifMatch: current.etag, ifNoneMatch: !current.exists })
      return `${location.config.remotePath}/${path}`
    } catch (error) {
      if (attempt === 3 || !/PRECONDITION|412/i.test(String(error))) throw error
    }
  }
  throw new Error('Could not publish backup catalog')
}

export async function listLocationBackups(location: DataLocation): Promise<BackupEntry[]> {
  if (location.kind === 'local') return invoke('list_directory_backups', { directory: location.directory })
  const current = await readWebDavText(location.config, INDEX)
  const entries = current.exists ? parseIndex(current.text) : []
  const c = location.config
  const legacy = await invoke<BackupEntry | null>('inspect_legacy_webdav_backup', { config: {
    base_url: c.baseUrl, username: c.username, password: c.password, remote_path: c.remotePath, allow_invalid_cert: c.allowInvalidCert,
  } })
  if (legacy) entries.push(legacy)
  return entries
}

export async function resolveBackupFile(location: DataLocation, entry: BackupEntry): Promise<string> {
  if (location.kind === 'local') return entry.path
  if (entry.path !== 'oshinote-latest-full.oshi.zip' && entry.path !== `backups/${entry.name}`) throw new Error('Invalid backup path')
  const localPath = `sync-cache/restore-${crypto.randomUUID()}.oshi.zip`
  await downloadWebDavAppDataFile(location.config, entry.path, localPath)
  return join(await appDataDir(), localPath)
}
