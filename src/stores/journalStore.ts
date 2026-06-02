import { create } from 'zustand'
import type { JournalItemWithNote, JournalPage, JournalStickerStyle, Note } from '../types'
import * as journalService from '../features/journal/journalService'

interface LayoutInput {
  x: number
  y: number
  width: number
  height: number
  rotation: number
  z_index?: number
}

interface StyleInput {
  sticker_style?: JournalStickerStyle
  color?: string | null
  border_style?: string | null
}

interface JournalState {
  pages: JournalPage[]
  activePageId: string | null
  items: JournalItemWithNote[]
  unplacedNotes: Note[]
  loading: boolean
  error: string | null

  loadArchiveJournal: (archiveId: string) => Promise<void>
  setActivePage: (pageId: string) => Promise<void>
  createPage: (archiveId: string) => Promise<void>
  deletePage: (pageId: string, archiveId: string) => Promise<void>
  placeNote: (noteId: string, archiveId: string) => Promise<void>
  loadUnplacedNotes: (archiveId: string) => Promise<void>
  updateItemLayout: (itemId: string, layout: LayoutInput) => Promise<void>
  updateItemStyle: (itemId: string, style: StyleInput) => Promise<void>
  removeItem: (itemId: string) => Promise<void>
  refreshItems: () => Promise<void>
}

export const useJournalStore = create<JournalState>((set, get) => ({
  pages: [],
  activePageId: null,
  items: [],
  unplacedNotes: [],
  loading: false,
  error: null,

  loadArchiveJournal: async (archiveId) => {
    set({ loading: true, error: null })
    try {
      const firstPage = await journalService.ensureJournalPage(archiveId)
      let pages = await journalService.fetchJournalPages(archiveId)
      const activePageId = get().activePageId && pages.some((page) => page.id === get().activePageId)
        ? get().activePageId!
        : firstPage.id

      const items = await journalService.fetchJournalItems(activePageId)
      const unplacedNotes = await journalService.fetchUnplacedNotes(activePageId, archiveId)
      pages = await journalService.fetchJournalPages(archiveId)
      set({ pages, activePageId, items, unplacedNotes, loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  setActivePage: async (pageId) => {
    set({ activePageId: pageId, loading: true, error: null })
    try {
      const items = await journalService.fetchJournalItems(pageId)
      set({ items, unplacedNotes: [], loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  createPage: async (archiveId) => {
    set({ loading: true, error: null })
    try {
      const page = await journalService.createJournalPage(archiveId)
      const pages = await journalService.fetchJournalPages(archiveId)
      set({ pages, activePageId: page.id, items: [], unplacedNotes: [], loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  deletePage: async (pageId, archiveId) => {
    const pages = get().pages
    if (pages.length <= 1) return
    set({ loading: true, error: null })
    try {
      await journalService.deleteJournalPage(pageId)
      const remainingPages = await journalService.fetchJournalPages(archiveId)
      const nextPage = remainingPages[0]
      const items = nextPage ? await journalService.fetchJournalItems(nextPage.id) : []
      set({
        pages: remainingPages,
        activePageId: nextPage?.id || null,
        items,
        unplacedNotes: [],
        loading: false,
      })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  placeNote: async (noteId, archiveId) => {
    const activePageId = get().activePageId
    if (!activePageId) return
    await journalService.createJournalItemForNote(activePageId, noteId)
    const [items, unplacedNotes] = await Promise.all([
      journalService.fetchJournalItems(activePageId),
      journalService.fetchUnplacedNotes(activePageId, archiveId),
    ])
    set({ items, unplacedNotes })
  },

  loadUnplacedNotes: async (archiveId) => {
    const activePageId = get().activePageId
    if (!activePageId) return
    const unplacedNotes = await journalService.fetchUnplacedNotes(activePageId, archiveId)
    set({ unplacedNotes })
  },

  updateItemLayout: async (itemId, layout) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === itemId ? { ...item, ...layout, z_index: layout.z_index ?? item.z_index } : item
      ),
    }))
    await journalService.updateJournalItemLayout(itemId, layout)
  },

  updateItemStyle: async (itemId, style) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === itemId ? { ...item, ...style } : item
      ),
    }))
    await journalService.updateJournalItemStyle(itemId, style)
  },

  removeItem: async (itemId) => {
    set((state) => ({ items: state.items.filter((item) => item.id !== itemId) }))
    await journalService.removeJournalItem(itemId)
  },

  refreshItems: async () => {
    const activePageId = get().activePageId
    if (!activePageId) return
    const items = await journalService.fetchJournalItems(activePageId)
    set({ items })
  },
}))
