import { useCallback, useMemo, useState, type SetStateAction } from 'react'
import { commitHistory, createHistory, travelHistory, type JournalEditorDocument } from './journalEditorState'

export function useJournalHistory(initial: () => JournalEditorDocument) {
  const [history, setHistory] = useState(() => createHistory(initial()))
  const change = useCallback((update: SetStateAction<JournalEditorDocument>, key?: string) => {
    setHistory(current => commitHistory(current, typeof update === 'function' ? update(current.present) : update, key))
  }, [])
  const field = useCallback(<K extends keyof JournalEditorDocument>(key: K) => (update: SetStateAction<JournalEditorDocument[K]>) => {
    change(current => ({ ...current, [key]: typeof update === 'function' ? update(current[key]) : update }), key === 'items' || key === 'stamp' ? undefined : key)
  }, [change])
  const setters = useMemo(() => ({ setItems: field('items'), setStampDraft: field('stamp'), setSelectedOshiId: field('oshiId'), setTitle: field('title'), setDescription: field('description'), setDateLabel: field('dateLabel'), setBackground: field('background'), setOrientation: field('orientation'), setSelectedTemplateId: field('templateId') }), [field])
  const undo = useCallback(() => setHistory(current => travelHistory(current, 'undo')), [])
  const redo = useCallback(() => setHistory(current => travelHistory(current, 'redo')), [])
  return { document: history.present, change, ...setters, undo, redo, canUndo: !!history.past.length, canRedo: !!history.future.length }
}
