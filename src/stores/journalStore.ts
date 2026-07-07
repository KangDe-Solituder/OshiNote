import { create } from 'zustand'
import type { Illustration, JournalBook, JournalCoverDecoration, JournalCoverStyle, JournalItemStyle, JournalItemWithNote, JournalPage, Note } from '../types'
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
  sticker_style?: JournalItemStyle
  color?: string | null
  border_style?: string | null
  style_payload?: string
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
  description?: string
  date_label?: string
  background?: string
}

interface JournalState {
  books: JournalBook[]
  postcards: JournalPage[]
  activeBookId: string | null
  activeStandalonePageId: string | null
  pages: JournalPage[]
  activePageId: string | null
  items: JournalItemWithNote[]
  unplacedNotes: Note[]
  unplacedIllustrations: Illustration[]
  loading: boolean
  error: string | null

  loadBookshelf: (oshiId: string) => Promise<void>
  createBook: (oshiId: string, title: string) => Promise<void>
  createPostcard: (oshiId: string, title: string) => Promise<void>
  renameBook: (bookId: string, title: string, oshiId: string) => Promise<void>
  updateBook: (bookId: string, input: BookInput, oshiId: string) => Promise<void>
  deleteBook: (bookId: string, oshiId: string) => Promise<void>
  openBook: (bookId: string, oshiId: string) => Promise<void>
  openPostcard: (pageId: string, oshiId: string) => Promise<void>
  openPageForEditing: (pageId: string, oshiId: string) => Promise<void>
  collectPostcard: (pageId: string, bookId: string, oshiId: string) => Promise<void>
  detachPage: (pageId: string, oshiId: string) => Promise<void>
  deletePostcard: (pageId: string, oshiId: string) => Promise<void>
  closeBook: () => void
  setActivePage: (pageId: string, oshiId?: string) => Promise<void>
  updatePage: (pageId: string, input: PageInput) => Promise<void>
  createPage: (bookId: string) => Promise<void>
  deletePage: (pageId: string, bookId: string) => Promise<void>
  placeNote: (noteId: string, oshiId: string) => Promise<void>
  placeIllustration: (illustrationId: string, oshiId: string) => Promise<void>
  placeTape: () => Promise<void>
  placeMaterial: (materialId: string) => Promise<void>
  loadUnplacedNotes: (oshiId: string) => Promise<void>
  loadUnplacedIllustrations: (oshiId: string) => Promise<void>
  updateItemLayout: (itemId: string, layout: LayoutInput) => Promise<void>
  updateItemStyle: (itemId: string, style: StyleInput) => Promise<void>
  removeItem: (itemId: string) => Promise<void>
  refreshItems: () => Promise<void>
}

