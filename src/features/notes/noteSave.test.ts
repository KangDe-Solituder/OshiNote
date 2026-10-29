import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { noteDeleteStatements, noteImageStatements, noteSaveStatements, type NoteSaveInput } from './noteSave'
import { createStampInputFromTemplate } from '../stamps/stampService'

const input: NoteSaveInput = { id: 'n', oshi_id: null, archive_id: null, title: 'new', content: '{}', plain_text: 'new', source_url: '', tags: [], favorite: true, images: ['new-image'], stamp: createStampInputFromTemplate('recorded','new-stamp') }
function database() {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE notes(id TEXT PRIMARY KEY,oshi_id TEXT,archive_id TEXT,title TEXT,content TEXT,plain_text TEXT,source_url TEXT,tags TEXT,favorite INTEGER,created_at TEXT,updated_at TEXT);
    CREATE TABLE note_images(id TEXT PRIMARY KEY,note_id TEXT,data_url TEXT,sort_order INTEGER);
    CREATE TABLE stamps(id TEXT PRIMARY KEY,target_type TEXT,target_id TEXT,template_id TEXT,template_snapshot TEXT,label TEXT,color TEXT,position TEXT,x REAL,y REAL,rotation REAL,size REAL,opacity REAL,updated_at TEXT,UNIQUE(target_type,target_id));
    INSERT INTO notes(id,title) VALUES('n','old'); INSERT INTO note_images VALUES('old','n','old-image',0); INSERT INTO stamps(id,target_type,target_id,label) VALUES('old','note','n','old-stamp');`)
  return db
}
function apply(db: DatabaseSync, failAt = -1) {
  db.exec('BEGIN IMMEDIATE')
  try {
    noteSaveStatements(input).forEach((statement,index) => {
      if (index === failAt) throw new Error('injected')
      db.prepare(statement.query).run(...statement.values as never[])
    })
    db.exec('COMMIT')
  } catch (error) { db.exec('ROLLBACK'); throw error }
}
describe('atomic note save SQL', () => {
  it.each(['attachments', 'delete'])('rolls back the standalone %s operation on failure', operation => {
    const db = database()
    try {
      const statements = operation === 'delete' ? noteDeleteStatements('n') : noteImageStatements('n', ['replacement'])
      db.exec('BEGIN IMMEDIATE')
      statements.slice(0, -1).forEach(s => db.prepare(s.query).run(...s.values as never[]))
      // A real SQLite abort after the destructive steps must leave the whole record intact.
      expect(() => db.exec('INSERT INTO missing_table VALUES (1)')).toThrow()
      db.exec('ROLLBACK')
      expect(db.prepare('SELECT title FROM notes').get()?.title).toBe('old')
      expect(db.prepare('SELECT data_url FROM note_images').get()?.data_url).toBe('old-image')
      expect(db.prepare('SELECT label FROM stamps').get()?.label).toBe('old-stamp')
    } finally { db.close() }
  })
  it.each([1,2,3])('preserves body, attachments and stamp when operation %i fails', stage => {
    const db = database()
    try {
      expect(() => apply(db,stage)).toThrow('injected')
      expect(db.prepare('SELECT title FROM notes').get()?.title).toBe('old')
      expect(db.prepare('SELECT data_url FROM note_images').get()?.data_url).toBe('old-image')
      expect(db.prepare('SELECT label FROM stamps').get()?.label).toBe('old-stamp')
    } finally { db.close() }
  })
  it('commits all parts and reuses the same note and stamp on retry', () => {
    const db = database()
    try {
      apply(db); apply(db)
      expect(db.prepare('SELECT COUNT(*) AS n FROM notes').get()?.n).toBe(1)
      expect(db.prepare('SELECT favorite FROM notes').get()?.favorite).toBe(1)
      expect(db.prepare('SELECT data_url FROM note_images').get()?.data_url).toBe('new-image')
      expect(db.prepare('SELECT id,label FROM stamps').get()).toEqual({ id:'old',label:'new-stamp' })
    } finally { db.close() }
  })
})
