import { DatabaseSync } from 'node:sqlite'
import { spawn, spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline'
import { describe, expect, it } from 'vitest'
import type Database from '@tauri-apps/plugin-sql'
import { MIGRATIONS } from './migrations'
import { DATABASE_SCHEMA_VERSION, migrateDatabase } from './index'

function adapter(raw: DatabaseSync): Database {
  return {
    select: async (sql: string, args: never[] = []) => raw.prepare(sql).all(...args),
    execute: async (sql: string, args: never[] = []) => {
      const result = raw.prepare(sql).run(...args)
      return { rowsAffected: Number(result.changes), lastInsertId: Number(result.lastInsertRowid) }
    },
  } as unknown as Database
}

describe('restore schema migration', () => {
  // Node's embedded SQLite lacks FTS5. Use the real SQLite engine from Python for
  // this integration case, including the application's search triggers.
  it.skipIf(spawnSync('python', ['-c', 'import sqlite3']).status !== 0)('migrates an unversioned database, retains a note, and is repeatable', async () => {
    const raw = pythonDatabase()
    try {
      for (const sql of MIGRATIONS) await raw.db.execute(sql)
      for (const sql of ["INSERT INTO oshis(id,name) VALUES ('oshi','Test')", "INSERT INTO archives(id,oshi_id,name) VALUES ('archive','oshi','Test')", "INSERT INTO notes(id,oshi_id,archive_id,title) VALUES ('note','oshi','archive','Retained')"]) await raw.db.execute(sql)
      await migrateDatabase(raw.db)
      await migrateDatabase(raw.db)
      expect(await raw.db.select('PRAGMA user_version')).toEqual([{ user_version: DATABASE_SCHEMA_VERSION }])
      expect(await raw.db.select("SELECT title FROM notes WHERE id='note'")).toEqual([{ title: 'Retained' }])
      expect(await raw.db.select('PRAGMA foreign_key_check')).toEqual([])
      const [count] = await raw.db.select<{ n: number }[]>('SELECT count(*) AS n FROM resource_versions')
      expect(count.n).toBeGreaterThan(0)
    } finally { raw.close() }
  })
  it('rejects a newer database before changing any tables', async () => {
    const raw = new DatabaseSync(':memory:')
    try {
      raw.exec('PRAGMA user_version=999; CREATE TABLE sentinel(value TEXT); INSERT INTO sentinel VALUES (\'untouched\')')
      await expect(migrateDatabase(adapter(raw))).rejects.toThrow('newer OshiNote')
      expect(raw.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()).toEqual([{ name: 'sentinel' }])
      expect(raw.prepare('SELECT value FROM sentinel').get()?.value).toBe('untouched')
    } finally { raw.close() }
  })
})

function pythonDatabase() {
  const process = spawn('python', ['-u', '-c', `
import sqlite3,json,sys
db=sqlite3.connect(':memory:',isolation_level=None)
db.row_factory=sqlite3.Row
for line in sys.stdin:
 try:
  req=json.loads(line); cur=db.execute(req['sql'],req.get('args',[]))
  print(json.dumps({'rows':[dict(row) for row in cur.fetchall()]}),flush=True)
 except Exception as error: print(json.dumps({'error':str(error)}),flush=True)
`])
  const queue: { resolve: (rows: unknown) => void; reject: (e: Error) => void }[] = []
  const lines = createInterface({ input: process.stdout })
  lines.on('line', line => { const pending = queue.shift(); const value = JSON.parse(line); if (value.error) pending?.reject(new Error(value.error)); else pending?.resolve(value.rows) })
  process.on('error', error => { queue.splice(0).forEach(p => p.reject(error)) })
  const query = (sql: string, args: unknown[] = []) => new Promise((resolve, reject) => { queue.push({ resolve, reject }); process.stdin.write(`${JSON.stringify({ sql, args })}\n`) })
  return { db: { select: query, execute: query } as unknown as Database, close: () => { process.stdin.end(); lines.close() } }
}
