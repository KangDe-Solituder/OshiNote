import { create } from 'zustand'
import type { Oshi, CreateOshiInput, UpdateOshiInput } from '../types'
import * as oshiService from '../features/oshis/oshiService'
import * as archiveService from '../features/oshis/archiveService'

interface OshiState {
  oshis: Oshi[]
  oshiNoteCounts: Record<string, number>
  loading: boolean
  error: string | null

  fetchAll: () => Promise<void>
  createOshi: (input: CreateOshiInput) => Promise<Oshi>
  updateOshi: (id: string, input: UpdateOshiInput) => Promise<void>
  deleteOshi: (id: string) => Promise<void>
}

export const useOshiStore = create<OshiState>((set, get) => ({
  oshis: [],
  oshiNoteCounts: {},
  loading: false,
  error: null,

  fetchAll: async () => {
    set({ loading: true, error: null })
    try {
      const oshis = await oshiService.fetchAllOshis()
      const counts: Record<string, number> = {}
      for (const oshi of oshis) {
        counts[oshi.id] = await oshiService.getOshiNoteCount(oshi.id)
      }
      set({ oshis, oshiNoteCounts: counts, loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  createOshi: async (input) => {
    const oshi = await oshiService.createOshi(input)
    await archiveService.createDefaultArchives(oshi.id)
    await get().fetchAll()
    return oshi
  },

  updateOshi: async (id, input) => {
    await oshiService.updateOshi(id, input)
    await get().fetchAll()
  },

  deleteOshi: async (id) => {
    await oshiService.deleteOshi(id)
    await get().fetchAll()
  },
}))
