/// <reference types="node" />
import { randomUUID } from 'node:crypto'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MIGRATIONS } from '../database/migrations'

const database = vi.hoisted(() => ({ getDb: vi.fn() }))
vi.mock('../database', () => ({ getDb: database.getDb, generateId: () => randomUUID() }))

let sqlite: DatabaseSync

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = OFF')
  for (const migration of MIGRATIONS) {
    try { sqlite.exec(migration) } catch (error) {
      if (migration.toLowerCase().includes('fts5')) continue
      throw error
    }
  }
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

import { useJournalStore } from './journalStore'
import { createJournalPage } from '../features/journal/journalService'

afterEach(() => sqlite.close())

async function seedBook(): Promise<{ bookId: string; p1: string; p2: string }> {
  const bookId = randomUUID()
  sqlite.prepare(`INSERT INTO journal_books (id, oshi_id, title) VALUES (?, 'oshi-1', 'book')`).run(bookId)
  const page1 = await createJournalPage(bookId) // landscape page (p1)
  const page2 = await createJournalPage(bookId) // portrait page (p2)
  sqlite.prepare(`UPDATE journal_pages SET orientation = 'landscape' WHERE id = ?`).run(page1.id)
  sqlite.prepare(`UPDATE journal_pages SET orientation = 'portrait' WHERE id = ?`).run(page2.id)
  sqlite.prepare(`INSERT INTO journal_items (id, page_id, item_type, x, y) VALUES (?, ?, 'material', 10, 10)`).run(`item-of-p1`, page1.id)
  sqlite.prepare(`INSERT INTO journal_items (id, page_id, item_type, x, y) VALUES (?, ?, 'material', 20, 20)`).run(`item-of-p2`, page2.id)
  return { bookId, p1: page1.id, p2: page2.id }
}

function storeSnapshot() {
  const state = useJournalStore.getState()
  return { activePageId: state.activePageId, itemIds: state.items.map((item) => item.id) }
}

describe('page switching race (real service + real store)', () => {
  it('p2 edit -> view -> click p1 -> edit p1 ends with p1 items', async () => {
    const { bookId, p1, p2 } = await seedBook()

    // 1. edit p2 (portrait)
    await useJournalStore.getState().openPageForEditing(p2, 'oshi-1')
    expect(storeSnapshot().itemIds).toEqual(['item-of-p2'])

    // 2. back to view: editor load (openPageForEditing p2 again) + JournalPageView mount chain
    const viewLoad = useJournalStore.getState().openPageForEditing(p2, 'oshi-1')
    const mountOpen = useJournalStore.getState().openBook(bookId, 'oshi-1')
    await Promise.all([viewLoad, mountOpen])
    await useJournalStore.getState().setActivePage(p2, 'oshi-1') // mount .then

    // 3. user clicks p1 card
    await useJournalStore.getState().setActivePage(p1, 'oshi-1')
    expect(storeSnapshot().activePageId).toBe(p1)

    // 4. enter p1 edit
    await useJournalStore.getState().openPageForEditing(p1, 'oshi-1')
    expect(storeSnapshot()).toEqual({ activePageId: p1, itemIds: ['item-of-p1'] })
  })

  it('fast variant: click p1 card while openBook in flight, then edit immediately', async () => {
    const { bookId, p1, p2 } = await seedBook()
    await useJournalStore.getState().openPageForEditing(p2, 'oshi-1')

    const mountOpen = useJournalStore.getState().openBook(bookId, 'oshi-1')
    const pickP1 = useJournalStore.getState().setActivePage(p1, 'oshi-1')
    const editLoad = useJournalStore.getState().openPageForEditing(p1, 'oshi-1')
    await Promise.all([mountOpen, pickP1, editLoad])

    expect(storeSnapshot()).toEqual({ activePageId: p1, itemIds: ['item-of-p1'] })
  })

  it('edit p2 -> view p2 load racing edit p1 load (view load resolves last)', async () => {
    const { p1, p2 } = await seedBook()
    await useJournalStore.getState().openPageForEditing(p2, 'oshi-1')

    // p2 view load starts, then user enters p1 edit before it finishes
    const viewLoad = useJournalStore.getState().openPageForEditing(p2, 'oshi-1')
    const editLoad = useJournalStore.getState().openPageForEditing(p1, 'oshi-1')
    await Promise.all([viewLoad, editLoad, useJournalStore.getState().setActivePage(p1, 'oshi-1')])

    expect(storeSnapshot()).toEqual({ activePageId: p1, itemIds: ['item-of-p1'] })
  })
})
