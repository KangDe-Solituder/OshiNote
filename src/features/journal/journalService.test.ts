/// <reference types="node" />
import { randomUUID } from 'node:crypto'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MIGRATIONS } from '../../database/migrations'
import { createCompositionDraft, createDraftSavePlan } from './journalDraftAdapters'
import type { JournalPage } from '../../types'
import {
  createJournalItemForNote,
  createJournalItemForIllustration,
  createJournalItemForImage,
  fetchJournalItems,
  fetchJournalPages,
  fetchJournalPageById,
} from './journalService'

const database = vi.hoisted(() => ({ getDb: vi.fn() }))
vi.mock('../../database', () => ({ getDb: database.getDb, generateId: () => randomUUID() }))

let sqlite: DatabaseSync

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = OFF')
  for (const migration of MIGRATIONS) sqlite.exec(migration)
  sqlite.exec(`
    ALTER TABLE journal_items ADD COLUMN staged INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE journal_items ADD COLUMN journal_image_id TEXT;
    CREATE TABLE journal_images (
      id TEXT PRIMARY KEY, oshi_id TEXT, file_path TEXT, original_filename TEXT,
      mime_type TEXT, file_size INTEGER, width INTEGER, height INTEGER, created_at TEXT
    );
  `)
  database.getDb.mockResolvedValue({
    select: async (sql: string, params: SQLInputValue[] = []) => sqlite.prepare(sql).all(...params),
    execute: async (sql: string, params: SQLInputValue[] = []) => sqlite.prepare(sql).run(...params),
  })
})

afterEach(() => sqlite.close())

describe('journal resource placement persistence', () => {
  it('displays consecutive page numbers despite gaps in stored ordering', async () => {
    sqlite.exec(`INSERT INTO journal_pages (id, book_id, oshi_id, page_index) VALUES
      ('first', 'book-1', 'oshi-1', 0), ('second', 'book-1', 'oshi-1', 2), ('third', 'book-1', 'oshi-1', 5)`)
    expect((await fetchJournalPages('book-1')).map((page) => page.page_index)).toEqual([0, 1, 2])
    expect((await fetchJournalPageById('second'))?.page_index).toBe(1)
    sqlite.exec("DELETE FROM journal_pages WHERE id = 'first'")
    expect((await fetchJournalPageById('second'))?.page_index).toBe(0)
  })
  it.each([
    ['note', createJournalItemForNote],
    ['illustration', createJournalItemForIllustration],
    ['image', createJournalItemForImage],
  ] as const)('places an existing staged %s and retains its layout after reload', async (_type, create) => {
    const staged = await create('page-1', 'source-1', undefined, true)
    expect(await fetchJournalItems('page-1')).toHaveLength(0)

    const layout = { x: 520, y: 140, width: 280, height: 230, rotation: 4, z_index: 12 }
    const placed = await create('page-1', 'source-1', layout)
    expect(placed).toMatchObject({ id: staged.id, staged: false, ...layout })
    const reloaded = await fetchJournalItems('page-1')
    expect(reloaded).toHaveLength(1)
    expect(reloaded[0]).toMatchObject({ id: staged.id, staged: false, ...layout })
    expect(await fetchJournalItems('page-1', true)).toHaveLength(1)
  })

  it('keeps all five notes visible when two were previously staged', async () => {
    for (let index = 0; index < 5; index++) {
      await createJournalItemForNote('page-1', `note-${index}`, undefined, index >= 3)
    }
    for (let index = 3; index < 5; index++) {
      await createJournalItemForNote('page-1', `note-${index}`, {
        x: 500, y: index * 50, width: 260, height: 180, rotation: 0, z_index: index,
      })
    }
    expect(await fetchJournalItems('page-1')).toHaveLength(5)
  })

  it('restores work board identities so placement updates and removal deletes the original', async () => {
    const staged = await createJournalItemForNote('page-1', 'note-1', undefined, true)
    const existing = await fetchJournalItems('page-1', true)
    const page = { id: 'page-1', oshi_id: 'oshi-1', orientation: 'portrait' } as JournalPage
    const draft = createCompositionDraft(page, existing, null)
    expect(draft.items[0]).toMatchObject({ originItemId: staged.id, staged: true })
    const placed = draft.items.map((item) => ({ ...item, staged: false }))
    expect(createDraftSavePlan(placed, existing).itemsToUpdate).toHaveLength(1)
    expect(createDraftSavePlan(placed, existing).itemsToCreate).toHaveLength(0)
    expect(createDraftSavePlan([], existing).existingItemsToRemove[0].id).toBe(staged.id)
  })
})
