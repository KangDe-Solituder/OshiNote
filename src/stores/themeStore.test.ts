import { describe, expect, it } from 'vitest'
import { normalizeThemeHotkeys } from './themeStore'

const CURRENT_DEFAULTS = {
  'ctrl+1': 'warm-paper',
  'ctrl+2': 'pink-cozy',
  'ctrl+3': 'dark-night',
  'ctrl+4': 'soft-blue',
  'ctrl+5': 'sakura',
  'ctrl+6': 'rainy-cafe',
}

describe('normalizeThemeHotkeys', () => {
  it('migrates the previous five-theme default mapping', () => {
    const result = normalizeThemeHotkeys({
      'ctrl+1': 'pink-cozy',
      'ctrl+2': 'dark-night',
      'ctrl+3': 'soft-blue',
      'ctrl+4': 'sakura',
      'ctrl+5': 'rainy-cafe',
    })

    expect(result).toEqual({ hotkeys: CURRENT_DEFAULTS, migrated: true })
  })

  it('also migrates the partially persisted mapping from the new branch', () => {
    const result = normalizeThemeHotkeys({
      'ctrl+1': 'pink-cozy',
      'ctrl+2': 'dark-night',
      'ctrl+3': 'soft-blue',
      'ctrl+4': 'sakura',
      'ctrl+5': 'rainy-cafe',
      'ctrl+6': 'rainy-cafe',
    })

    expect(result).toEqual({ hotkeys: CURRENT_DEFAULTS, migrated: true })
  })

  it('preserves a custom mapping while filling missing defaults', () => {
    const result = normalizeThemeHotkeys({ 'ctrl+1': 'dark-night' })

    expect(result.migrated).toBe(false)
    expect(result.hotkeys).toEqual({ ...CURRENT_DEFAULTS, 'ctrl+1': 'dark-night' })
  })
})
