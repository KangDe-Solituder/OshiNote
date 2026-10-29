// Read-only source probes. Run from the repository root with Node 22+:
// node docs/reviews/2026-10-29-kimi/verify-report.cjs
// All records are synthetic; this does not open the user's DB or use WebDAV.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
function load(file, mocks = {}, expose = '') {
  const output = ts.transpileModule(read(file) + expose, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  const requireMock = name => {
    if (name in mocks) return mocks[name];
    throw Error('Unexpected dependency: ' + name);
  };
  vm.runInNewContext(output, { module, exports: module.exports, require: requireMock, console, Date, URL, crypto: require('node:crypto').webcrypto }, { filename: file });
  return module.exports;
}
const results = [];
async function main() {
  // Capture the exact first native command guard, not the more permissive helper.
  const native = read('src-tauri/src/data_sync.rs');
  const command = native.split('pub async fn download_webdav_app_data_file(')[1];
  const guard = command.slice(command.indexOf('    if !local_relative_path'), command.indexOf('    let local_path'));
  assert.match(guard, /starts_with\("sync-cache\/"\)/);
  assert.match(guard, /return Err/);
  assert.match(read('src/services/backup/catalog.ts'), /const localPath = `backups\/restore-/);
  results.push({ id: 'T1', method: 'static exact guard extraction; not native E2E', outcome: 'Caller backups/restore-*.oshi.zip conflicts with sync-cache-only preflight', guard });

  const dbMetadata = { select: async () => [{ value: JSON.stringify({ repository_id: 'synthetic-repository', head: 'synthetic-head' }) }] };
  const metadata = load('src/services/backup/index.ts', {
    '../../features/resources/resourceLibrary': { reconcileResourceLibrary: async () => {} },
    '../sync/syncModel': { SYNC_SCHEMA_VERSION: 4 },
    '@tauri-apps/api/core': {}, '@tauri-apps/plugin-dialog': {},
    '../../database': { getDb: async () => dbMetadata },
  });
  const meta = await metadata.readBackupSyncMetadata();
  assert.equal(meta.head_commit, null);
  results.push({ id: 'T2', method: 'actual TS function, synthetic DB response', outcome: meta });

  const exportModule = load('src/services/export/index.ts', {
    '@tauri-apps/plugin-dialog': {}, '@tauri-apps/plugin-fs': {},
    '../../features/oshis/oshiService': {}, '../../features/oshis/archiveService': {},
    '../../database': {}, '../../utils/safeJson': {},
  });
  const oshis = [{ id: 'o', name: 'Synthetic', activity_links: [] }];
  const archives = [{ id: 'a', oshi_id: 'o', name: 'Archive' }];
  const notes = ['assigned', 'unarchived', 'unassigned'].map((id, index) => ({
    id, title: `audit-note-${id}`, oshi_id: index === 2 ? null : 'o', archive_id: index === 0 ? 'a' : null,
    content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Synthetic text' }] }] }),
    plain_text: 'Synthetic text', tags: [], favorite: false, created_at: '2026-01-01',
  }));
  const counts = {};
  for (const format of ['json', 'markdown', 'txt']) {
    const output = exportModule.formatExportData(format, oshis, archives, notes);
    counts[format] = notes.filter(note => output.includes(note.title)).length;
  }
  assert.deepEqual(counts, { json: 3, markdown: 1, txt: 1 });
  results.push({ id: 'T3', method: 'actual export formatter, 3 synthetic ownership cases', outcome: counts });

  const raw = new DatabaseSync(':memory:');
  raw.exec("CREATE TABLE note_images (id TEXT, note_id TEXT, data_url TEXT, sort_order INTEGER); INSERT INTO note_images VALUES ('old','n','old-image',0)");
  const noteService = load('src/features/notes/noteService.ts', {
    '../../database': { generateId: () => 'synthetic-id', getDb: async () => ({ execute: async (sql, args) => {
      if (sql.startsWith('INSERT INTO note_images')) throw Error('Injected write failure');
      raw.prepare(sql).run(...args);
    } }) },
    '../stamps/stampService': {},
  });
  await assert.rejects(noteService.replaceNoteImages('n', ['new-image']), /Injected write failure/);
  const remaining = raw.prepare('SELECT COUNT(*) AS n FROM note_images').get().n;
  assert.equal(remaining, 0);
  results.push({ id: 'T4', method: 'actual replaceNoteImages + in-memory SQLite + injected INSERT failure', outcome: { previousImages: 1, remainingImages: remaining } });
  raw.close();

  const writes = [];
  const theme = load('src/stores/themeStore.ts', {
    zustand: require('zustand'),
    '../database': { getDb: async () => ({ execute: async (sql, args) => { writes.push({ sql, args }); } }) },
    '../services/media/backgroundImage': {}, '../services/startup': { readStartupTheme: () => null },
  });
  for (let i = 0; i < 10; i++) theme.useThemeStore.getState().setFilter('blur', i);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(writes.length, 90);
  results.push({ id: 'T5', method: 'actual Zustand action with synthetic SQL adapter', outcome: { sliderEvents: 10, writes: writes.length } });

  const formatting = load('src/pages/dataFormatting.ts');
  assert.equal(formatting.conflictPreview(JSON.stringify({ title: 'Synthetic title', plain_text: 'Body' })), 'Synthetic title');
  assert.match(read('src/pages/ExportPage.tsx'), /preview=\{conflictPreview/);
  results.push({ id: 'T6', method: 'actual formatter + call-site check', outcome: 'Conflict renders both side summaries, not only a record key; not a field-level diff' });

  const python = `import sqlite3,json
c=sqlite3.connect(':memory:')
c.execute("CREATE VIRTUAL TABLE tri USING fts5(body, tokenize='trigram')")
c.execute("INSERT INTO tri VALUES (?)", ('涼花みなせ 配信の感想',))
print(json.dumps({q:c.execute('SELECT count(*) FROM tri WHERE tri MATCH ?', (q,)).fetchone()[0] for q in ['涼花','みなせ']},ensure_ascii=False))`;
  const fts = JSON.parse(execFileSync('python', ['-X', 'utf8', '-c', python], { encoding: 'utf8' }));
  assert.equal(fts['涼花'], 0); assert.equal(fts['みなせ'], 1);
  results.push({ id: 'T7', method: 'Python SQLite in-memory tokenizer experiment; not current app tokenizer', outcome: fts });

  const selects = [];
  const searchService = load('src/features/notes/noteService.ts', {
    '../../database': { getDb: async () => ({ select: async (sql, args) => { selects.push({ sql, args }); return sql.includes('COUNT(*)') ? [{ count: 0 }] : []; } }) },
    '../stamps/stampService': {},
  });
  await searchService.fetchNotesByOshi('o', { query: 'synthetic', page: 2, pageSize: 20 });
  assert.match(selects[1].sql, /LIMIT \? OFFSET \?/);
  assert.deepEqual(Array.from(selects[1].args).slice(-2), [20, 20]);
  assert.match(read('src/pages/OshiDetailPage.tsx'), /fetchByOshi: fetchNotesByOshi/);
  assert.match(read('src/pages/OshiDetailPage.tsx'), /await fetchNotesByOshi\(oshiId/);
  results.push({ id: 'T8', method: 'actual current Oshi query + page/store call-site check', outcome: 'Current Oshi search uses LIKE + SQL LIMIT/OFFSET; FTS/JS search function is not this UI path' });

  const migrationDb = new DatabaseSync(':memory:');
  migrationDb.exec("CREATE TABLE oshis(id TEXT PRIMARY KEY); CREATE TABLE journal_images(id TEXT PRIMARY KEY, oshi_id TEXT, file_path TEXT, original_filename TEXT, mime_type TEXT, file_size INTEGER, width INTEGER, height INTEGER, created_at TEXT); INSERT INTO journal_images VALUES ('i',NULL,'media/synthetic.png','','image/png',1,1,1,'2026-01-01')");
  const migrations = load('src/database/index.ts', {
    '@tauri-apps/plugin-sql': {}, '@tauri-apps/api/core': {}, './migrations': {},
    '../features/resources/resourceSchema': {}, '../features/resources/resourceLibrary': {},
    '../features/resources/resourceManagement': {}, '../services/startup': {},
  }, '\nexport { ensureJournalImageOwnershipForeignKey };');
  let failRename = true;
  const adapter = {
    select: async sql => migrationDb.prepare(sql).all(),
    execute: async sql => {
      if (failRename && sql === 'ALTER TABLE journal_images_v2 RENAME TO journal_images') { failRename = false; throw Error('Injected migration interruption'); }
      return migrationDb.prepare(sql).run();
    },
  };
  await assert.rejects(migrations.ensureJournalImageOwnershipForeignKey(adapter), /Injected migration interruption/);
  const beforeRetry = migrationDb.prepare('SELECT count(*) AS n FROM journal_images_v2').get().n;
  await assert.rejects(migrations.ensureJournalImageOwnershipForeignKey(adapter), /no such table/);
  const afterRetry = migrationDb.prepare('SELECT count(*) AS n FROM journal_images_v2').get().n;
  assert.equal(beforeRetry, 1); assert.equal(afterRetry, 0);
  results.push({ id: 'T9', method: 'actual migration helper exposed in-memory + synthetic SQLite + injected rename failure; not full app startup', outcome: { rowsInRecoveryTableAfterInterruption: beforeRetry, rowsAfterHelperRetry: afterRetry } });
  migrationDb.close();

  console.log(JSON.stringify({ baseline: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), userDataAccessed: false, networkUsed: false, results }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
