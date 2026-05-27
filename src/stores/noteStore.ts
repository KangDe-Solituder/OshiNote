import { create } from 'zustand'
import type { Note, CreateNoteInput, UpdateNoteInput, SearchParams, ViewMode, CardStyle } from '../types'
import * as noteService from '../features/notes/noteService'

interface NoteState {
  notes: Note[]
  totalNotes: number
  currentPage: number
  pageSize: number
  viewMode: ViewMode
  cardStyle: CardStyle
  searchQuery: string
  tagFilter: string | null
  loading: boolean
  error: string | null

  fetchByArchive: (archiveId: string, page?: number) => Promise<void>
  search: (oshiId: string, params: SearchParams) => Promise<void>
  createNote: (input: CreateNoteInput) => Promise<Note>
  updateNote: (id: string, input: UpdateNoteInput) => Promise<void>
  deleteNote: (id: string) => Promise<void>
  toggleFavorite: (id: string) => Promise<void>

  setViewMode: (mode: ViewMode) => void
  setCardStyle: (style: CardStyle) => void
  setSearchQuery: (q: string) => void
  setTagFilter: (tag: string | null) => void
  setPage: (page: number) => void
}

export const useNoteStore = create<NoteState>((set, get) => ({
  notes: [],
  totalNotes: 0,
  currentPage: 1,
  pageSize: 20,
  viewMode: 'card',
  cardStyle: 'sticky',
  searchQuery: '',
  tagFilter: null,
  loading: false,
  error: null,

  fetchByArchive: async (archiveId, page) => {
    set({ loading: true, error: null })
    try {
      const p = page || get().currentPage
      const result = await noteService.fetchNotesByArchive(archiveId, p, get().pageSize)
      set({
        notes: result.notes,
        totalNotes: result.total,
        currentPage: p,
        loading: false,
      })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  search: async (oshiId, params) => {
    set({ loading: true, error: null })
    try {
      const result = await noteService.searchNotes(oshiId, params)
      set({
        notes: result.notes,
        totalNotes: result.total,
        currentPage: params.page,
        loading: false,
      })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  createNote: async (input) => {
    const note = await noteService.createNote(input)
    return note
  },

  updateNote: async (id, input) => {
    await noteService.updateNote(id, input)
  },

  deleteNote: async (id) => {
    await noteService.deleteNote(id)
  },

  toggleFavorite: async (id) => {
    await noteService.toggleFavorite(id)
    set((s) => ({
      notes: s.notes.map((n) =>
        n.id === id ? { ...n, favorite: !n.favorite } : n
      ),
    }))
  },

  setViewMode: (mode) => set({ viewMode: mode }),
  setCardStyle: (style) => set({ cardStyle: style }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setTagFilter: (tag) => set({ tagFilter: tag }),
  setPage: (page) => set({ currentPage: page }),
}))
