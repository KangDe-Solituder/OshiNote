import { create } from 'zustand'
import type { JournalBook, JournalCoverDecoration, JournalCoverStyle, JournalItemWithNote, JournalPage, JournalStickerStyle, Note } from '../types'
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

interface BookInput {
  title?: string
  description?: string
  cover_style?: JournalCoverStyle
  cover_color?: string
  cover_decoration?: JournalCoverDecoration
  date_label?: string
}

interface PageInput {
  title?: string
  background?: string
}

interface JournalState {
  books: JournalBook[]
  activeBookId: string | null
  pages: JournalPage[]
  activePageId: string | null
  items: JournalItemWithNote[]
  unplacedNotes: Note[]
  loading: boolean
  error: string | null

  loadBookshelf: (oshiId: string) => Promise<void>
  createBook: (oshiId: string, title: string) => Promise<void>
  renameBook: (bookId: string, title: string, oshiId: string) => Promise<void>
  updateBook: (bookId: string, input: BookInput, oshiId: string) => Promise<void>
  deleteBook: (bookId: string, oshiId: string) => Promise<void>
  openBook: (bookId: string, oshiId: string) => Promise<void>
  closeBook: () => void
  setActivePage: (pageId: string, oshiId?: string) => Promise<void>
  updatePage: (pageId: string, input: PageInput) => Promise<void>
  createPage: (bookId: string) => Promise<void>
  deletePage: (pageId: string, bookId: string) => Promise<void>
  placeNote: (noteId: string, oshiId: string) => Promise<void>
  loadUnplacedNotes: (oshiId: string) => Promise<void>
  updateItemLayout: (itemId: string, layout: LayoutInput) => Promise<void>
  updateItemStyle: (itemId: string, style: StyleInput) => Promise<void>
  removeItem: (itemId: string) => Promise<void>
  refreshItems: () => Promise<void>
}

export const useJournalStore = create<JournalState>((set, get) => ({
  books: [],
  activeBookId: null,
  pages: [],
  activePageId: null,
  items: [],
  unplacedNotes: [],
  loading: false,
  error: null,

  loadBookshelf: async (oshiId) => {
    set({ loading: true, error: null })
    try {
      const books = await journalService.fetchJournalBooks(oshiId)
      set({ books, activeBookId: null, pages: [], activePageId: null, items: [], unplacedNotes: [], loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  createBook: async (oshiId, title) => {
    set({ loading: true, error: null })
    try {
      await journalService.createJournalBook(oshiId, title)
      const books = await journalService.fetchJournalBooks(oshiId)
      set({ books, loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  renameBook: async (bookId, title, oshiId) => {
    await journalService.updateJournalBook(bookId, { title })
    const books = await journalService.fetchJournalBooks(oshiId)
    set({ books })
  },

  updateBook: async (bookId, input, oshiId) => {
    await journalService.updateJournalBook(bookId, input)
    const books = await journalService.fetchJournalBooks(oshiId)
    set({ books })
  },

  deleteBook: async (bookId, oshiId) => {
    set({ loading: true, error: null })
    try {
      await journalService.deleteJournalBook(bookId)
      const books = await journalService.fetchJournalBooks(oshiId)
      set({ books, activeBookId: null, pages: [], activePageId: null, items: [], unplacedNotes: [], loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  openBook: async (bookId, oshiId) => {
    set({ loading: true, error: null })
    try {
      const firstPage = await journalService.ensureJournalPage(bookId)
      let pages = await journalService.fetchJournalPages(bookId)
      const activePageId = get().activePageId && pages.some((page) => page.id === get().activePageId)
        ? get().activePageId!
        : firstPage.id

      const items = await journalService.fetchJournalItems(activePageId)
      const unplacedNotes = await journalService.fetchUnplacedNotes(activePageId, oshiId)
      pages = await journalService.fetchJournalPages(bookId)
      set({ activeBookId: bookId, pages, activePageId, items, unplacedNotes, loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  closeBook: () => set({ activeBookId: null, pages: [], activePageId: null, items: [], unplacedNotes: [] }),

  setActivePage: async (pageId, oshiId) => {
    set({ activePageId: pageId, loading: true, error: null })
    try {
      const items = await journalService.fetchJournalItems(pageId)
      const unplacedNotes = oshiId ? await journalService.fetchUnplacedNotes(pageId, oshiId) : []
      set({ items, unplacedNotes, loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  updatePage: async (pageId, input) => {
    await journalService.updateJournalPage(pageId, input)
    set((state) => ({
      pages: state.pages.map((page) =>
        page.id === pageId ? { ...page, ...input } : page
      ),
    }))
  },

  createPage: async (bookId) => {
    set({ loading: true, error: null })
    try {
      const page = await journalService.createJournalPage(bookId)
      const pages = await journalService.fetchJournalPages(bookId)
      set({ pages, activePageId: page.id, items: [], unplacedNotes: [], loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  deletePage: async (pageId, bookId) => {
    const pages = get().pages
    if (pages.length <= 1) return
    set({ loading: true, error: null })
    try {
      await journalService.deleteJournalPage(pageId)
      const remainingPages = await journalService.fetchJournalPages(bookId)
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

  placeNote: async (noteId, oshiId) => {
    const activePageId = get().activePageId
    if (!activePageId) return
    await journalService.createJournalItemForNote(activePageId, noteId)
    const [items, unplacedNotes] = await Promise.all([
      journalService.fetchJournalItems(activePageId),
      journalService.fetchUnplacedNotes(activePageId, oshiId),
    ])
    set({ items, unplacedNotes })
  },

  loadUnplacedNotes: async (oshiId) => {
    const activePageId = get().activePageId
    if (!activePageId) return
    const unplacedNotes = await journalService.fetchUnplacedNotes(activePageId, oshiId)
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
