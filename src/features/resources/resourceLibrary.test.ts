/// <reference types="node" />
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type Database from '@tauri-apps/plugin-sql'
import { ensureResourceSchema } from './resourceSchema'
import { reconcileResourceLibrary } from './resourceLibrary'
import { resolveMaterialSnapshot } from '../journal/journalMaterials'
import { validateResourceGraph } from './resourceIntegrity'
import { assertTestRemotePath } from '../../services/sync/testIsolation'
import { deleteJournalImage, fetchJournalImages } from '../journal/journalImageService'
import type { SyncRecord } from '../../services/sync/syncModel'

const shared = vi.hoisted(() => ({ getDb: vi.fn() }))
vi.mock('../../database', () => ({ getDb: shared.getDb, generateId: () => crypto.randomUUID() }))
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => false }))
let sqlite: DatabaseSync
let db: Database
beforeEach(async () => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE journal_images (id TEXT PRIMARY KEY, file_path TEXT, original_filename TEXT, oshi_id TEXT, created_at TEXT);
    CREATE TABLE journal_items (id TEXT PRIMARY KEY, item_type TEXT, material_id TEXT, material_snapshot TEXT, journal_image_id TEXT REFERENCES journal_images(id) ON DELETE CASCADE, page_id TEXT);
    CREATE TABLE templates (id TEXT PRIMARY KEY, type TEXT, payload TEXT);
    INSERT INTO journal_images VALUES ('img', 'media/journal/img.png', 'image.png', NULL, '2026-10-28');
    INSERT INTO journal_items VALUES ('image-placement', 'image', NULL, '{}', 'img', 'page');
    INSERT INTO journal_items VALUES ('sticker', 'material', 'heart', '{"id":"heart","kind":"sticker","defaultStyle":{"color":"#123456","icon":"heart"}}', NULL, 'page');
    INSERT INTO templates VALUES ('layout', 'journal_page', '{"version":1,"layout":{"decorations":[{"materialId":"heart"}]}}');`)
  db = {
    select: async (sql: string, args: SQLInputValue[] = []) => sqlite.prepare(sql).all(...args),
    execute: async (sql: string, args: SQLInputValue[] = []) => sqlite.prepare(sql).run(...args),
  } as unknown as Database
  shared.getDb.mockResolvedValue(db)
  await ensureResourceSchema(db)
})
afterEach(() => sqlite.close())

describe('resource migration and retention', () => {
  it('migrates legacy definitions without changing appearance and is restart-safe', async () => {
    await reconcileResourceLibrary(db)
    const first = sqlite.prepare('SELECT * FROM resource_versions ORDER BY id').all()
    const snapshot = sqlite.prepare("SELECT material_snapshot FROM journal_items WHERE id='sticker'").get()!.material_snapshot as string
    expect(resolveMaterialSnapshot(snapshot, 'missing')?.defaultStyle.color).toBe('#123456')
    expect(JSON.parse(snapshot).resourceVersionId).toMatch(/^legacy:/)
    const template = JSON.parse(sqlite.prepare('SELECT payload FROM templates').get()!.payload as string)
    expect(template.resourceDependencies).toContain('builtin:heart:1')
    expect(JSON.parse(template.layout.decorations[0].materialSnapshot).rendererVersion).toBe(1)
    await ensureResourceSchema(db)
    await reconcileResourceLibrary(db)
    expect(sqlite.prepare('SELECT * FROM resource_versions ORDER BY id').all()).toEqual(first)
  })
  it('retires an upload without cascading deletion into a saved page', async () => {
    await reconcileResourceLibrary(db)
    await deleteJournalImage('img')
    expect(sqlite.prepare('SELECT archived FROM journal_images').get()!.archived).toBe(1)
    expect(sqlite.prepare("SELECT id FROM journal_items WHERE id='image-placement'").get()).toBeTruthy()
    expect(sqlite.prepare("SELECT file_path FROM resource_versions WHERE id='upload:img:1'").get()!.file_path).toBe('media/journal/img.png')
    expect(await fetchJournalImages()).toHaveLength(0)
    expect(await fetchJournalImages(undefined, 'page')).toHaveLength(1)
  })
  it('rejects mutations and removal of immutable resource history', async () => {
    await reconcileResourceLibrary(db)
    expect(() => sqlite.exec("UPDATE resource_versions SET payload='{}' WHERE id='builtin:heart:1'")).toThrow(/immutable/)
    expect(() => sqlite.exec("DELETE FROM resource_versions WHERE id='builtin:heart:1'")).toThrow(/retained/)
  })
  it('checks page and template dependencies before applying a sync state', async () => {
    await reconcileResourceLibrary(db)
    const rows: SyncRecord[] = ['resource_assets', 'resource_versions', 'journal_items', 'templates'].flatMap(table =>
      sqlite.prepare(`SELECT * FROM ${table}`).all().map(value => ({ key: `${table}:${value.id}`, id: String(value.id), table, value })))
    expect(() => validateResourceGraph(rows)).not.toThrow()
    expect(() => validateResourceGraph(rows.filter(row => row.id !== 'builtin:heart:1'))).toThrow(/Missing resource version/)
  })
})

describe('isolated WebDAV target', () => {
  it('rejects production, nested production, and traversal paths', () => {
    for (const path of ['BackUp/OshiNote', 'BackUp/OshiNote/test', 'BackUp/OshiNote-ResourceTest/../OshiNote', '']) {
      expect(() => assertTestRemotePath(path, true)).toThrow()
    }
    expect(() => assertTestRemotePath('BackUp/OshiNote-ResourceTest', true)).not.toThrow()
    expect(() => assertTestRemotePath('BackUp/OshiNote', false)).not.toThrow()
  })
})
