import type { JournalCompositionDraft } from './journalDraftAdapters'
import { isRecord } from '../../utils/safeJson'
import type { JournalPageTemplateDefinition } from './journalPageTemplates'

export interface JournalEditorDocument extends JournalCompositionDraft { templateId: string | null; templateSnapshot?: JournalPageTemplateDefinition | null }
export interface EditorHistory<T> { present: T; past: T[]; future: T[]; key?: string; time: number }
export function createHistory<T>(present: T): EditorHistory<T> { return { present, past: [], future: [], time: 0 } }
export function commitHistory<T>(state: EditorHistory<T>, next: T, key?: string, time = Date.now()): EditorHistory<T> {
  if (JSON.stringify(next) === JSON.stringify(state.present)) return state
  const merge = key && key === state.key && time - state.time < 600 && !state.future.length
  return { present: next, past: merge ? state.past : [...state.past.slice(-79), state.present], future: [], key, time }
}
export function travelHistory<T>(state: EditorHistory<T>, direction: 'undo' | 'redo'): EditorHistory<T> {
  if (direction === 'undo') {
    if (!state.past.length) return state
    return { present: state.past[state.past.length - 1], past: state.past.slice(0, -1), future: [state.present, ...state.future], time: 0 }
  }
  if (!state.future.length) return state
  return { present: state.future[0], past: [...state.past, state.present], future: state.future.slice(1), time: 0 }
}

export function parseEditorDraft(raw: string | null): JournalEditorDocument | null {
  try {
    const data: unknown = JSON.parse(raw || 'null')
    if (!isRecord(data) || data.version !== 1 || !isRecord(data.document)) return null
    const doc = data.document
    if (!['oshiId', 'title', 'description', 'dateLabel', 'background'].every(key => typeof doc[key] === 'string')
      || (doc.orientation !== 'portrait' && doc.orientation !== 'landscape')
      || (doc.templateId !== null && typeof doc.templateId !== 'string') || !Array.isArray(doc.items)) return null
    if (!doc.items.every(item => isRecord(item) && typeof item.draftId === 'string'
      && ['note', 'image', 'illustration', 'material'].includes(String(item.itemType))
      && ['x', 'y', 'width', 'height', 'rotation', 'zIndex'].every(key => typeof item[key] === 'number' && Number.isFinite(item[key]))
      && Number(item.width) > 0 && Number(item.height) > 0)) return null
    if (doc.stamp !== null && !isRecord(doc.stamp)) return null
    return doc as unknown as JournalEditorDocument
  } catch { return null }
}
