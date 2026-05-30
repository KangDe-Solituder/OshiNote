import Database from '@tauri-apps/plugin-sql'
import { MIGRATIONS } from './migrations'

let db: Database | null = null

export async function getDb(): Promise<Database> {
  if (db) return db
  db = await Database.load('sqlite:oshinote.db')
  await runMigrations(db)
  return db
}

async function runMigrations(db: Database): Promise<void> {
  for (const sql of MIGRATIONS) {
    await db.execute(sql)
  }
  await ensureOshiProfileColumns(db)
  await rebuildNoteSearchIndex(db)
}

async function ensureOshiProfileColumns(db: Database): Promise<void> {
  const columns = await db.select<{ name: string }[]>('PRAGMA table_info(oshis)')
  const columnNames = new Set(columns.map((column) => column.name))

  if (!columnNames.has('description')) {
    await db.execute("ALTER TABLE oshis ADD COLUMN description TEXT NOT NULL DEFAULT ''")
  }
  if (!columnNames.has('activity_links')) {
    await db.execute("ALTER TABLE oshis ADD COLUMN activity_links TEXT NOT NULL DEFAULT '[]'")
  }
}

async function rebuildNoteSearchIndex(db: Database): Promise<void> {
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM settings WHERE key = 'ftsIndexRebuilt'"
  )

  if (rows[0]?.value !== '1') {
    await db.execute("INSERT INTO notes_fts(notes_fts) VALUES ('rebuild')")
    await db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('ftsIndexRebuilt', '1')")
  }
}

export function generateId(): string {
  return crypto.randomUUID()
}
