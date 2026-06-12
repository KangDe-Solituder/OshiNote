import { create } from 'zustand'
import { getDb } from '../database'
import type { Locale } from '../types'

interface LanguageState {
  locale: Locale
  setLocale: (locale: Locale) => void
  loadFromDB: () => Promise<void>
}

const VALID_LOCALES: Locale[] = ['en', 'zh', 'ja']
const STORAGE_KEY = 'oshinote.locale'

function coerceLocale(value: string): Locale {
  return VALID_LOCALES.includes(value as Locale) ? value as Locale : 'en'
}

function applyLocale(locale: Locale) {
  document.documentElement.setAttribute('lang', locale)
}

export const useLanguageStore = create<LanguageState>((set) => ({
  locale: 'en',

  setLocale: (locale) => {
    set({ locale })
    applyLocale(locale)
    localStorage.setItem(STORAGE_KEY, locale)
    getDb()
      .then((db) => db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('locale', ?)", [locale]))
      .catch(() => {
        // Keep the in-memory choice even if persistence is temporarily unavailable.
      })
  },

  loadFromDB: async () => {
    const localLocale = coerceLocale(localStorage.getItem(STORAGE_KEY) || 'en')
    set({ locale: localLocale })
    applyLocale(localLocale)

    try {
      const db = await getDb()
      const rows = await db.select<{ value: string }[]>("SELECT value FROM settings WHERE key = 'locale'")
      const locale = coerceLocale(rows[0]?.value || localLocale)
      set({ locale })
      applyLocale(locale)
    } catch {
      applyLocale(localLocale)
    }
  },
}))
