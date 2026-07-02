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
  source_url: string
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
  source_url: string
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

export type IllustrationCategory = 'official' | 'fanart'
export type IllustrationSort = 'newest' | 'oldest' | 'title'
export type IllustrationTab = 'all' | 'official' | 'fanart' | 'favorites'

export interface Illustration {
  id: string
  oshi_id: string | null
  category: IllustrationCategory
  title: string
  original_path: string
  thumbnail_path: string | null
  original_filename: string
  mime_type: string
  file_size: number
  width: number | null
  height: number | null
  date: string | null
  owner: string
  artist: string
  source_url: string
  tags: string[]
  description: string
  favorite: boolean
  archived: boolean
  created_at: string
  updated_at: string
}

export interface IllustrationRow extends Omit<Illustration, 'category' | 'tags' | 'favorite' | 'archived'> {
  category: string
  tags: string
  favorite: number
  archived: number
}

export interface CreateIllustrationInput {
  id?: string
  oshi_id?: string | null
  category: IllustrationCategory
  title: string
  original_path: string
  thumbnail_path?: string | null
  original_filename: string
  mime_type: string
  file_size: number
  width?: number | null
  height?: number | null
  date?: string | null
  owner?: string
  artist?: string
  source_url?: string
  tags?: string[]
  description?: string
}

export interface UpdateIllustrationInput {
  oshi_id?: string | null
  category?: IllustrationCategory
  title?: string
  date?: string | null
  owner?: string
  artist?: string
  source_url?: string
  tags?: string[]
  description?: string
  favorite?: boolean
  archived?: boolean
}

export interface IllustrationSearchParams {
  oshiId?: string
  unassigned?: boolean
  category?: IllustrationCategory
  favorite?: boolean
  query?: string
  tag?: string
  includeArchived?: boolean
  sort: IllustrationSort
}

export type StampTargetType = 'note' | 'illustration' | 'journal_page' | 'postcard'
export type StampPosition = 'top-left' | 'top-right' | 'center' | 'bottom-left' | 'bottom-right'
export type StampTemplateId = 'recorded' | 'favorite' | 'collected' | 'precious' | 'anniversary'

export type ResourceTemplateType = 'note' | 'journal_page' | 'stamp' | 'material'

export interface TemplateSnapshot {
  template_id: string
  template_type: ResourceTemplateType
  name: string
  payload: string
  captured_at: string
}

export interface ResourceTemplate {
  id: string
  type: ResourceTemplateType
  name: string
  description: string
  source: 'builtin' | 'user'
  payload: string
  hidden: boolean
  deleted: boolean
  created_at: string
  updated_at: string
}

export interface ResourceTemplateRow extends Omit<ResourceTemplate, 'type' | 'source' | 'hidden' | 'deleted'> {
  type: string
  source: string
  hidden: number
  deleted: number
}

export interface Stamp {
  id: string
  target_type: StampTargetType
  target_id: string
  template_id: StampTemplateId | string
  template_snapshot: string
  label: string
  color: string
  position: StampPosition
  x: number
  y: number
  rotation: number
  size: number
  opacity: number
  created_at: string
  updated_at: string
}

export interface StampRow extends Omit<Stamp, 'target_type' | 'position'> {
  target_type: string
  position: string
}

export interface StampInput {
  template_id: StampTemplateId | string
  template_snapshot?: string
  label: string
  color: string
  position: StampPosition
  x?: number
  y?: number
  rotation?: number
  size?: number
  opacity?: number
}

export type ThemeId = 'pink-cozy' | 'dark-night' | 'soft-blue' | 'sakura' | 'rainy-cafe'

export type Locale = 'en' | 'zh' | 'ja'
export type UiMotionDuration = 'off' | 'fast' | 'normal' | 'slow'

export type ViewMode = 'card' | 'list' | 'graph' | 'journal'
export type CardStyle = 'basic' | 'sticky' | 'bookshelf' | 'postcard'
export type JournalStickerStyle = 'sticky' | 'memo' | 'ticket'
export type JournalItemType = 'note' | 'illustration'
export type JournalPageType = 'book_page' | 'postcard'
export type JournalCoverStyle = 'classic' | 'cloth' | 'paper' | 'night' | 'postcard' | 'minimal'
export type JournalCoverDecoration = 'none' | 'flower' | 'moon' | 'heart' | 'camera' | 'ticket'

export interface JournalBook {
  id: string
  oshi_id: string
  title: string
  description: string
  cover_style: JournalCoverStyle
  cover_color: string
  cover_decoration: JournalCoverDecoration
  date_label: string
  sort_order: number
  page_count: number
  updated_at: string
  created_at: string
}

export interface JournalPage {
  id: string
  book_id: string | null
  oshi_id: string
  page_type: JournalPageType
  title: string
  description: string
  date_label: string
  standalone: boolean
  page_index: number
  background: string
  created_at: string
  updated_at: string
}

export interface JournalItem {
  id: string
  page_id: string
  note_id: string | null
  illustration_id: string | null
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
  note: Note | null
  illustration: Illustration | null
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
  source_url?: string
  tags: string[]
  created_at?: string
}

export interface UpdateNoteInput {
  title?: string
  content?: string
  plain_text?: string
  source_url?: string
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