export const useJournalStore = create<JournalState>((set, get) => ({
  books: [],
  postcards: [],
  activeBookId: null,
  activeStandalonePageId: null,
  pages: [],
  activePageId: null,
  items: [],
  unplacedNotes: [],
  unplacedIllustrations: [],
  loading: false,
  error: null,

  loadBookshelf: async (oshiId) => {
    set({ loading: true, error: null })
    try {
      const [books, postcards] = await Promise.all([
        journalService.fetchJournalBooks(oshiId),
        journalService.fetchStandalonePostcards(oshiId),
      ])
      set({ books, postcards, activeBookId: null, activeStandalonePageId: null, pages: [], activePageId: null, items: [], unplacedNotes: [], unplacedIllustrations: [], loading: false })
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

  createPostcard: async (oshiId, title) => {
    set({ loading: true, error: null })
    try {
      await journalService.createStandalonePostcard(oshiId, title)
      const postcards = await journalService.fetchStandalonePostcards(oshiId)
      set({ postcards, loading: false })
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
      set({ books, activeBookId: null, activeStandalonePageId: null, pages: [], activePageId: null, items: [], unplacedNotes: [], unplacedIllustrations: [], loading: false })
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
      const [unplacedNotes, unplacedIllustrations] = await Promise.all([
        journalService.fetchUnplacedNotes(activePageId, oshiId),
        journalService.fetchUnplacedIllustrations(activePageId, oshiId),
      ])
      pages = await journalService.fetchJournalPages(bookId)
      set({ activeBookId: bookId, activeStandalonePageId: null, pages, activePageId, items, unplacedNotes, unplacedIllustrations, loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  openPostcard: async (pageId, oshiId) => {
    set({ loading: true, error: null })
    try {
      const items = await journalService.fetchJournalItems(pageId)
      const [unplacedNotes, unplacedIllustrations] = await Promise.all([
        journalService.fetchUnplacedNotes(pageId, oshiId),
        journalService.fetchUnplacedIllustrations(pageId, oshiId),
      ])
      const postcards = await journalService.fetchStandalonePostcards(oshiId)
      const page = postcards.find((candidate) => candidate.id === pageId)
      set({
        activeBookId: null,
        activeStandalonePageId: pageId,
        pages: page ? [page] : [],
        activePageId: pageId,
        items,
        unplacedNotes,
        unplacedIllustrations,
        loading: false,
      })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  openPageForEditing: async (pageId, oshiId) => {
    set({ loading: true, error: null })
    try {
      const page = await journalService.fetchJournalPageById(pageId)
      if (!page) throw new Error('Journal page not found')

      const pages = page.book_id ? await journalService.fetchJournalPages(page.book_id) : [page]
      const items = await journalService.fetchJournalItems(page.id)
      const [unplacedNotes, unplacedIllustrations] = await Promise.all([
        journalService.fetchUnplacedNotes(page.id, oshiId),
        journalService.fetchUnplacedIllustrations(page.id, oshiId),
      ])

      set({
        activeBookId: page.book_id,
        activeStandalonePageId: page.standalone ? page.id : null,
        pages,
        activePageId: page.id,
        items,
        unplacedNotes,
        unplacedIllustrations,
        loading: false,
      })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  collectPostcard: async (pageId, bookId, oshiId) => {
    set({ loading: true, error: null })
    try {
      await journalService.collectPostcardIntoBook(pageId, bookId)
      const [books, postcards] = await Promise.all([
        journalService.fetchJournalBooks(oshiId),
        journalService.fetchStandalonePostcards(oshiId),
      ])
      set({ books, postcards, activeStandalonePageId: null, pages: [], activePageId: null, items: [], unplacedNotes: [], unplacedIllustrations: [], loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  detachPage: async (pageId, oshiId) => {
    const activeBookId = get().activeBookId
    set({ loading: true, error: null })
    try {
      await journalService.detachPageToPostcard(pageId, oshiId)
      const [books, postcards] = await Promise.all([
        journalService.fetchJournalBooks(oshiId),
        journalService.fetchStandalonePostcards(oshiId),
      ])
      if (!activeBookId) {
        set({ books, postcards, activeStandalonePageId: pageId, loading: false })
        return
      }
      const pages = await journalService.fetchJournalPages(activeBookId)
      const nextPage = pages[0] || await journalService.ensureJournalPage(activeBookId)
      const items = await journalService.fetchJournalItems(nextPage.id)
      const [unplacedNotes, unplacedIllustrations] = await Promise.all([
        journalService.fetchUnplacedNotes(nextPage.id, oshiId),
        journalService.fetchUnplacedIllustrations(nextPage.id, oshiId),
      ])
      set({ books, postcards, pages: await journalService.fetchJournalPages(activeBookId), activePageId: nextPage.id, items, unplacedNotes, unplacedIllustrations, loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  deletePostcard: async (pageId, oshiId) => {
    set({ loading: true, error: null })
    try {
      await journalService.deleteJournalPage(pageId)
      const postcards = await journalService.fetchStandalonePostcards(oshiId)
      set({ postcards, activeStandalonePageId: null, pages: [], activePageId: null, items: [], unplacedNotes: [], unplacedIllustrations: [], loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  closeBook: () => set({ activeBookId: null, activeStandalonePageId: null, pages: [], activePageId: null, items: [], unplacedNotes: [], unplacedIllustrations: [] }),

  setActivePage: async (pageId, oshiId) => {
    set({ activePageId: pageId, loading: true, error: null })
    try {
      const items = await journalService.fetchJournalItems(pageId)
      const [unplacedNotes, unplacedIllustrations] = oshiId ? await Promise.all([
        journalService.fetchUnplacedNotes(pageId, oshiId),
        journalService.fetchUnplacedIllustrations(pageId, oshiId),
      ]) : [[], []]
      set({ items, unplacedNotes, unplacedIllustrations, loading: false })
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
      const [unplacedNotes, unplacedIllustrations] = await Promise.all([
        journalService.fetchUnplacedNotes(page.id, pages[0]?.oshi_id || ''),
        journalService.fetchUnplacedIllustrations(page.id, pages[0]?.oshi_id || ''),
      ])
      set({ pages, activePageId: page.id, items: [], unplacedNotes, unplacedIllustrations, loading: false })
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
        unplacedIllustrations: [],
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

  placeIllustration: async (illustrationId, oshiId) => {
    const activePageId = get().activePageId
    if (!activePageId) return
    await journalService.createJournalItemForIllustration(activePageId, illustrationId)
    const [items, unplacedIllustrations] = await Promise.all([
      journalService.fetchJournalItems(activePageId),
      journalService.fetchUnplacedIllustrations(activePageId, oshiId),
    ])
    set({ items, unplacedIllustrations })
  },

  placeTape: async () => {
    const activePageId = get().activePageId
    if (!activePageId) return
    await journalService.createJournalItemForTape(activePageId)
    const items = await journalService.fetchJournalItems(activePageId)
    set({ items })
  },

  placeMaterial: async (materialId) => {
    const activePageId = get().activePageId
    if (!activePageId) return
    await journalService.createJournalItemForMaterial(activePageId, materialId)
    const items = await journalService.fetchJournalItems(activePageId)
    set({ items })
  },

  loadUnplacedNotes: async (oshiId) => {
    const activePageId = get().activePageId
    if (!activePageId) return
    const unplacedNotes = await journalService.fetchUnplacedNotes(activePageId, oshiId)
    set({ unplacedNotes })
  },

  loadUnplacedIllustrations: async (oshiId) => {
    const activePageId = get().activePageId
    if (!activePageId) return
    const unplacedIllustrations = await journalService.fetchUnplacedIllustrations(activePageId, oshiId)
    set({ unplacedIllustrations })
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
