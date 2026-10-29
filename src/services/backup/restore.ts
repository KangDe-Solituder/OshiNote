import { flushAppearance } from '../../stores/settingsWriter'
import Database from '@tauri-apps/plugin-sql'
import { invoke } from '@tauri-apps/api/core'
import { withClosedDatabase, migrateDatabase, checkpointDatabase } from '../../database'
import { validateResourceGraph } from '../../features/resources/resourceIntegrity'
import type { SyncRecord } from '../sync/syncModel'
import { BaseDirectory, readFile } from '@tauri-apps/plugin-fs'
import { sha256Bytes } from '../sync/syncModel'
import { withResourceFiles } from '../../features/resources/resourceFileLock'

export interface PreparedRestore {
  token: string; database_url: string; media_prefix: string; created_at: string
  app_version: string | null; database_schema_version: number; mode: string
}

export async function prepareRestore(path: string): Promise<PreparedRestore> {
  const prepared = await invoke<PreparedRestore>('prepare_backup_restore', { archivePath: path })
  let database: Database | undefined
  try {
    database = await Database.load(prepared.database_url)
    await migrateDatabase(database, prepared.media_prefix)
    const records: SyncRecord[] = []
    for (const table of ['resource_assets', 'resource_versions', 'journal_items', 'templates']) {
      const rows = await database.select<Record<string, unknown>[]>(`SELECT * FROM ${table}`)
      records.push(...rows.map(value => ({ key: `${table}:${value.id}`, table, id: String(value.id), value })))
    }
    validateResourceGraph(records)
    for (const record of records) {
      if (record.table !== 'resource_versions' || !record.value.file_path || !record.value.content_hash) continue
      const path = String(record.value.file_path)
      if (!path.startsWith('media/') || path.includes('..') || path.includes('\\')) throw new Error('Invalid resource path')
      const bytes = await readFile(`${prepared.media_prefix}/${path}`, { baseDir: BaseDirectory.AppData })
      if (await sha256Bytes(new Uint8Array(bytes)) !== record.value.content_hash) throw new Error(`Backup resource integrity check failed: ${path}`)
    }
    // A restored snapshot starts a new sync association; it must not retain a pending merge.
    await database.execute('DELETE FROM sync_state')
    await database.execute('DELETE FROM sync_conflicts')
    await checkpointDatabase(database)
    await database.close()
    database = undefined
    await invoke('validate_prepared_restore', { token: prepared.token })
    return prepared
  } catch (error) {
    if (database) await database.close().catch(() => undefined)
    await discardRestore(prepared).catch(() => undefined)
    throw error
  }
}

export async function discardRestore(prepared: PreparedRestore): Promise<void> {
  await invoke('discard_prepared_restore', { token: prepared.token })
}

export async function activateRestore(prepared: PreparedRestore): Promise<void> {
  await flushAppearance()
  await withResourceFiles(() => withClosedDatabase(() => invoke('activate_prepared_restore', { token: prepared.token })))
  window.location.reload()
}
