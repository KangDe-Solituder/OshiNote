import type { CSSProperties } from 'react'
import { getJournalBackgroundPreset } from '../../../features/journal/journalBackgrounds'

export function getPageBackground(background: string): CSSProperties {
  return getJournalBackgroundPreset(background).canvasBackground
}
