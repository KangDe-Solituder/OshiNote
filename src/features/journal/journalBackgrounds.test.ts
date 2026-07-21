import { describe, expect, it } from 'vitest'
import { JOURNAL_BACKGROUND_PRESETS, getJournalBackgroundPreset } from './journalBackgrounds'

describe('journalBackgrounds', () => {
  it('keeps the finished page backgrounds free from the old canvas dot layer', () => {
    for (const preset of JOURNAL_BACKGROUND_PRESETS) {
      expect(String(preset.canvasBackground.backgroundImage)).not.toContain('--journal-canvas-dot')
    }
  })

  it('keeps paper colors independent from the active app theme', () => {
    for (const preset of JOURNAL_BACKGROUND_PRESETS) {
      expect(String(preset.canvasBackground.backgroundColor)).not.toContain('var(--color-bg-')
      expect(String(preset.canvasBackground.backgroundColor)).not.toContain('color-mix')
    }
  })

  it('keeps legacy background ids mapped to the redesigned themes', () => {
    expect(getJournalBackgroundPreset('blush').id).toBe('sakura')
    expect(getJournalBackgroundPreset('blue').id).toBe('blue-hour')
    expect(getJournalBackgroundPreset('mint').id).toBe('paper')
    expect(getJournalBackgroundPreset('unknown').id).toBe('paper')
  })
})
