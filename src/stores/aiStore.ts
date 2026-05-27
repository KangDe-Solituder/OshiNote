import { create } from 'zustand'
import type { AiConfig, AiProviderId } from '../services/ai'
import { DEFAULT_AI_CONFIG, createProvider } from '../services/ai'
import { getDb } from '../database'

interface AiState {
  config: AiConfig
  loading: boolean

  setProvider: (provider: AiProviderId) => void
  setEnabled: (enabled: boolean) => void
  setProviderConfig: (
    provider: AiProviderId,
    key: 'apiKey' | 'model' | 'baseUrl',
    value: string
  ) => void

  loadFromDB: () => Promise<void>
  persistToDB: () => Promise<void>

  getActiveProvider: () => ReturnType<typeof createProvider>
}

export const useAiStore = create<AiState>((set, get) => ({
  config: { ...DEFAULT_AI_CONFIG },
  loading: false,

  setProvider: (provider) => {
    set((s) => ({ config: { ...s.config, provider } }))
    get().persistToDB()
  },

  setEnabled: (enabled) => {
    set((s) => ({ config: { ...s.config, enabled } }))
    get().persistToDB()
  },

  setProviderConfig: (provider, key, value) => {
    set((s) => ({
      config: {
        ...s.config,
        [provider]: { ...s.config[provider], [key]: value },
      },
    }))
    get().persistToDB()
  },

  loadFromDB: async () => {
    try {
      const db = await getDb()
      const rows = await db.select<{ key: string; value: string }[]>(
        "SELECT key, value FROM settings WHERE key IN ('aiConfig')"
      )
      for (const row of rows) {
        if (row.key === 'aiConfig' && row.value) {
          try {
            const saved = JSON.parse(row.value)
            set({ config: { ...DEFAULT_AI_CONFIG, ...saved } })
          } catch { /* ignore parse errors */ }
        }
      }
    } catch {
      // DB not ready yet
    }
  },

  persistToDB: async () => {
    try {
      const db = await getDb()
      await db.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('aiConfig', ?)",
        [JSON.stringify(get().config)]
      )
    } catch {
      // silently fail
    }
  },

  getActiveProvider: () => {
    return createProvider(get().config)
  },
}))
