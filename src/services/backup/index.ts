import { invoke, isTauri } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import { closeDb, getDb } from '../../database'

export type BackupMode = 'data' | 'complete'

export interface BackupSummary {
  mode: BackupMode
  path: string
  included_paths: string[]
}

function requireTauri(): void {
  if (!isTauri()) throw new Error('Backup and restore are available in the desktop app.')
}

function selectedPath(value: string | string[] | null): string | null {
  return Array.isArray(value) ? value[0] || null : value
}

export async function exportBackup(mode: BackupMode): Promise<BackupSummary | null> {
  requireTauri()
  const path = selectedPath(await save({
    defaultPath: `oshinote-${mode}-backup.oshi.zip`,
    filters: [{ name: 'OshiNote backup', extensions: ['zip'] }],
  }))
  if (!path) return null

  const syncMetadata = await readBackupSyncMetadata()
  await closeDb()
  return invoke<BackupSummary>('create_backup', {
    destination: path,
    include_media: mode === 'complete',
    sync_metadata: syncMetadata,
  })
}

export async function importBackup(): Promise<BackupSummary | null> {
  requireTauri()
  const path = selectedPath(await open({
    multiple: false,
    directory: false,
    filters: [{ name: 'OshiNote backup', extensions: ['zip'] }],
  }))
  if (!path) return null

  await closeDb()
  await invoke<BackupSummary>('restore_backup', { archive_path: path })
  window.location.reload()
  return null
}

async function readBackupSyncMetadata() {
  const db = await getDb()
  const rows = await db.select<{ value: string }[]>("SELECT value FROM sync_state WHERE key = 'repository'")
  if (!rows[0]?.value) return null
  try {
    const state = JSON.parse(rows[0].value) as { repository_id?: string; head?: string | null }
    return {
      repository_id: state.repository_id || null,
      head_commit: null,
      schema_version: 1,
    }
  } catch {
    return null
  }
}
