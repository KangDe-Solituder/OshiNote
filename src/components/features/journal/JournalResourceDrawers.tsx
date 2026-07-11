import clsx from 'clsx'
import { Check, ChevronLeft, ChevronRight, ImageIcon, Loader2, Search, Sparkles, StickyNote } from 'lucide-react'
import { useMemo, type PointerEvent, type ReactNode } from 'react'
import type { Illustration, JournalMaterialKind, JournalPageOrientation, Note, StampInput } from '../../../types'
import { useI18n } from '../../../i18n/useI18n'
import { JOURNAL_BACKGROUND_PRESETS } from '../../../features/journal/journalBackgrounds'
import { JOURNAL_MATERIAL_KINDS, JOURNAL_MATERIALS } from '../../../features/journal/journalMaterials'
import { getJournalPageTemplateDefinition } from '../../../features/journal/journalPageTemplates'
import { Button } from '../../ui/Button'
import { StampControl } from '../stamps/StampControl'
import { JournalMaterialTile } from './JournalMaterialTile'
import type { DragPayload } from './JournalDraftCanvas'
import type { JournalImageFilter, JournalNoteFilter } from './journalCreationTypes'

const NOTE_PAGE_SIZE = 20
const IMAGE_PAGE_SIZE = 20
const MATERIAL_PAGE_SIZE = 12

export function JournalNotesDrawer({ notes, loading, query, filter, page, placedIds, onQueryChange, onFilterChange, onPageChange, onPointerPlace }: {
  notes: Note[]
  loading: boolean
  query: string
  filter: JournalNoteFilter
  page: number
  placedIds: Set<string>
  onQueryChange: (query: string) => void
  onFilterChange: (filter: JournalNoteFilter) => void
  onPageChange: (page: number) => void
  onPointerPlace: (payload: DragPayload, event: PointerEvent<HTMLElement>) => void
}) {
  const { t } = useI18n()
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return notes.filter((note) => {
      if (filter === 'favorite' && !note.favorite) return false
      if (filter === 'tagged' && note.tags.length === 0) return false
      if (filter === 'untagged' && note.tags.length > 0) return false
      if (!needle) return true
      return [note.title, note.plain_text, note.tags.join(' ')].some((value) => value.toLowerCase().includes(needle))
    })
  }, [filter, notes, query])
  const totalPages = Math.max(1, Math.ceil(filtered.length / NOTE_PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * NOTE_PAGE_SIZE, page * NOTE_PAGE_SIZE)
  return (
    <DrawerSection
      searchValue={query}
      searchPlaceholder={t('journalCreate.searchNotes')}
      onSearchChange={onQueryChange}
      filters={[
        ['all', t('journalCreate.filter.all')],
        ['favorite', t('journalCreate.filter.favorite')],
        ['tagged', t('journalCreate.filter.tagged')],
        ['untagged', t('journalCreate.filter.untagged')],
      ]}
      activeFilter={filter}
      onFilterChange={(value) => onFilterChange(value as JournalNoteFilter)}
      page={page}
      totalPages={totalPages}
      onPageChange={onPageChange}
    >
      {loading ? <EmptyDrawerMessage>{t('common.loading')}</EmptyDrawerMessage> : pageItems.length === 0 ? <EmptyDrawerMessage>{t('journalCreate.emptyNotes')}</EmptyDrawerMessage> : pageItems.map((note) => (
        <ResourceRow
          key={note.id}
          title={note.title || t('common.untitled')}
          meta={new Date(note.created_at).toLocaleDateString()}
          tags={note.tags}
          placed={placedIds.has(note.id)}
          payload={{ kind: 'note', id: note.id }}
          onPointerPlace={onPointerPlace}
        />
      ))}
    </DrawerSection>
  )
}

