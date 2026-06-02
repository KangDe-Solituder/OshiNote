export interface Oshi {
  id: string
  name: string
  avatar?: string
  color?: string
  description: string
  activity_links: string[] // parsed from JSON string
  created_at: string
}

export interface OshiRow {
  id: string
  name: string
  avatar?: string
  color?: string
  description: string | null
  activity_links: string | null // JSON string from DB
  created_at: string
}

export interface Archive {
  id: string
  oshi_id: string
  name: string
  sort_order: number
  created_at: string
}

export interface Note {
  id: string
  oshi_id: string | null
  archive_id: string | null
  title: string
  content: string // Tiptap JSON string
  plain_text: string
  tags: string[] // parsed from JSON string
  favorite: boolean
  created_at: string
  updated_at: string
}

export interface NoteRow {
  id: string
  oshi_id: string | null
  archive_id: string | null
  title: string
  content: string
  plain_text: string
  tags: string // JSON string from DB
  favorite: number // 0 or 1 from SQLite
  created_at: string
  updated_at: string
}

export interface NoteImage {
  id: string
  note_id: string
  data_url: string
  sort_order: number
  created_at: string
}

export type ThemeId = 'pink-cozy' | 'dark-night' | 'soft-blue' | 'sakura' | 'rainy-cafe'
export type UiMotionDuration = 'off' | 'fast' | 'normal' | 'slow'

export type ViewMode = 'card' | 'list' | 'graph' | 'journal'
export type CardStyle = 'basic' | 'sticky' | 'bookshelf' | 'postcard'
export type JournalStickerStyle = 'sticky' | 'memo' | 'ticket'
export type JournalItemType = 'note'

export interface JournalPage {
  id: string
  archive_id: string
  title: string
  page_index: number
  background: string
  created_at: string
  updated_at: string
}

export interface JournalItem {
  id: string
  page_id: string
  note_id: string
  item_type: JournalItemType
  x: number
  y: number
  width: number
  height: number
  rotation: number
  z_index: number
  sticker_style: JournalStickerStyle
  color: string | null
  border_style: string | null
  created_at: string
  updated_at: string
}

export interface JournalItemRow extends Omit<JournalItem, 'item_type' | 'sticker_style'> {
  item_type: string
  sticker_style: string
}

export interface JournalItemWithNote extends JournalItem {
  note: Note
}

export interface BackgroundFilters {
  blur: number
  brightness: number
  opacity: number
  saturation: number
}

export interface CreateOshiInput {
  name: string
  avatar?: string
  color?: string
  description?: string
  activity_links?: string[]
}

export interface UpdateOshiInput {
  name?: string
  avatar?: string
  color?: string
  description?: string
  activity_links?: string[]
}

export interface CreateNoteInput {
  oshi_id?: string | null
  archive_id?: string | null
  title: string
  content: string
  plain_text: string
  tags: string[]
  created_at?: string
}

export interface UpdateNoteInput {
  title?: string
  content?: string
  plain_text?: string
  tags?: string[]
  oshi_id?: string | null
  archive_id?: string | null
  favorite?: boolean
  created_at?: string
}

export type NoteOwnershipFilter = 'all' | 'unassigned' | 'unfiled' | 'untagged' | 'needs-sorting'
export type NoteSort = 'newest' | 'oldest' | 'updated'

export interface GlobalNoteSearchParams {
  query?: string
  oshiId?: string
  archiveId?: string
  tag?: string
  ownership: NoteOwnershipFilter
  favorite?: boolean
  sort: NoteSort
  page: number
  pageSize: number
}

export interface NoteLibraryItem extends Note {
  oshi_name: string | null
  oshi_avatar: string | null
  oshi_color: string | null
  archive_name: string | null
}

export interface SearchParams {
  query?: string
  tag?: string
  dateFrom?: string
  dateTo?: string
  page: number
  pageSize: number
}
