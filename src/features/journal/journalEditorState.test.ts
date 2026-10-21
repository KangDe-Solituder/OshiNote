import { describe, expect, it } from 'vitest'
import { commitHistory, createHistory, parseEditorDraft, travelHistory, type JournalEditorDocument } from './journalEditorState'

describe('journal editing history', () => {
  it('undoes a multi-item movement in one step and redoes it', () => {
    const original = [{ x: 10 }, { x: 40 }]
    const moved = [{ x: 30 }, { x: 60 }]
    const history = commitHistory(createHistory(original), moved)
    const undone = travelHistory(history, 'undo')
    expect(undone.present).toEqual(original)
    expect(travelHistory(undone, 'redo').present).toEqual(moved)
  })
  it('merges typing but keeps separate drag gestures, and drops redo after a new edit', () => {
    let history = commitHistory(createHistory(''), 'a', 'text', 100)
    history = commitHistory(history, 'ab', 'text', 200)
    expect(travelHistory(history, 'undo').present).toBe('')
    history = commitHistory(history, 'abc', undefined, 201)
    expect(travelHistory(history, 'undo').present).toBe('ab')
    history = commitHistory(travelHistory(history, 'undo'), 'new')
    expect(history.future).toEqual([])
  })
  it('limits history size and ignores no-op changes', () => {
    let history = createHistory(0)
    for (let i = 1; i <= 100; i++) history = commitHistory(history, i)
    expect(history.past).toHaveLength(80)
    expect(commitHistory(history, 100)).toBe(history)
  })
})

describe('draft recovery', () => {
  const draft: JournalEditorDocument = { oshiId: 'one', title: 'week', description: '', dateLabel: '', background: 'paper', orientation: 'landscape', templateId: null, items: [], stamp: null }
  it('restores valid metadata, staged materials and unrestricted rotation', () => {
    const document = { ...draft, items: [{ draftId: 'item', itemType: 'material', materialId: 'heart', staged: true, x: 10, y: 20, width: 60, height: 60, rotation: -75.5, zIndex: 2 }] }
    expect(parseEditorDraft(JSON.stringify({ version: 1, document }))).toEqual(document)
  })
  it('ignores corrupted or unsupported recovery records', () => {
    expect(parseEditorDraft('{')).toBeNull()
    expect(parseEditorDraft(JSON.stringify({ version: 2, document: draft }))).toBeNull()
    expect(parseEditorDraft(JSON.stringify({ version: 1, document: { ...draft, items: [{ width: -10 }] } }))).toBeNull()
  })
})
