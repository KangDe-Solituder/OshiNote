import { describe, expect, it } from 'vitest'
import {
  createImageStylePayload,
  createNoteCardStylePayload,
  getImageItemStyleFromPayload,
  getMaterialStylePayload,
  getNoteCardStyleFromPayload,
  patchStylePayload,
} from './journalItemStyles'
import type { Note } from '../../types'

const note: Note = {
  id: 'note-1',
  oshi_id: 'oshi-1',
  archive_id: null,
  title: 'Live memo',
  content: '{}',
  plain_text: 'A'.repeat(240),
  source_url: '',
  tags: ['stream', 'asmr'],
  favorite: false,
  created_at: '',
  updated_at: '',
}

describe('journalItemStyles', () => {
  it('falls back safely for malformed note payloads', () => {
    const style = getNoteCardStyleFromPayload('{bad json', note, 'Untitled', 'Empty')

    expect(style.titleText).toBe('Live memo')
    expect(style.bodyText).toHaveLength(200)
    expect(style.backgroundColor).toBe('#fff7d6')
  })

  it('creates note card payloads with overrides', () => {
    const payload = createNoteCardStylePayload(note, { backgroundColor: '#dbeafe', titleVisible: false })
    const style = getNoteCardStyleFromPayload(payload, note, '', '')

    expect(style.backgroundColor).toBe('#dbeafe')
    expect(style.titleVisible).toBe(false)
    expect(style.titleText).toBe('Live memo')
  })

  it('coerces image style defaults and patched values', () => {
    const payload = patchStylePayload(createImageStylePayload(), {
      imageStyle: {
        fit: 'cover',
        frame: 'paper',
        borderColor: '#111827',
      },
    })
    const style = getImageItemStyleFromPayload(payload)

    expect(style.fit).toBe('cover')
    expect(style.frame).toBe('paper')
    expect(style.borderWidth).toBe(2)
    expect(style.borderColor).toBe('#111827')
    expect(style.backgroundColor).toBe('#ffffff')
  })

  it('merges material defaults with instance payloads', () => {
    const style = getMaterialStylePayload('{"color":"#123456","glassStrength":48}', 'washi-lilac')

    expect(style.color).toBe('#123456')
    expect(style.glassStrength).toBe(48)
  })
})
