import { create } from 'zustand'
import { getDb } from '../database'

interface UpdateState {
  checkOnStartup: boolean
  loaded: boolean

  setCheckOnStartup: (enabled: boolean) => void
  loadFromDB: () => Promise<void>
  persistToDB: () => Promise<void>
}

export const useUpdateStore = create<UpdateState>((set, get) => ({
  checkOnStartup: true,
  loaded: false,

  setCheckOnStartup: (enabled) => {
    set({ checkOnStartup: enabled })
    get().persistToDB()
  },

  loadFromDB: async () => {
    try {
      const db = await getDb()
      const rows = await db.select<{ value: string }[]>(
        "SELECT value FROM settings WHERE key = 'checkUpdatesOnStartup'"
      )
      const saved = rows[0]?.value
      if (saved === 'true' || saved === 'false') {
        set({ checkOnStartup: saved === 'true', loaded: true })
        return
      }
    } catch {
      // Keep the default enabled if settings are not available yet.
    }
    set({ loaded: true })
  },

  persistToDB: async () => {
    try {
      const db = await getDb()
      await db.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('checkUpdatesOnStartup', ?)",
        [String(get().checkOnStartup)]
      )
    } catch {
      // Silently keep the in-memory preference.
    }
  },
}))
