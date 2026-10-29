import { flushAppearance } from '../../stores/settingsWriter'
import { reconcileResourceLibrary } from '../../features/resources/resourceLibrary'
import { SYNC_SCHEMA_VERSION } from '../sync/syncModel'
import { getDb } from '../../database'

export type BackupMode = 'data' | 'complete'

export interface BackupSummary {
  mode: BackupMode
  path: string
  included_paths: string[]
}

export async function readBackupSyncMetadata() {
  await flushAppearance()
  const db = await getDb()
  const rows = await db.select<{ value: string }[]>("SELECT value FROM sync_state WHERE key = 'repository'")
  await reconcileResourceLibrary(db)
  if (!rows[0]?.value) return { repository_id: null, head_commit: null, schema_version: SYNC_SCHEMA_VERSION }
  try {
    const state = JSON.parse(rows[0].value) as { repository_id?: string; head?: string | null }
    return {
      repository_id: state.repository_id || null,
      head_commit: state.head || null,
      schema_version: SYNC_SCHEMA_VERSION,
    }
  } catch {
    return { repository_id: null, head_commit: null, schema_version: SYNC_SCHEMA_VERSION }
  }
}
