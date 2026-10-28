import type Database from '@tauri-apps/plugin-sql'

// Versions are append-only. Library metadata may change without rewriting a page.
export const RESOURCE_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS resource_assets (
    id TEXT PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL,
    source TEXT NOT NULL, current_version_id TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}', archived INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS resource_versions (
    id TEXT PRIMARY KEY, asset_id TEXT NOT NULL, renderer TEXT NOT NULL,
    payload TEXT NOT NULL, file_path TEXT, content_hash TEXT,
    FOREIGN KEY (asset_id) REFERENCES resource_assets(id) ON DELETE RESTRICT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_resource_versions_asset ON resource_versions(asset_id)`,
  `CREATE TRIGGER IF NOT EXISTS immutable_resource_versions BEFORE UPDATE ON resource_versions
    WHEN OLD.asset_id IS NOT NEW.asset_id OR OLD.renderer IS NOT NEW.renderer
      OR OLD.payload IS NOT NEW.payload OR OLD.file_path IS NOT NEW.file_path
      OR OLD.content_hash IS NOT NEW.content_hash
    BEGIN SELECT RAISE(ABORT, 'Resource versions are immutable'); END`,
  `CREATE TRIGGER IF NOT EXISTS retain_resource_versions BEFORE DELETE ON resource_versions
    BEGIN SELECT RAISE(ABORT, 'Resource history must be retained'); END`,
] as const

export async function ensureResourceSchema(db: Database) {
  for (const sql of RESOURCE_SCHEMA) await db.execute(sql)
  const columns = await db.select<{ name: string }[]>('PRAGMA table_info(journal_images)')
  if (!columns.some(column => column.name === 'archived')) {
    await db.execute('ALTER TABLE journal_images ADD COLUMN archived INTEGER NOT NULL DEFAULT 0')
  }
}
