import { withResourceFiles } from './resourceFileLock'
import { BaseDirectory, exists, readDir, remove, stat } from '@tauri-apps/plugin-fs'
import { getDb } from '../../database'

export interface CleanupCandidate { path: string; size: number; modified: number }
const ROOTS = ['media/resources', 'media/journal']
const NAME = /^[a-f0-9-]{36}\.(png|jpg|webp|gif)$/i
export function isOrphanCandidate(name: string, modified: number, referenced: boolean, now = Date.now()) {
  return NAME.test(name) && !referenced && Number.isFinite(modified) && modified < now - 24 * 60 * 60 * 1000
}
async function referenceText() {
  const db = await getDb()
  const records = await db.select<{ value: string }[]>(`SELECT file_path AS value FROM resource_versions WHERE file_path IS NOT NULL
    UNION ALL SELECT file_path FROM journal_images
    UNION ALL SELECT original_path FROM illustrations
    UNION ALL SELECT thumbnail_path FROM illustrations WHERE thumbnail_path IS NOT NULL
    UNION ALL SELECT material_snapshot FROM journal_items
    UNION ALL SELECT style_payload FROM journal_items
    UNION ALL SELECT payload FROM templates
    UNION ALL SELECT value FROM sync_state
    UNION ALL SELECT data_url FROM note_images`)
  const drafts: string[] = []
  if (typeof localStorage !== 'undefined') for (let i=0;i<localStorage.length;i++) { const key=localStorage.key(i); if (key?.startsWith('oshinote.journalDraft.')) drafts.push(localStorage.getItem(key) || '') }
  return [...records.map(row => row.value || ''), ...drafts].join('\n').replaceAll('\\\\', '/')
}
export async function inspectResourceCleanup(): Promise<CleanupCandidate[]> {
  const references = await referenceText()
  const result: CleanupCandidate[] = []
  for (const root of ROOTS) {
    if (!await exists(root, { baseDir: BaseDirectory.AppData })) continue
    for (const entry of await readDir(root, { baseDir: BaseDirectory.AppData })) {
      if (!entry.isFile || entry.isSymlink || !NAME.test(entry.name)) continue
      const path = `${root}/${entry.name}`
      const info = await stat(path, { baseDir: BaseDirectory.AppData })
      const modified = info.mtime?.getTime() ?? Date.now()
      if (isOrphanCandidate(entry.name, modified, references.includes(path))) result.push({ path, size: info.size, modified })
    }
  }
  return result
}
async function cleanResourceFilesUnlocked(selected: CleanupCandidate[]) {
  // Re-scan immediately before removal; a stale UI selection never authorizes deleting a newly referenced file.
  const available = await inspectResourceCleanup()
  const keys = new Set(selected.map(item => `${item.path}:${item.size}:${item.modified}`))
  let removed = 0
  for (const item of available) {
    if (!keys.has(`${item.path}:${item.size}:${item.modified}`)) continue
    if ((await referenceText()).includes(item.path)) continue
    await remove(item.path, { baseDir: BaseDirectory.AppData })
    removed++
  }
  return removed
}

export function cleanResourceFiles(selected: CleanupCandidate[]) { return withResourceFiles(() => cleanResourceFilesUnlocked(selected)) }
