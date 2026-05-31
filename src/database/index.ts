import Database from '@tauri-apps/plugin-sql'
import { MIGRATIONS } from './migrations'

let db: Database | null = null
let dbPromise: Promise<Database> | null = null

export async function getDb(): Promise<Database> {
  if (db) return db
  if (!dbPromise) {
    dbPromise = initializeDb()
  }
  return dbPromise
}

async function initializeDb(): Promise<Database> {
  const database = await Database.load('sqlite:oshinote.db')
  try {
    await recoverInterruptedNoteOwnershipMigration(database)
    await runMigrations(database)
    db = database
    return database
  } catch (error) {
    dbPromise = null
    throw error
  }
}

async function runMigrations(db: Database): Promise<void> {
  for (const sql of MIGRATIONS) {
    await db.execute(sql)
  }
  await ensureOshiProfileColumns(db)
  await ensureOptionalNoteOwnership(db)
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

async function ensureOptionalNoteOwnership(db: Database): Promise<void> {
  const columns = await db.select<{ name: string; notnull: number }[]>('PRAGMA table_info(notes)')
  const oshiId = columns.find((column) => column.name === 'oshi_id')
  const archiveId = columns.find((column) => column.name === 'archive_id')
  if (oshiId?.notnull === 0 && archiveId?.notnull === 0) return

  await db.execute('PRAGMA foreign_keys = OFF')
  try {
    await db.execute('DROP TRIGGER IF EXISTS notes_ai')
    await db.execute('DROP TRIGGER IF EXISTS notes_ad')
    await db.execute('DROP TRIGGER IF EXISTS notes_au')
    await db.execute(`CREATE TABLE notes_v2 (
      id         TEXT PRIMARY KEY,
      oshi_id    TEXT,
      archive_id TEXT,
      title      TEXT NOT NULL DEFAULT '',
      content    TEXT NOT NULL DEFAULT '{}',
      plain_text TEXT NOT NULL DEFAULT '',
      tags       TEXT NOT NULL DEFAULT '[]',
      favorite   INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (oshi_id) REFERENCES oshis(id) ON DELETE SET NULL,
      FOREIGN KEY (archive_id) REFERENCES archives(id) ON DELETE SET NULL
    )`)
    await db.execute(`INSERT INTO notes_v2
      (id, oshi_id, archive_id, title, content, plain_text, tags, favorite, created_at, updated_at)
      SELECT id, oshi_id, archive_id, title, content, plain_text, tags, favorite, created_at, updated_at
      FROM notes`)
    await db.execute('DROP TABLE notes')
    await db.execute('ALTER TABLE notes_v2 RENAME TO notes')
    await db.execute('CREATE INDEX IF NOT EXISTS idx_notes_oshi ON notes(oshi_id)')
    await db.execute('CREATE INDEX IF NOT EXISTS idx_notes_archive ON notes(archive_id)')
    await db.execute('CREATE INDEX IF NOT EXISTS idx_notes_created ON notes(created_at)')
    await db.execute(`CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
      INSERT INTO notes_fts(rowid, title, plain_text, tags)
      VALUES (new.rowid, new.title, new.plain_text, new.tags);
    END`)
    await db.execute(`CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
      INSERT INTO notes_fts(notes_fts, rowid, title, plain_text, tags)
      VALUES ('delete', old.rowid, old.title, old.plain_text, old.tags);
    END`)
    await db.execute(`CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
      INSERT INTO notes_fts(notes_fts, rowid, title, plain_text, tags)
      VALUES ('delete', old.rowid, old.title, old.plain_text, old.tags);
      INSERT INTO notes_fts(rowid, title, plain_text, tags)
      VALUES (new.rowid, new.title, new.plain_text, new.tags);
    END`)
    await db.execute("INSERT INTO notes_fts(notes_fts) VALUES ('rebuild')")
  } finally {
    await db.execute('PRAGMA foreign_keys = ON')
  }
}

async function recoverInterruptedNoteOwnershipMigration(db: Database): Promise<void> {
  const rows = await db.select<{ name: string }[]>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('notes', 'notes_v2')"
  )
  const tables = new Set(rows.map((row) => row.name))

  if (!tables.has('notes') && tables.has('notes_v2')) {
    await db.execute('ALTER TABLE notes_v2 RENAME TO notes')
    return
  }

  if (tables.has('notes') && tables.has('notes_v2')) {
    await db.execute(`INSERT OR IGNORE INTO notes
      (id, oshi_id, archive_id, title, content, plain_text, tags, favorite, created_at, updated_at)
      SELECT id, oshi_id, archive_id, title, content, plain_text, tags, favorite, created_at, updated_at
      FROM notes_v2`)
    await db.execute('DROP TABLE notes_v2')
  }
}

export function generateId(): string {
  return crypto.randomUUID()
}
