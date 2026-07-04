import { create } from 'zustand'
import type { Archive } from '../types'
import * as archiveService from '../features/oshis/archiveService'

interface ArchiveState {
  archives: Archive[]
  activeArchiveId: string | null
  loading: boolean

  fetchByOshi: (oshiId: string) => Promise<void>
  createArchive: (oshiId: string, name: string) => Promise<Archive>
  updateArchive: (id: string, name: string) => Promise<void>
  updateArchiveList: (oshiId: string, archives: { id: string; name: string }[]) => Promise<void>
  deleteArchive: (id: string) => Promise<void>
  getArchiveNoteCount: (id: string) => Promise<number>
  setActiveArchive: (id: string | null) => void
}

export const useArchiveStore = create<ArchiveState>((set, get) => ({
  archives: [],
  activeArchiveId: null,
  loading: false,

  fetchByOshi: async (oshiId: string) => {
    set({ loading: true })
    try {
      const archives = await archiveService.fetchArchivesByOshi(oshiId)
      const activeId = get().activeArchiveId
      const firstId = archives.length > 0 ? archives[0].id : null
      set({
        archives,
        activeArchiveId: activeId && archives.find(a => a.id === activeId) ? activeId : firstId,
        loading: false,
      })
    } catch {
      set({ loading: false })
    }
  },

  createArchive: async (oshiId, name) => {
    const archive = await archiveService.createArchive(oshiId, name)
    await get().fetchByOshi(oshiId)
    return archive
  },

  updateArchive: async (id, name) => {
    await archiveService.updateArchive(id, name)
    // re-fetch is implied
  },

  updateArchiveList: async (oshiId, archives) => {
    await archiveService.updateArchiveList(archives)
    await get().fetchByOshi(oshiId)
  },

  deleteArchive: async (id) => {
    await archiveService.deleteArchive(id)
  },

  getArchiveNoteCount: async (id) => {
    return archiveService.getArchiveNoteCount(id)
  },

  setActiveArchive: (id) => set({ activeArchiveId: id }),
}))
