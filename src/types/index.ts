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
export type StampMaterialId = 'round' | 'oval' | 'date' | 'ticket' | 'wax' | 'paper-label' | 'seal-script' | 'running-script' | 'flourish' | 'calligraphy'

export interface StampSnapshotV2 {
  version: 2
  template_id: StampTemplateId | string
  label_key?: string
  default_label: string
  color: string
  rotation: number
  material_id: StampMaterialId
  shape: 'round' | 'oval' | 'date' | 'ticket' | 'wax' | 'paper-label' | 'seal-script' | 'running-script' | 'flourish' | 'calligraphy'
  texture: 'ink' | 'paper' | 'wax' | 'ticket' | 'seal'
  border_style: 'double' | 'solid' | 'dashed' | 'perforated'
}

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

export interface StampPreset {
  id: string
  name: string
  template_id: StampTemplateId | string
  material_id: StampMaterialId
  label: string
  color: string
  size: number
  rotation: number
  opacity: number
  updated_at: string
}

export type ThemeId = 'pink-cozy' | 'dark-night' | 'soft-blue' | 'sakura' | 'rainy-cafe'

export type Locale = 'en' | 'zh' | 'ja'
export type UiMotionDuration = 'off' | 'fast' | 'normal' | 'slow'

export type ViewMode = 'card' | 'list' | 'graph' | 'journal'
export type CardStyle = 'basic' | 'sticky' | 'bookshelf' | 'postcard'
export type JournalStickerStyle = 'sticky' | 'memo' | 'ticket'
export type JournalTapeStyle = 'washi' | 'grid' | 'dots' | 'stripe' | 'torn'
export type JournalItemStyle = JournalStickerStyle | JournalTapeStyle
export type JournalItemType = 'note' | 'illustration' | 'tape' | 'material' | 'memo'
export type JournalMaterialKind = 'tape' | 'sticker' | 'paper' | 'label' | 'frame'
export type JournalPageType = 'book_page' | 'postcard'
export type JournalPageOrientation = 'portrait' | 'landscape'
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
  orientation: JournalPageOrientation
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
  sticker_style: JournalItemStyle
  color: string | null
  border_style: string | null
  material_id: string | null
  material_snapshot: string
  style_payload: string
  created_at: string
  updated_at: string
}

export type JournalDraftItemType = 'note' | 'illustration' | 'material'

export interface JournalDraftItem {
  draftId: string
  originItemId?: string
  itemType: JournalDraftItemType
  sourceId?: string
  materialId?: string
  materialSnapshot?: string
  stylePayload?: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
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
export type OshiNoteArchiveFilter = 'all' | 'unfiled' | 'archive'

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
  archiveFilter?: OshiNoteArchiveFilter
  archiveId?: string | null
  tag?: string
  dateFrom?: string
  dateTo?: string
  page: number
  pageSize: number
}

export interface OshiArchiveNoteCounts {
  all: number
  unfiled: number
  byArchiveId: Record<string, number>
}
