import Database from '@tauri-apps/plugin-sql'
import { invoke } from '@tauri-apps/api/core'
import { MIGRATIONS } from './migrations'
import { ensureResourceSchema } from '../features/resources/resourceSchema'
import { reconcileResourceLibrary } from '../features/resources/resourceLibrary'
import { loadMaterialLibrary } from '../features/resources/resourceManagement'
import { measureStartup, markStartup } from '../services/startup'

let db: Database | null = null
let dbPromise: Promise<Database> | null = null
let maintenance = false
export const DATABASE_SCHEMA_VERSION = 2

export async function getDb(): Promise<Database> {
  if (maintenance) throw new Error('Database maintenance is in progress. Please wait.')
  if (db) return db
  if (!dbPromise) {
    dbPromise = initializeDb()
  }
  return dbPromise
}

// Keep background reads/writes from reopening SQLite while its file is copied or replaced.
export async function withClosedDatabase<T>(work: () => Promise<T>): Promise<T> {
  if (maintenance) throw new Error('Database maintenance is already in progress.')
  maintenance = true
  try {
    const current = db || (dbPromise ? await dbPromise : null)
    if (current) await checkpointDatabase(current)
    await closeDb()
    return await work()
  } finally { maintenance = false }
}

export async function checkpointDatabase(database: Database): Promise<void> {
  const [result] = await database.select<{ busy: number; log: number; checkpointed: number }[]>('PRAGMA wal_checkpoint(TRUNCATE)')
  if (result?.busy || (result && result.log > result.checkpointed)) throw new Error('Database is busy. Wait for other operations to finish and try again.')
}

export async function closeDb(): Promise<void> {
  const current = db
  db = null
  dbPromise = null
  if (current) await current.close()
}

async function initializeDb(): Promise<Database> {
  let database: Database | null = null
  try {
    await invoke('ensure_database_available')
    database = await measureStartup('database-open', () => Database.load('sqlite:oshinote.db'))
    const opened = database
    await measureStartup('database-initialize', () => runMigrations(opened))
    db = database
    markStartup('database-ready')
    return database
  } catch (error) {
    dbPromise = null
    if (database) await database.close().catch(() => undefined)
    throw error
  }
}

async function runMigrations(db: Database): Promise<void> {
  await migrateDatabase(db)
  await measureStartup('material-library', () => loadMaterialLibrary(db))
}

// Also runs against an isolated restore database before it is activated.
export async function migrateDatabase(database: Database, mediaPrefix = ''): Promise<void> {
  const token = await invoke<string>('begin_database_migration', { databaseUrl: database.path })
  const db = Object.assign(Object.create(database) as Database, {
    execute: (query: string, values: unknown[] = []) => invoke('migration_query', { token, query, values, select: false }),
    select: (query: string, values: unknown[] = []) => invoke('migration_query', { token, query, values, select: true }),
  })
  try {
    await migrateOnConnection(db, mediaPrefix)
    await invoke('finish_database_migration', { token, commit: true })
  } catch (error) {
    await invoke('finish_database_migration', { token, commit: false }).catch(() => undefined)
    throw error
  }
}

export async function migrateOnConnection(db: Database, mediaPrefix = ''): Promise<void> {
  const [version] = await db.select<{ user_version: number }[]>('PRAGMA user_version')
  if ((version?.user_version || 0) > DATABASE_SCHEMA_VERSION) throw new Error('This database requires a newer OshiNote version.')
  await recoverInterruptedJournalMigrations(db)
  await measureStartup('migration-recovery', () => recoverInterruptedNoteOwnershipMigration(db))
  await measureStartup('schema-checks', async () => {
    for (const sql of MIGRATIONS) {
      await db.execute(sql)
    }
    await ensureOshiProfileColumns(db)
    await ensureOshiAnniversaries(db)
    await ensureNoteSourceUrl(db)
    await ensureOptionalNoteOwnership(db)
    await ensureJournalBooksSchema(db)
    await ensureJournalPagesPostcardSchema(db)
    await ensureJournalPagesOrientationSchema(db)
    await ensureJournalItemsAssetSchema(db)
    await ensureJournalItemsMaterialSchema(db)
    await ensureJournalItemsStaged(db)
    await ensureJournalImages(db)
    await ensureScheduleTables(db)
    await ensureResourceSchema(db)
  })
  await measureStartup('resource-reconcile', () => reconcileResourceLibrary(db, mediaPrefix))
  await measureStartup('search-index', () => rebuildNoteSearchIndex(db))
  await db.execute("DELETE FROM settings WHERE key = 'aiConfig' OR lower(key) LIKE '%webdav%' OR lower(key) LIKE '%credential%' OR lower(key) LIKE '%apikey%'")
  await db.execute('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)')
  await db.execute('INSERT OR IGNORE INTO schema_migrations (version) VALUES (2)')
  await db.execute(`PRAGMA user_version = ${DATABASE_SCHEMA_VERSION}`)
}

