import { create } from 'zustand'
import type { ThemeId, BackgroundFilters, UiMotionDuration } from '../types'
import { getDb } from '../database'

export type FontSize = 'small' | 'medium' | 'large'

const FONT_SIZE_MAP: Record<FontSize, string> = {
  small: '14px',
  medium: '16px',
  large: '18px',
}

interface ThemeState {
  currentTheme: ThemeId
  customBackground: string | null
  backgroundFilters: BackgroundFilters
  themeHotkeys: Record<string, ThemeId>
  fontSize: FontSize
  uiMotionDuration: UiMotionDuration

  setTheme: (id: ThemeId) => void
  setCustomBackground: (path: string | null) => void
  setFilter: (key: keyof BackgroundFilters, value: number) => void
  setThemeHotkey: (key: string, themeId: ThemeId) => void
  setFontSize: (size: FontSize) => void
  setUiMotionDuration: (duration: UiMotionDuration) => void

  loadFromDB: () => Promise<void>
  persistToDB: () => Promise<void>
}

const DEFAULT_HOTKEYS: Record<string, ThemeId> = {
  'ctrl+1': 'pink-cozy',
  'ctrl+2': 'dark-night',
  'ctrl+3': 'soft-blue',
  'ctrl+4': 'sakura',
  'ctrl+5': 'rainy-cafe',
}

function applyFontSize(size: FontSize) {
  document.documentElement.style.fontSize = FONT_SIZE_MAP[size]
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  currentTheme: 'pink-cozy',
  customBackground: null,
  backgroundFilters: { blur: 0, brightness: 100, opacity: 100, saturation: 100 },
  themeHotkeys: { ...DEFAULT_HOTKEYS },
  fontSize: 'medium',
  uiMotionDuration: 'normal',

  setTheme: (id) => {
    set({ currentTheme: id })
    document.documentElement.setAttribute('data-theme', id)
    get().persistToDB()
  },

  setCustomBackground: (path) => {
    set({ customBackground: path })
    get().persistToDB()
  },

  setFilter: (key, value) => {
    set((s) => ({
      backgroundFilters: { ...s.backgroundFilters, [key]: value },
    }))
    get().persistToDB()
  },

  setThemeHotkey: (key, themeId) => {
    set((s) => ({
      themeHotkeys: { ...s.themeHotkeys, [key]: themeId },
    }))
    get().persistToDB()
  },

  setFontSize: (size) => {
    set({ fontSize: size })
    applyFontSize(size)
    get().persistToDB()
  },

  setUiMotionDuration: (duration) => {
    set({ uiMotionDuration: duration })
    get().persistToDB()
  },

  loadFromDB: async () => {
    try {
      const db = await getDb()
      const rows = await db.select<{ key: string; value: string }[]>(
        "SELECT key, value FROM settings WHERE key IN ('theme', 'customBg', 'bgFilters', 'hotkeys', 'fontSize', 'uiMotionDuration')"
      )
      for (const row of rows) {
        switch (row.key) {
          case 'theme':
            set({ currentTheme: row.value as ThemeId })
            document.documentElement.setAttribute('data-theme', row.value)
            break
          case 'customBg':
            set({ customBackground: row.value || null })
            break
          case 'bgFilters':
            try { set({ backgroundFilters: JSON.parse(row.value) }) } catch {
              // Ignore invalid saved settings.
            }
            break
          case 'hotkeys':
            try { set({ themeHotkeys: JSON.parse(row.value) }) } catch {
              // Ignore invalid saved settings.
            }
            break
          case 'fontSize':
            if (row.value === 'small' || row.value === 'medium' || row.value === 'large') {
              set({ fontSize: row.value })
              applyFontSize(row.value)
            }
            break
          case 'uiMotionDuration':
            if (row.value === 'off' || row.value === 'fast' || row.value === 'normal' || row.value === 'slow') {
              set({ uiMotionDuration: row.value })
            }
            break
        }
      }
    } catch {
      // DB not ready yet
    }
  },

  persistToDB: async () => {
    try {
      const db = await getDb()
      const state = get()
      await db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('theme', ?)", [state.currentTheme])
      await db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('customBg', ?)", [state.customBackground || ''])
      await db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('bgFilters', ?)", [JSON.stringify(state.backgroundFilters)])
      await db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('hotkeys', ?)", [JSON.stringify(state.themeHotkeys)])
      await db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('fontSize', ?)", [state.fontSize])
      await db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('uiMotionDuration', ?)", [state.uiMotionDuration])
    } catch {
      // Silently fail
    }
  },
}))