export function JournalImagesDrawer({ illustrations, loading, query, filter, page, placedIds, onQueryChange, onFilterChange, onPageChange, onPointerPlace }: {
  illustrations: Illustration[]
  loading: boolean
  query: string
  filter: JournalImageFilter
  page: number
  placedIds: Set<string>
  onQueryChange: (query: string) => void
  onFilterChange: (filter: JournalImageFilter) => void
  onPageChange: (page: number) => void
  onPointerPlace: (payload: DragPayload, event: PointerEvent<HTMLElement>) => void
}) {
  const { t } = useI18n()
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return illustrations.filter((illustration) => {
      if (filter === 'official' && illustration.category !== 'official') return false
      if (filter === 'fanart' && illustration.category !== 'fanart') return false
      if (filter === 'favorite' && !illustration.favorite) return false
      if (!needle) return true
      return [illustration.title, illustration.artist, illustration.owner, illustration.tags.join(' ')].some((value) => value.toLowerCase().includes(needle))
    })
  }, [filter, illustrations, query])
  const totalPages = Math.max(1, Math.ceil(filtered.length / IMAGE_PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * IMAGE_PAGE_SIZE, page * IMAGE_PAGE_SIZE)
  return (
    <DrawerSection
      searchValue={query}
      searchPlaceholder={t('journalCreate.searchImages')}
      onSearchChange={onQueryChange}
      filters={[
        ['all', t('journalCreate.filter.all')],
        ['official', t('journalCreate.filter.official')],
        ['fanart', t('journalCreate.filter.fanart')],
        ['favorite', t('journalCreate.filter.favorite')],
      ]}
      activeFilter={filter}
      onFilterChange={(value) => onFilterChange(value as JournalImageFilter)}
      page={page}
      totalPages={totalPages}
      onPageChange={onPageChange}
    >
      {loading ? <EmptyDrawerMessage>{t('common.loading')}</EmptyDrawerMessage> : pageItems.length === 0 ? <EmptyDrawerMessage>{t('journalCreate.emptyIllustrations')}</EmptyDrawerMessage> : pageItems.map((illustration) => (
        <ResourceRow
          key={illustration.id}
          title={illustration.title || illustration.original_filename || t('common.untitled')}
          meta={illustration.artist || illustration.owner || t('common.unknownArtist')}
          tags={illustration.tags}
          placed={placedIds.has(illustration.id)}
          payload={{ kind: 'illustration', id: illustration.id }}
          leading={<ImageIcon size={18} />}
          onPointerPlace={onPointerPlace}
        />
      ))}
    </DrawerSection>
  )
}

export function JournalMaterialsDrawer({ kind, page, onKindChange, onPageChange, onPointerPlace }: {
  kind: 'all' | JournalMaterialKind
  page: number
  onKindChange: (kind: 'all' | JournalMaterialKind) => void
  onPageChange: (page: number) => void
  onPointerPlace: (payload: DragPayload, event: PointerEvent<HTMLElement>) => void
}) {
  const { t } = useI18n()
  const filtered = kind === 'all' ? JOURNAL_MATERIALS : JOURNAL_MATERIALS.filter((material) => material.kind === kind)
  const totalPages = Math.max(1, Math.ceil(filtered.length / MATERIAL_PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * MATERIAL_PAGE_SIZE, page * MATERIAL_PAGE_SIZE)
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {JOURNAL_MATERIAL_KINDS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onKindChange(item.id)}
            className={clsx('h-8 rounded-full border px-3 text-xs font-semibold transition-colors', kind === item.id ? 'border-accent bg-accent-soft text-accent' : 'border-border-color bg-bg-secondary text-text-secondary hover:border-border-hover')}
          >
            {t(item.labelKey)}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {pageItems.map((material) => (
          <div
            key={material.id}
            role="button"
            tabIndex={0}
            draggable
            onDragStart={(event) => setDragPayload(event.dataTransfer, { kind: 'material', id: material.id })}
            onPointerDown={(event) => onPointerPlace({ kind: 'material', id: material.id }, event)}
            className="cursor-grab rounded-xl border border-border-color bg-bg-secondary p-2 text-left transition-colors hover:border-border-hover active:cursor-grabbing"
          >
            <JournalMaterialTile material={material} compact />
            <span className="mt-2 block truncate text-xs font-semibold text-text-primary">{t(material.nameKey)}</span>
          </div>
        ))}
      </div>
      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  )
}

export function JournalStampDrawer({ value, placing, onClear, onStartPlacement, onCancelPlacement }: {
  value: StampInput | null
  placing: boolean
  onClear: () => void
  onStartPlacement: (stamp: StampInput) => void
  onCancelPlacement: () => void
}) {
  const { t } = useI18n()
  return (
    <div className="grid gap-3">
      <p className="text-sm leading-relaxed text-text-muted">{t('journalCreate.stampPlacementHint')}</p>
      <StampControl value={value} onClear={onClear} onStartPlacement={onStartPlacement} onCancelPlacement={onCancelPlacement} placing={placing} />
      {value ? <p className="text-xs font-semibold text-accent">{t('journalCreate.stampPlaced')}</p> : <p className="text-xs text-text-muted">{t('journalCreate.stampNotPlaced')}</p>}
    </div>
  )
}