async function ensureOshiAnniversaries(db: Database): Promise<void> {
  const columns = await db.select<{ name: string }[]>('PRAGMA table_info(oshis)')
  if (!columns.some((column) => column.name === 'anniversaries')) {
    await db.execute("ALTER TABLE oshis ADD COLUMN anniversaries TEXT NOT NULL DEFAULT '[]'")
  }
}

async function ensureScheduleTables(db: Database): Promise<void> {
  await db.execute(`CREATE TABLE IF NOT EXISTS oshi_schedules (
    id         TEXT PRIMARY KEY,
    oshi_id    TEXT NOT NULL,
    title      TEXT NOT NULL DEFAULT '',
    archive_id TEXT NOT NULL DEFAULT '',
    kind       TEXT NOT NULL DEFAULT 'once',
    weekday    INTEGER,
    date       TEXT,
    time       TEXT,
    status     TEXT NOT NULL DEFAULT 'active',
    note_id    TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (oshi_id) REFERENCES oshis(id) ON DELETE CASCADE
  )`)

  const scheduleColumns = await db.select<{ name: string }[]>('PRAGMA table_info(oshi_schedules)')
  const scheduleColumnNames = new Set(scheduleColumns.map((column) => column.name))
  if (scheduleColumnNames.has('platform') && !scheduleColumnNames.has('archive_id')) {
    await db.execute('ALTER TABLE oshi_schedules RENAME COLUMN platform TO archive_id')
  }
  await db.execute(`CREATE TABLE IF NOT EXISTS oshi_schedule_overrides (
    id          TEXT PRIMARY KEY,
    schedule_id TEXT NOT NULL,
    date        TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'done',
    note_id     TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (schedule_id) REFERENCES oshi_schedules(id) ON DELETE CASCADE
  )`)
  await db.execute('CREATE INDEX IF NOT EXISTS idx_oshi_schedules_oshi ON oshi_schedules(oshi_id, kind)')
  await db.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_overrides_unique ON oshi_schedule_overrides(schedule_id, date)')
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

async function ensureNoteSourceUrl(db: Database): Promise<void> {
  const columns = await db.select<{ name: string }[]>('PRAGMA table_info(notes)')
  const columnNames = new Set(columns.map((column) => column.name))

  if (!columnNames.has('source_url')) {
    await db.execute("ALTER TABLE notes ADD COLUMN source_url TEXT NOT NULL DEFAULT ''")
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

async function ensureJournalBooksSchema(db: Database): Promise<void> {
  await db.execute(`CREATE TABLE IF NOT EXISTS journal_books (
    id          TEXT PRIMARY KEY,
    oshi_id     TEXT NOT NULL,
    title       TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    cover_style TEXT NOT NULL DEFAULT 'classic',
    cover_color TEXT NOT NULL DEFAULT '#8B5CF6',
    cover_decoration TEXT NOT NULL DEFAULT 'none',
    date_label TEXT NOT NULL DEFAULT '',
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (oshi_id) REFERENCES oshis(id) ON DELETE CASCADE
  )`)

  const bookColumns = await db.select<{ name: string }[]>('PRAGMA table_info(journal_books)')
  const bookColumnNames = new Set(bookColumns.map((column) => column.name))
  if (!bookColumnNames.has('cover_decoration')) {
    await db.execute("ALTER TABLE journal_books ADD COLUMN cover_decoration TEXT NOT NULL DEFAULT 'none'")
  }
  if (!bookColumnNames.has('date_label')) {
    await db.execute("ALTER TABLE journal_books ADD COLUMN date_label TEXT NOT NULL DEFAULT ''")
  }

  const columns = await db.select<{ name: string }[]>('PRAGMA table_info(journal_pages)')
  if (columns.some((column) => column.name === 'archive_id')) {
    await db.execute('PRAGMA foreign_keys = OFF')
    try {
      await db.execute(`INSERT OR IGNORE INTO journal_books
        (id, oshi_id, title, sort_order, created_at, updated_at)
        SELECT a.id, a.oshi_id, a.name, a.sort_order, a.created_at, datetime('now', 'localtime')
        FROM archives a
        WHERE EXISTS (SELECT 1 FROM journal_pages p WHERE p.archive_id = a.id)`)
      await db.execute('DROP TABLE IF EXISTS journal_pages_v2')
      await db.execute(`CREATE TABLE journal_pages_v2 (
        id          TEXT PRIMARY KEY,
        book_id     TEXT,
        oshi_id     TEXT NOT NULL DEFAULT '',
        page_type   TEXT NOT NULL DEFAULT 'book_page',
        title       TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        date_label  TEXT NOT NULL DEFAULT '',
        standalone  INTEGER NOT NULL DEFAULT 0,
        page_index  INTEGER NOT NULL DEFAULT 0,
        background  TEXT NOT NULL DEFAULT 'paper',
        orientation TEXT NOT NULL DEFAULT 'portrait',
        created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        updated_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (book_id) REFERENCES journal_books(id) ON DELETE CASCADE,
        FOREIGN KEY (oshi_id) REFERENCES oshis(id) ON DELETE CASCADE
      )`)
      await db.execute(`INSERT INTO journal_pages_v2
        (id, book_id, oshi_id, page_type, title, page_index, background, orientation, created_at, updated_at)
        SELECT p.id, p.archive_id, COALESCE(a.oshi_id, ''), 'book_page', p.title, p.page_index, p.background, 'portrait', p.created_at, p.updated_at
        FROM journal_pages p
        LEFT JOIN archives a ON a.id = p.archive_id`)
      await db.execute('DROP TABLE journal_pages')
      await db.execute('ALTER TABLE journal_pages_v2 RENAME TO journal_pages')
    } finally {
      await db.execute('PRAGMA foreign_keys = ON')
    }
  }

  await db.execute('CREATE INDEX IF NOT EXISTS idx_journal_books_oshi ON journal_books(oshi_id, sort_order)')
  await db.execute('CREATE INDEX IF NOT EXISTS idx_journal_pages_book ON journal_pages(book_id, page_index)')
}

async function ensureJournalPagesPostcardSchema(db: Database): Promise<void> {
  const columns = await db.select<{ name: string; notnull: number }[]>('PRAGMA table_info(journal_pages)')
  if (columns.length === 0) return
  const columnNames = new Set(columns.map((column) => column.name))
  const bookId = columns.find((column) => column.name === 'book_id')
  const compatible = columnNames.has('oshi_id') &&
    columnNames.has('page_type') &&
    columnNames.has('description') &&
    columnNames.has('date_label') &&
    columnNames.has('standalone') &&
    columnNames.has('orientation') &&
    bookId?.notnull === 0

  if (!compatible) {
    const oshiSelect = columnNames.has('oshi_id') ? "COALESCE(p.oshi_id, jb.oshi_id, '')" : "COALESCE(jb.oshi_id, '')"
    const pageTypeSelect = columnNames.has('page_type') ? "COALESCE(p.page_type, 'book_page')" : "'book_page'"
    const descriptionSelect = columnNames.has('description') ? "COALESCE(p.description, '')" : "''"
    const dateLabelSelect = columnNames.has('date_label') ? "COALESCE(p.date_label, '')" : "''"
    const standaloneSelect = columnNames.has('standalone') ? 'COALESCE(p.standalone, 0)' : '0'
    const orientationSelect = columnNames.has('orientation') ? "COALESCE(p.orientation, 'portrait')" : "'portrait'"
    await db.execute('PRAGMA foreign_keys = OFF')
    try {
      await db.execute('DROP TABLE IF EXISTS journal_pages_v2')
      await db.execute(`CREATE TABLE journal_pages_v2 (
        id          TEXT PRIMARY KEY,
        book_id     TEXT,
        oshi_id     TEXT NOT NULL DEFAULT '',
        page_type   TEXT NOT NULL DEFAULT 'book_page',
        title       TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        date_label  TEXT NOT NULL DEFAULT '',
        standalone  INTEGER NOT NULL DEFAULT 0,
        page_index  INTEGER NOT NULL DEFAULT 0,
        background  TEXT NOT NULL DEFAULT 'paper',
        orientation TEXT NOT NULL DEFAULT 'portrait',
        created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        updated_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (book_id) REFERENCES journal_books(id) ON DELETE CASCADE,
        FOREIGN KEY (oshi_id) REFERENCES oshis(id) ON DELETE CASCADE
      )`)
      await db.execute(`INSERT INTO journal_pages_v2
        (id, book_id, oshi_id, page_type, title, description, date_label, standalone, page_index, background, orientation, created_at, updated_at)
        SELECT
          p.id,
          p.book_id,
          ${oshiSelect},
          ${pageTypeSelect},
          p.title,
          ${descriptionSelect},
          ${dateLabelSelect},
          ${standaloneSelect},
          p.page_index,
          p.background,
          ${orientationSelect},
          p.created_at,
          p.updated_at
        FROM journal_pages p
        LEFT JOIN journal_books jb ON jb.id = p.book_id`)
      await db.execute('DROP TABLE journal_pages')
      await db.execute('ALTER TABLE journal_pages_v2 RENAME TO journal_pages')
    } finally {
      await db.execute('PRAGMA foreign_keys = ON')
    }
  }

  await db.execute(`UPDATE journal_pages
    SET oshi_id = COALESCE((SELECT oshi_id FROM journal_books WHERE journal_books.id = journal_pages.book_id), oshi_id)
    WHERE oshi_id = '' AND book_id IS NOT NULL`)
  await db.execute('CREATE INDEX IF NOT EXISTS idx_journal_pages_book ON journal_pages(book_id, page_index)')
  await db.execute('CREATE INDEX IF NOT EXISTS idx_journal_pages_oshi ON journal_pages(oshi_id, standalone, updated_at)')
  await db.execute('CREATE INDEX IF NOT EXISTS idx_journal_pages_type ON journal_pages(page_type, standalone)')
}

async function ensureJournalPagesOrientationSchema(db: Database): Promise<void> {
  const columns = await db.select<{ name: string }[]>('PRAGMA table_info(journal_pages)')
  if (columns.length === 0) return
  const columnNames = new Set(columns.map((column) => column.name))
  if (!columnNames.has('orientation')) {
    await db.execute("ALTER TABLE journal_pages ADD COLUMN orientation TEXT NOT NULL DEFAULT 'portrait'")
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
      source_url TEXT NOT NULL DEFAULT '',
      tags       TEXT NOT NULL DEFAULT '[]',
      favorite   INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (oshi_id) REFERENCES oshis(id) ON DELETE SET NULL,
      FOREIGN KEY (archive_id) REFERENCES archives(id) ON DELETE SET NULL
    )`)
    await db.execute(`INSERT INTO notes_v2
      (id, oshi_id, archive_id, title, content, plain_text, source_url, tags, favorite, created_at, updated_at)
      SELECT id, oshi_id, archive_id, title, content, plain_text, source_url, tags, favorite, created_at, updated_at
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

async function ensureJournalItemsAssetSchema(db: Database): Promise<void> {
  const columns = await db.select<{ name: string; notnull: number }[]>('PRAGMA table_info(journal_items)')
  if (columns.length === 0) return
  const columnNames = new Set(columns.map((column) => column.name))
  const noteId = columns.find((column) => column.name === 'note_id')
  if (columnNames.has('illustration_id') && noteId?.notnull === 0) {
    await db.execute('CREATE INDEX IF NOT EXISTS idx_journal_items_illustration ON journal_items(illustration_id)')
    await db.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_items_page_illustration ON journal_items(page_id, illustration_id)')
    return
  }

  await db.execute('PRAGMA foreign_keys = OFF')
  try {
    await db.execute('DROP TABLE IF EXISTS journal_items_v2')
    await db.execute(`CREATE TABLE journal_items_v2 (
      id              TEXT PRIMARY KEY,
      page_id         TEXT NOT NULL,
      note_id         TEXT,
      illustration_id TEXT,
      item_type       TEXT NOT NULL DEFAULT 'note',
      x               REAL NOT NULL DEFAULT 0,
      y               REAL NOT NULL DEFAULT 0,
      width           REAL NOT NULL DEFAULT 240,
      height          REAL NOT NULL DEFAULT 180,
      rotation        REAL NOT NULL DEFAULT 0,
      z_index         INTEGER NOT NULL DEFAULT 0,
      sticker_style   TEXT NOT NULL DEFAULT 'sticky',
      color           TEXT,
      border_style    TEXT,
      material_id     TEXT,
      material_snapshot TEXT NOT NULL DEFAULT '{}',
      style_payload   TEXT NOT NULL DEFAULT '{}',
      created_at      TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (page_id) REFERENCES journal_pages(id) ON DELETE CASCADE,
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
      FOREIGN KEY (illustration_id) REFERENCES illustrations(id) ON DELETE CASCADE
    )`)
    await db.execute(`INSERT INTO journal_items_v2
      (id, page_id, note_id, illustration_id, item_type, x, y, width, height, rotation, z_index, sticker_style, color, border_style, material_id, material_snapshot, style_payload, created_at, updated_at)
      SELECT id, page_id, note_id, NULL, item_type, x, y, width, height, rotation, z_index, sticker_style, color, border_style, NULL, '{}', '{}', created_at, updated_at
      FROM journal_items`)
    await db.execute('DROP TABLE journal_items')
    await db.execute('ALTER TABLE journal_items_v2 RENAME TO journal_items')
    await db.execute('CREATE INDEX IF NOT EXISTS idx_journal_items_page ON journal_items(page_id)')
    await db.execute('CREATE INDEX IF NOT EXISTS idx_journal_items_note ON journal_items(note_id)')
    await db.execute('CREATE INDEX IF NOT EXISTS idx_journal_items_illustration ON journal_items(illustration_id)')
    await db.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_items_page_note ON journal_items(page_id, note_id)')
    await db.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_items_page_illustration ON journal_items(page_id, illustration_id)')
  } finally {
    await db.execute('PRAGMA foreign_keys = ON')
  }
}

async function ensureJournalItemsMaterialSchema(db: Database): Promise<void> {
  const columns = await db.select<{ name: string }[]>('PRAGMA table_info(journal_items)')
  if (columns.length === 0) return
  const columnNames = new Set(columns.map((column) => column.name))

  if (!columnNames.has('material_id')) {
    await db.execute('ALTER TABLE journal_items ADD COLUMN material_id TEXT')
  }
  if (!columnNames.has('material_snapshot')) {
    await db.execute("ALTER TABLE journal_items ADD COLUMN material_snapshot TEXT NOT NULL DEFAULT '{}'")
  }
  if (!columnNames.has('style_payload')) {
    await db.execute("ALTER TABLE journal_items ADD COLUMN style_payload TEXT NOT NULL DEFAULT '{}'")
  }
}

async function ensureJournalItemsStaged(db: Database): Promise<void> {
  const columns = await db.select<{ name: string }[]>('PRAGMA table_info(journal_items)')
  if (!columns.some((column) => column.name === 'staged')) {
    await db.execute('ALTER TABLE journal_items ADD COLUMN staged INTEGER NOT NULL DEFAULT 0')
  }
}

async function ensureJournalImages(db: Database): Promise<void> {
  await db.execute(`CREATE TABLE IF NOT EXISTS journal_images (
    id                 TEXT PRIMARY KEY,
    oshi_id            TEXT,
    file_path          TEXT NOT NULL,
    original_filename  TEXT NOT NULL DEFAULT '',
    mime_type          TEXT NOT NULL DEFAULT 'image/png',
    file_size          INTEGER NOT NULL DEFAULT 0,
    width              INTEGER,
    height             INTEGER,
    created_at         TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (oshi_id) REFERENCES oshis(id) ON DELETE SET NULL
  )`)
  await ensureJournalImageOwnershipForeignKey(db)

  const itemColumns = await db.select<{ name: string }[]>('PRAGMA table_info(journal_items)')
  if (itemColumns.length > 0 && !itemColumns.some((column) => column.name === 'journal_image_id')) {
    await db.execute('ALTER TABLE journal_items ADD COLUMN journal_image_id TEXT REFERENCES journal_images(id) ON DELETE CASCADE')
  }
  await ensureJournalItemImageForeignKey(db)
  await db.execute('CREATE INDEX IF NOT EXISTS idx_journal_images_oshi ON journal_images(oshi_id)')
  await db.execute('CREATE INDEX IF NOT EXISTS idx_journal_items_journal_image ON journal_items(journal_image_id)')
  await db.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_items_page_journal_image ON journal_items(page_id, journal_image_id)')
}

interface ForeignKeyInfo {
  table: string
  from: string
  on_delete: string
}

async function ensureJournalImageOwnershipForeignKey(db: Database): Promise<void> {
  const foreignKeys = await db.select<ForeignKeyInfo[]>('PRAGMA foreign_key_list(journal_images)')
  const hasOwnershipForeignKey = foreignKeys.some((key) => (
    key.table === 'oshis' && key.from === 'oshi_id' && key.on_delete.toUpperCase() === 'SET NULL'
  ))
  if (hasOwnershipForeignKey) return

  await db.execute('PRAGMA foreign_keys = OFF')
  try {
    await db.execute('DROP TABLE IF EXISTS journal_images_v2')
    await db.execute(`CREATE TABLE journal_images_v2 (
      id                 TEXT PRIMARY KEY,
      oshi_id            TEXT,
      file_path          TEXT NOT NULL,
      original_filename  TEXT NOT NULL DEFAULT '',
      mime_type          TEXT NOT NULL DEFAULT 'image/png',
      file_size          INTEGER NOT NULL DEFAULT 0,
      width              INTEGER,
      height             INTEGER,
      created_at         TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (oshi_id) REFERENCES oshis(id) ON DELETE SET NULL
    )`)
    await db.execute(`INSERT INTO journal_images_v2
      (id, oshi_id, file_path, original_filename, mime_type, file_size, width, height, created_at)
      SELECT id,
             CASE WHEN oshi_id IS NULL OR EXISTS (SELECT 1 FROM oshis WHERE oshis.id = journal_images.oshi_id) THEN oshi_id ELSE NULL END,
             file_path, original_filename, mime_type, file_size, width, height, created_at
      FROM journal_images`)
    await db.execute('DROP TABLE journal_images')
    await db.execute('ALTER TABLE journal_images_v2 RENAME TO journal_images')
  } finally {
    await db.execute('PRAGMA foreign_keys = ON')
  }
}

async function ensureJournalItemImageForeignKey(db: Database): Promise<void> {
  const columns = await db.select<{ name: string }[]>('PRAGMA table_info(journal_items)')
  if (!columns.some((column) => column.name === 'journal_image_id')) return
  const foreignKeys = await db.select<ForeignKeyInfo[]>('PRAGMA foreign_key_list(journal_items)')
  const hasImageForeignKey = foreignKeys.some((key) => (
    key.table === 'journal_images' && key.from === 'journal_image_id' && key.on_delete.toUpperCase() === 'CASCADE'
  ))
  if (hasImageForeignKey) return

  await db.execute('PRAGMA foreign_keys = OFF')
  try {
    await db.execute('DROP TABLE IF EXISTS journal_items_v3')
    await db.execute(`CREATE TABLE journal_items_v3 (
      id                TEXT PRIMARY KEY,
      page_id           TEXT NOT NULL,
      note_id           TEXT,
      illustration_id   TEXT,
      journal_image_id  TEXT,
      item_type         TEXT NOT NULL DEFAULT 'note',
      x                 REAL NOT NULL DEFAULT 0,
      y                 REAL NOT NULL DEFAULT 0,
      width             REAL NOT NULL DEFAULT 240,
      height            REAL NOT NULL DEFAULT 180,
      rotation          REAL NOT NULL DEFAULT 0,
      z_index           INTEGER NOT NULL DEFAULT 0,
      staged            INTEGER NOT NULL DEFAULT 0,
      sticker_style     TEXT NOT NULL DEFAULT 'sticky',
      color             TEXT,
      border_style      TEXT,
      material_id       TEXT,
      material_snapshot TEXT NOT NULL DEFAULT '{}',
      style_payload     TEXT NOT NULL DEFAULT '{}',
      created_at        TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at        TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (page_id) REFERENCES journal_pages(id) ON DELETE CASCADE,
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
      FOREIGN KEY (illustration_id) REFERENCES illustrations(id) ON DELETE CASCADE,
      FOREIGN KEY (journal_image_id) REFERENCES journal_images(id) ON DELETE CASCADE
    )`)
    await db.execute(`INSERT INTO journal_items_v3
      (id, page_id, note_id, illustration_id, journal_image_id, item_type, x, y, width, height, rotation, z_index, staged, sticker_style, color, border_style, material_id, material_snapshot, style_payload, created_at, updated_at)
      SELECT ji.id, ji.page_id, ji.note_id, ji.illustration_id, ji.journal_image_id, ji.item_type,
             ji.x, ji.y, ji.width, ji.height, ji.rotation, ji.z_index, ji.staged, ji.sticker_style,
             ji.color, ji.border_style, ji.material_id, ji.material_snapshot, ji.style_payload, ji.created_at, ji.updated_at
      FROM journal_items ji
      WHERE ji.journal_image_id IS NULL
         OR EXISTS (SELECT 1 FROM journal_images WHERE journal_images.id = ji.journal_image_id)`)
    await db.execute('DROP TABLE journal_items')
    await db.execute('ALTER TABLE journal_items_v3 RENAME TO journal_items')
    await db.execute('CREATE INDEX IF NOT EXISTS idx_journal_items_page ON journal_items(page_id)')
    await db.execute('CREATE INDEX IF NOT EXISTS idx_journal_items_note ON journal_items(note_id)')
    await db.execute('CREATE INDEX IF NOT EXISTS idx_journal_items_illustration ON journal_items(illustration_id)')
    await db.execute('CREATE INDEX IF NOT EXISTS idx_journal_items_journal_image ON journal_items(journal_image_id)')
    await db.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_items_page_note ON journal_items(page_id, note_id)')
    await db.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_items_page_illustration ON journal_items(page_id, illustration_id)')
    await db.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_items_page_journal_image ON journal_items(page_id, journal_image_id)')
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

// Preserve a replacement left by an older non-transactional build before CREATE IF NOT EXISTS.
async function recoverInterruptedJournalMigrations(db: Database): Promise<void> {
  for (const [table, replacements] of [
    ['journal_pages', ['journal_pages_v2', 'journal_pages_v3']],
    ['journal_items', ['journal_items_v2', 'journal_items_v3']],
    ['journal_images', ['journal_images_v2']],
  ] as const) {
    const rows = await db.select<{ name: string }[]>("SELECT name FROM sqlite_master WHERE type = 'table'")
    const names = new Set(rows.map(row => row.name))
    const existing = replacements.filter(name => names.has(name))
    if (!existing.length) continue
    if (names.has(table)) {
      // Ambiguous old remnants require inspection, never silently discard possible user data.
      for (const name of existing) {
        const [missing] = await db.select<{ count: number }[]>(`SELECT COUNT(*) AS count FROM ${name} WHERE id NOT IN (SELECT id FROM ${table})`)
        if (missing.count) throw new Error(`Interrupted migration contains additional records in ${name}. Original files are preserved.`)
      }
    } else if (existing.length === 1) {
      await db.execute(`ALTER TABLE ${existing[0]} RENAME TO ${table}`)
    } else throw new Error(`Multiple interrupted replacements for ${table}. Original files are preserved.`)
  }
}
