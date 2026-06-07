export const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS oshis (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    avatar     TEXT,
    color      TEXT,
    description TEXT NOT NULL DEFAULT '',
    activity_links TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  )`,

  `CREATE TABLE IF NOT EXISTS archives (
    id         TEXT PRIMARY KEY,
    oshi_id    TEXT NOT NULL,
    name       TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (oshi_id) REFERENCES oshis(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS notes (
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
  )`,

  `CREATE INDEX IF NOT EXISTS idx_notes_oshi ON notes(oshi_id)`,
  `CREATE INDEX IF NOT EXISTS idx_notes_archive ON notes(archive_id)`,
  `CREATE INDEX IF NOT EXISTS idx_notes_created ON notes(created_at)`,

  `CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
    title,
    plain_text,
    tags,
    content='notes',
    content_rowid='rowid'
  )`,

  `CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
    INSERT INTO notes_fts(rowid, title, plain_text, tags)
    VALUES (new.rowid, new.title, new.plain_text, new.tags);
  END`,

  `CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, title, plain_text, tags)
    VALUES ('delete', old.rowid, old.title, old.plain_text, old.tags);
  END`,

  `CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, title, plain_text, tags)
    VALUES ('delete', old.rowid, old.title, old.plain_text, old.tags);
    INSERT INTO notes_fts(rowid, title, plain_text, tags)
    VALUES (new.rowid, new.title, new.plain_text, new.tags);
  END`,

  `CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS journal_books (
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
  )`,

  `CREATE TABLE IF NOT EXISTS journal_pages (
    id         TEXT PRIMARY KEY,
    book_id    TEXT,
    oshi_id    TEXT NOT NULL DEFAULT '',
    page_type  TEXT NOT NULL DEFAULT 'book_page',
    title      TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    date_label TEXT NOT NULL DEFAULT '',
    standalone INTEGER NOT NULL DEFAULT 0,
    page_index INTEGER NOT NULL DEFAULT 0,
    background TEXT NOT NULL DEFAULT 'paper',
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (book_id) REFERENCES journal_books(id) ON DELETE CASCADE,
    FOREIGN KEY (oshi_id) REFERENCES oshis(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS journal_items (
    id            TEXT PRIMARY KEY,
    page_id       TEXT NOT NULL,
    note_id       TEXT,
    illustration_id TEXT,
    item_type     TEXT NOT NULL DEFAULT 'note',
    x             REAL NOT NULL DEFAULT 0,
    y             REAL NOT NULL DEFAULT 0,
    width         REAL NOT NULL DEFAULT 240,
    height        REAL NOT NULL DEFAULT 180,
    rotation      REAL NOT NULL DEFAULT 0,
    z_index       INTEGER NOT NULL DEFAULT 0,
    sticker_style TEXT NOT NULL DEFAULT 'sticky',
    color         TEXT,
    border_style  TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (page_id) REFERENCES journal_pages(id) ON DELETE CASCADE,
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
    FOREIGN KEY (illustration_id) REFERENCES illustrations(id) ON DELETE CASCADE
  )`,

  `CREATE INDEX IF NOT EXISTS idx_journal_items_page ON journal_items(page_id)`,
  `CREATE INDEX IF NOT EXISTS idx_journal_items_note ON journal_items(note_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_items_page_note ON journal_items(page_id, note_id)`,

  `CREATE TABLE IF NOT EXISTS note_images (
    id         TEXT PRIMARY KEY,
    note_id    TEXT NOT NULL,
    data_url   TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
  )`,

  `CREATE INDEX IF NOT EXISTS idx_note_images_note ON note_images(note_id, sort_order)`,

  `CREATE TABLE IF NOT EXISTS illustrations (
    id                TEXT PRIMARY KEY,
    oshi_id           TEXT,
    category          TEXT NOT NULL DEFAULT 'official',
    title             TEXT NOT NULL DEFAULT '',
    original_path     TEXT NOT NULL,
    thumbnail_path    TEXT,
    original_filename TEXT NOT NULL DEFAULT '',
    mime_type         TEXT NOT NULL DEFAULT '',
    file_size         INTEGER NOT NULL DEFAULT 0,
    width             INTEGER,
    height            INTEGER,
    date              TEXT,
    owner             TEXT NOT NULL DEFAULT '',
    artist            TEXT NOT NULL DEFAULT '',
    source_url        TEXT NOT NULL DEFAULT '',
    tags              TEXT NOT NULL DEFAULT '[]',
    description       TEXT NOT NULL DEFAULT '',
    favorite          INTEGER NOT NULL DEFAULT 0,
    archived          INTEGER NOT NULL DEFAULT 0,
    created_at        TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (oshi_id) REFERENCES oshis(id) ON DELETE SET NULL
  )`,

  `CREATE INDEX IF NOT EXISTS idx_illustrations_oshi ON illustrations(oshi_id, category, favorite)`,
  `CREATE INDEX IF NOT EXISTS idx_illustrations_date ON illustrations(date)`,
]