export function JournalReviewDrawer({ title, dateLabel, description, background, orientation, templateId, itemCount, stamp, creating, canCreate, onCreate, submitLabel, submittingLabel }: {
  title: string
  dateLabel: string
  description: string
  background: string
  orientation: JournalPageOrientation
  templateId: string | null
  itemCount: number
  stamp: StampInput | null
  creating: boolean
  canCreate: boolean
  onCreate: () => void
  submitLabel: string
  submittingLabel: string
}) {
  const { t } = useI18n()
  const preset = JOURNAL_BACKGROUND_PRESETS.find((item) => item.id === background)
  const template = getJournalPageTemplateDefinition(templateId)
  return (
    <div className="grid gap-3">
      <ReviewCard label={t('journalCreate.review.storage')} value={title || t('journalEditor.defaultPageTitle')} subValue={description || dateLabel} />
      <ReviewCard label={t('journalTemplates.startingLayout')} value={template ? t(template.nameKey) : t('journalTemplates.blank.name')} />
      <ReviewCard label={t('journalCreate.review.background')} value={preset ? t(preset.labelKey) : background} />
      <ReviewCard label={t('journalCreate.review.orientation')} value={t(`journalCreate.orientation.${orientation}` as never)} />
      <ReviewCard label={t('journalCreate.review.items')} value={String(itemCount)} />
      <ReviewCard label={t('journalCreate.review.stamp')} value={stamp ? t('journalCreate.stampPlaced') : t('journalCreate.stampNotPlaced')} />
      <Button variant="primary" size="sm" onClick={onCreate} disabled={!canCreate}>
        {creating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
        {creating ? submittingLabel : submitLabel}
      </Button>
    </div>
  )
}

function DrawerSection({ searchValue, searchPlaceholder, filters, activeFilter, page, totalPages, children, onSearchChange, onFilterChange, onPageChange }: {
  searchValue: string
  searchPlaceholder: string
  filters: [string, string][]
  activeFilter: string
  page: number
  totalPages: number
  children: ReactNode
  onSearchChange: (value: string) => void
  onFilterChange: (value: string) => void
  onPageChange: (page: number) => void
}) {
  return (
    <div>
      <label className="relative mb-3 block">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input value={searchValue} onChange={(event) => onSearchChange(event.target.value)} className={`${fieldClassName} w-full pl-9`} placeholder={searchPlaceholder} />
      </label>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {filters.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onFilterChange(id)}
            className={clsx('h-8 rounded-full border px-3 text-xs font-semibold transition-colors', activeFilter === id ? 'border-accent bg-accent-soft text-accent' : 'border-border-color bg-bg-secondary text-text-secondary hover:border-border-hover')}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid gap-2">{children}</div>
      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  )
}

function ResourceRow({ title, meta, tags, placed, payload, leading, onPointerPlace }: {
  title: string
  meta: string
  tags: string[]
  placed: boolean
  payload: DragPayload
  leading?: ReactNode
  onPointerPlace: (payload: DragPayload, event: PointerEvent<HTMLElement>) => void
}) {
  const { t } = useI18n()
  return (
    <div
      role="button"
      tabIndex={placed ? -1 : 0}
      draggable={!placed}
      onDragStart={(event) => setDragPayload(event.dataTransfer, payload)}
      onPointerDown={(event) => { if (!placed) onPointerPlace(payload, event) }}
      className={clsx('flex min-h-[76px] w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors', placed ? 'cursor-default border-accent bg-accent-soft/45 text-accent' : 'cursor-grab border-border-color bg-bg-primary/70 hover:border-border-hover active:cursor-grabbing')}
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-bg-secondary text-accent">
        {placed ? <Check size={16} /> : leading || <StickyNote size={17} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-text-primary">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-text-muted">{placed ? t('journalCreate.placed') : meta}</span>
        <span className="mt-2 flex gap-1 overflow-hidden">
          {tags.slice(0, 3).map((tag) => <span key={tag} className="shrink-0 rounded-full bg-bg-secondary px-2 py-0.5 text-[11px] text-text-muted">{tag}</span>)}
        </span>
      </span>
    </div>
  )
}

function Pagination({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (page: number) => void }) {
  return (
    <div className="mt-3 flex items-center justify-between">
      <button type="button" className={pagerButtonClass} onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}><ChevronLeft size={15} /></button>
      <span className="text-xs font-semibold text-text-muted">{page} / {totalPages}</span>
      <button type="button" className={pagerButtonClass} onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}><ChevronRight size={15} /></button>
    </div>
  )
}

function ReviewCard({ label, value, subValue }: { label: string; value: string; subValue?: string }) {
  return (
    <div className="rounded-xl border border-border-color bg-bg-secondary/45 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-text-primary">{value}</p>
      {subValue ? <p className="mt-1 truncate text-xs text-text-muted">{subValue}</p> : null}
    </div>
  )
}

function EmptyDrawerMessage({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-border-color px-4 py-10 text-center text-sm text-text-muted">{children}</div>
}

function setDragPayload(dataTransfer: DataTransfer, payload: DragPayload) {
  dataTransfer.effectAllowed = 'copy'
  dataTransfer.setData('application/x-oshinote-journal-resource', JSON.stringify(payload))
  dataTransfer.setData('text/plain', payload.id)
}

const fieldClassName = 'min-w-0 rounded-xl border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-secondary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-soft disabled:opacity-50'
const pagerButtonClass = 'flex h-8 w-8 items-center justify-center rounded-lg border border-border-color text-text-muted transition-colors hover:border-border-hover hover:text-accent disabled:cursor-not-allowed disabled:opacity-40'
