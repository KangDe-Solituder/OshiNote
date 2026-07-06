import { create } from 'zustand'
import {
  applyStampFontFaces,
  checkStampFontAvailability,
  DEFAULT_STAMP_FONT_AVAILABILITY,
  type StampFontId,
} from '../features/stamps/stampFonts'

interface StampFontState {
  availability: Record<StampFontId, boolean>
  checked: boolean
  checking: boolean
  refresh: () => Promise<void>
}

export const useStampFontStore = create<StampFontState>((set) => ({
  availability: DEFAULT_STAMP_FONT_AVAILABILITY,
  checked: false,
  checking: false,
  refresh: async () => {
    set({ checking: true })
    try {
      const availability = await checkStampFontAvailability()
      await applyStampFontFaces(availability)
      set({ availability, checked: true, checking: false })
    } catch {
      await applyStampFontFaces(DEFAULT_STAMP_FONT_AVAILABILITY)
      set({ availability: DEFAULT_STAMP_FONT_AVAILABILITY, checked: true, checking: false })
    }
  },
}))
