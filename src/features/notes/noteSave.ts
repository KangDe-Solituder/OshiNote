import { invoke } from '@tauri-apps/api/core'
import { getDb } from '../../database'
import { normalizeStampInput } from '../stamps/stampService'
import type { CreateNoteInput, Stamp, StampInput } from '../../types'

export interface NoteSaveInput extends CreateNoteInput { id: string; favorite: boolean; images: string[]; stamp: Stamp | StampInput | null }
export function noteImageStatements(id: string, images: string[]) {
  return [{ query: 'DELETE FROM note_images WHERE note_id = ?', values: [id] as unknown[] }, ...images.map((url, index) => ({
    query: 'INSERT INTO note_images (id, note_id, data_url, sort_order) VALUES (?, ?, ?, ?)',
    values: [crypto.randomUUID(), id, url, index],
  }))]
}
export function noteDeleteStatements(id: string) {
  return [
    { query: 'DELETE FROM note_images WHERE note_id = ?', values: [id] },
    { query: "DELETE FROM stamps WHERE target_type = 'note' AND target_id = ?", values: [id] },
    { query: 'DELETE FROM notes WHERE id = ?', values: [id] },
  ]
}
export function noteSaveStatements(input: NoteSaveInput) {
  const statements: { query: string; values: unknown[] }[] = [{
    query: `INSERT INTO notes (id, oshi_id, archive_id, title, content, plain_text, source_url, tags, favorite, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now','localtime')), datetime('now','localtime'))
      ON CONFLICT(id) DO UPDATE SET oshi_id=excluded.oshi_id, archive_id=excluded.archive_id, title=excluded.title,
      content=excluded.content, plain_text=excluded.plain_text, source_url=excluded.source_url, tags=excluded.tags,
      favorite=excluded.favorite, created_at=excluded.created_at, updated_at=excluded.updated_at`,
    values: [input.id, input.oshi_id || null, input.archive_id || null, input.title, input.content, input.plain_text,
      input.source_url || '', JSON.stringify(input.tags), input.favorite ? 1 : 0, input.created_at || null],
  }, ...noteImageStatements(input.id, input.images)]
  if (input.stamp?.label.trim()) {
    const s = normalizeStampInput(input.stamp)
    statements.push({ query: `INSERT INTO stamps (id, target_type, target_id, template_id, template_snapshot, label, color, position, x, y, rotation, size, opacity)
      VALUES (?, 'note', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(target_type, target_id) DO UPDATE SET template_id=excluded.template_id, template_snapshot=excluded.template_snapshot,
      label=excluded.label, color=excluded.color, position=excluded.position, x=excluded.x, y=excluded.y,
      rotation=excluded.rotation, size=excluded.size, opacity=excluded.opacity, updated_at=datetime('now','localtime')`,
    values: [crypto.randomUUID(), input.id, s.template_id, s.template_snapshot, s.label.trim(), s.color, s.position, s.x, s.y, s.rotation, s.size, s.opacity] })
  } else statements.push({ query: "DELETE FROM stamps WHERE target_type = 'note' AND target_id = ?", values: [input.id] })
  return statements
}
export async function saveNoteAtomically(input: NoteSaveInput): Promise<void> {
  await getDb()
  await invoke('execute_sync_transaction', { statements: noteSaveStatements(input) })
}
