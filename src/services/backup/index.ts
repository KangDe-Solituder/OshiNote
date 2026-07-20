import { invoke, isTauri } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import { relaunch } from '@tauri-apps/plugin-process'
import { closeDb } from '../../database'

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

  await closeDb()
  return invoke<BackupSummary>('create_backup', {
    destination: path,
    include_media: mode === 'complete',
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
  await relaunch()
  return null
}
