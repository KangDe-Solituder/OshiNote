import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams } from 'react-router-dom'
import { invoke } from '@tauri-apps/api/core'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import {
  Calendar,
  Check,
  ExternalLink,
  Filter,
  GalleryVerticalEnd,
  Heart,
  ImageIcon,
  LayoutGrid,
  List,
  Loader2,
  MoreHorizontal,
  Palette,
  Plus,
  Search,
  Trash2,
  Upload,
  UserRound,
  X,
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { PAGE_CONTENT_CLASS } from '../components/layout/pageShell'
import { OshiModuleHeader } from '../components/layout/OshiModuleHeader'
import { fetchAllOshis, fetchOshiById } from '../features/oshis/oshiService'
import {
  createIllustration,
  createIllustrationId,
  deleteIllustration,
  fetchIllustrations,
  getIllustrationTags,
  toggleIllustrationFavorite,
  updateIllustration,
} from '../features/illustrations/illustrationService'
import {
  releaseMediaUrl,
  resolveMediaUrlWithFallback,
  storeIllustrationImage,
  validateIllustrationFile,
} from '../services/media/illustrationMedia'
import type {
  Illustration,
  IllustrationCategory,
  IllustrationSort,
  IllustrationTab,
  Oshi,
  Stamp,
  StampInput,
  UpdateIllustrationInput,
} from '../types'
import { formatDate, formatImageSize, getOshiName } from '../features/illustrations/illustrationFormat'
import { SelectMenu } from '../components/ui/SelectMenu'
import { OVERLAY_Z_INDEX } from '../components/ui/overlay'
import { useI18n } from '../i18n/useI18n'
import { useUiMotionSeconds } from '../components/features/themes/uiMotion'
import { fetchStampForTarget, persistStampForTarget } from '../features/stamps/stampService'
import { StampControl } from '../components/features/stamps/StampControl'
import { StampOverlay } from '../components/features/stamps/StampOverlay'

const TABS: { id: IllustrationTab; labelKey: 'illustrations.all' | 'common.official' | 'common.fanart' | 'common.favorites' }[] = [
  { id: 'all', labelKey: 'illustrations.all' },
  { id: 'official', labelKey: 'common.official' },
  { id: 'fanart', labelKey: 'common.fanart' },
  { id: 'favorites', labelKey: 'common.favorites' },
]

type IllustrationViewMode = 'masonry' | 'grid' | 'list'

export function OshiIllustrationsPage() {
  const { t } = useI18n()
  const { oshiId } = useParams<{ oshiId: string }>()
  const [oshi, setOshi] = useState<Oshi | null>(null)
  const [oshis, setOshis] = useState<Oshi[]>([])
  const [illustrations, setIllustrations] = useState<Illustration[]>([])
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([])
  const [activeTab, setActiveTab] = useState<IllustrationTab>('all')
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('')
  const [sort, setSort] = useState<IllustrationSort>('newest')
  const [viewMode, setViewMode] = useState<IllustrationViewMode>('masonry')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = useMemo(
    () => illustrations.find((illustration) => illustration.id === selectedId) || null,
    [illustrations, selectedId]
  )

  async function load() {
    if (!oshiId) return
    setLoading(true)
    try {
      const [oshiRecord, oshiRows, rows, tagRows] = await Promise.all([
        fetchOshiById(oshiId),
        fetchAllOshis(),
        fetchIllustrations({
          oshiId,
          category: activeTab === 'official' || activeTab === 'fanart' ? activeTab : undefined,
          favorite: activeTab === 'favorites',
          query,
          tag: tag || undefined,
          sort,
        }),
        getIllustrationTags(oshiId),
      ])
      setOshi(oshiRecord)
      setOshis(oshiRows)
      setIllustrations(rows)
      setTags(tagRows)
      if (selectedId && !rows.some((row) => row.id === selectedId)) setSelectedId(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oshiId, activeTab, query, tag, sort])

  async function handleToggleFavorite(id: string) {
    await toggleIllustrationFavorite(id)
    await load()
  }

  async function handleDelete(illustration: Illustration) {
    if (!confirm(t('illustrations.delete.confirm', { title: illustration.title || t('common.untitled') }))) return
    await deleteIllustration(illustration.id)
    setSelectedId(null)
    await load()
  }

  async function handleUpdate(id: string, input: UpdateIllustrationInput) {
    await updateIllustration(id, input)
    await load()
  }

  if (!oshiId) return null

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg-primary">
      <OshiModuleHeader
        oshiId={oshiId}
        title={t('illustrations.title')}
        subtitle={oshi ? t('illustrations.oshiSubtitle', { oshi: oshi.name }) : t('illustrations.genericSubtitle')}
        icon={ImageIcon}
        actions={(
          <Button onClick={() => setShowCreate(true)} className="rounded-2xl px-4">
            <Plus size={16} />
            {t('illustrations.add')}
          </Button>
        )}
      />

      <main className={`${PAGE_CONTENT_CLASS} min-h-0`}>
        <div className="mx-auto flex h-full max-w-[1760px] flex-col">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-border-color">
            <div className="flex gap-6">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={clsx(
                    'border-b-2 px-1 pb-3 text-sm font-semibold transition-colors',
                    activeTab === item.id
                      ? 'border-accent text-accent'
                      : 'border-transparent text-text-muted hover:text-text-primary'
                  )}
                >
                  {t(item.labelKey)}
                </button>
              ))}
            </div>
            <p className="pb-3 text-sm text-text-muted">{t('illustrations.count', { count: illustrations.length, plural: illustrations.length === 1 ? '' : 's' })}</p>
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[260px] flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('illustrations.searchShort')}
                className="w-full rounded-2xl border border-border-color bg-bg-secondary py-2.5 pl-9 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-soft"
              />
            </div>
            <div className="relative">
              <Filter size={15} className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-accent" />
              <SelectMenu
                value={tag}
                onChange={setTag}
                options={[
                  { value: '', label: t('notes.allTags') },
                  ...tags.map((item) => ({ value: item.tag, label: `#${item.tag}` })),
                ]}
                ariaLabel={t('notes.allTags')}
                buttonClassName="min-w-[180px] pl-10"
                menuClassName="w-[220px]"
              />
            </div>
            <SelectMenu
              value={sort}
              onChange={(value) => setSort(value as IllustrationSort)}
              options={[
                { value: 'newest', label: t('notes.newest') },
                { value: 'oldest', label: t('notes.oldest') },
                { value: 'title', label: t('illustrations.titleSort') },
              ]}
              ariaLabel={t('illustrations.sortLabel')}
              menuClassName="w-[196px]"
            />
            <div className="ml-auto flex rounded-xl bg-bg-secondary p-1">
              <IconToggle active={viewMode === 'masonry'} title={t('illustrations.masonryView')} onClick={() => setViewMode('masonry')}><GalleryVerticalEnd size={17} /></IconToggle>
              <IconToggle active={viewMode === 'grid'} title={t('illustrations.gridView')} onClick={() => setViewMode('grid')}><LayoutGrid size={17} /></IconToggle>
              <IconToggle active={viewMode === 'list'} title={t('illustrations.listView')} onClick={() => setViewMode('list')}><List size={17} /></IconToggle>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 size={30} className="animate-spin text-accent" />
            </div>
          ) : illustrations.length === 0 ? (
            <EmptyState onCreate={() => setShowCreate(true)} />
          ) : viewMode === 'masonry' ? (
            <IllustrationMasonry
              illustrations={illustrations}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onToggleFavorite={handleToggleFavorite}
            />
          ) : viewMode === 'grid' ? (
            <IllustrationGrid
              illustrations={illustrations}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onToggleFavorite={handleToggleFavorite}
            />
          ) : (
            <IllustrationList
              illustrations={illustrations}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onToggleFavorite={handleToggleFavorite}
            />
          )}
        </div>
      </main>

      {showCreate && (
        <IllustrationCreateModal
          oshiId={oshiId}
          oshis={oshis}
          onClose={() => setShowCreate(false)}
          onCreated={async (created) => {
            setShowCreate(false)
            await load()
            setSelectedId(created.id)
          }}
        />
      )}

      <AnimatePresence initial={false}>
        {selected && (
          <IllustrationDetailDrawer
            key={selected.id}
            illustration={selected}
            oshis={oshis}
            onClose={() => setSelectedId(null)}
            onUpdate={handleUpdate}
            onToggleFavorite={handleToggleFavorite}
            onDelete={handleDelete}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function IllustrationMasonry({
  illustrations,
  selectedId,
  onSelect,
  onToggleFavorite,
}: {
  illustrations: Illustration[]
  selectedId: string | null
  onSelect: (id: string) => void
  onToggleFavorite: (id: string) => void
}) {
  const { t } = useI18n()
  return (
    <div className="columns-1 gap-3 pb-8 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5">
      {illustrations.map((illustration) => (
        <article
          key={illustration.id}
          className={clsx(
            'mb-3 break-inside-avoid overflow-hidden rounded-xl border bg-bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg',
            selectedId === illustration.id ? 'border-accent ring-2 ring-accent-soft' : 'border-border-color'
          )}
        >
          <button type="button" onClick={() => onSelect(illustration.id)} className="block w-full text-left">
            <div className="relative bg-bg-tertiary">
              <MediaImage
                path={illustration.thumbnail_path || illustration.original_path}
                fallbackPath={illustration.original_path}
                alt={illustration.title || illustration.original_filename}
                className="w-full object-cover"
              />
              <span className={clsx(
                'absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm backdrop-blur',
                illustration.category === 'official'
                  ? 'bg-blue-50/85 text-blue-600'
                  : 'bg-pink-50/85 text-pink-600'
              )}>
                {illustration.category === 'official' ? t('common.official') : t('common.fanart')}
              </span>
            </div>
          </button>
          <div className="p-2.5">
            <div className="flex items-start gap-2">
              <button type="button" onClick={() => onSelect(illustration.id)} className="min-w-0 flex-1 text-left">
                <h2 className="line-clamp-1 text-xs font-semibold text-text-primary">{illustration.title || t('common.untitled')}</h2>
                {illustration.artist && (
                  <p className="mt-1 line-clamp-1 text-xs text-text-muted">{t('common.byArtist', { artist: illustration.artist })}</p>
                )}
              </button>
              <button
                type="button"
                onClick={() => onToggleFavorite(illustration.id)}
                className={clsx(
                  'rounded-lg p-1.5 transition-colors',
                  illustration.favorite ? 'text-pink-500' : 'text-text-muted hover:bg-bg-tertiary hover:text-pink-500'
                )}
                title={illustration.favorite ? t('illustrations.removeFavorite') : t('illustrations.favorite')}
              >
                <Heart size={16} fill={illustration.favorite ? 'currentColor' : 'none'} />
              </button>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-text-muted">
              <Calendar size={12} />
              <span>{formatDate(illustration.date || illustration.created_at)}</span>
              {illustration.tags.slice(0, 2).map((tag) => (
                <span key={tag} className="ml-1 rounded-full bg-accent-soft/50 px-2 py-0.5 text-accent">#{tag}</span>
              ))}
              <MoreHorizontal size={14} className="ml-auto" />
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}

function IllustrationGrid({
  illustrations,
  selectedId,
  onSelect,
  onToggleFavorite,
}: {
  illustrations: Illustration[]
  selectedId: string | null
  onSelect: (id: string) => void
  onToggleFavorite: (id: string) => void
}) {
  const { t } = useI18n()
  return (
    <div className="grid grid-cols-1 gap-3 pb-8 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {illustrations.map((illustration) => (
        <article
          key={illustration.id}
          className={clsx(
            'overflow-hidden rounded-xl border bg-bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg',
            selectedId === illustration.id ? 'border-accent ring-2 ring-accent-soft' : 'border-border-color'
          )}
        >
          <button type="button" onClick={() => onSelect(illustration.id)} className="block w-full text-left">
            <div className="relative aspect-[4/3] bg-bg-tertiary">
              <MediaImage
                path={illustration.thumbnail_path || illustration.original_path}
                fallbackPath={illustration.original_path}
                alt={illustration.title || illustration.original_filename}
                className="h-full w-full object-cover"
              />
              <span className={clsx(
                'absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm backdrop-blur',
                illustration.category === 'official'
                  ? 'bg-blue-50/85 text-blue-600'
                  : 'bg-pink-50/85 text-pink-600'
              )}>
                {illustration.category === 'official' ? t('common.official') : t('common.fanart')}
              </span>
            </div>
          </button>
          <div className="p-2.5">
            <div className="flex items-start gap-2">
              <button type="button" onClick={() => onSelect(illustration.id)} className="min-w-0 flex-1 text-left">
                <h2 className="line-clamp-1 text-xs font-semibold text-text-primary">{illustration.title || t('common.untitled')}</h2>
                {illustration.artist && (
                  <p className="mt-1 line-clamp-1 text-xs text-text-muted">{t('common.byArtist', { artist: illustration.artist })}</p>
                )}
              </button>
              <FavoriteIconButton illustration={illustration} onToggleFavorite={onToggleFavorite} />
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-text-muted">
              <Calendar size={12} />
              <span>{formatDate(illustration.date || illustration.created_at)}</span>
              {illustration.tags.slice(0, 1).map((tag) => (
                <span key={tag} className="ml-1 rounded-full bg-accent-soft/50 px-2 py-0.5 text-accent">#{tag}</span>
              ))}
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}

function IllustrationList({
  illustrations,
  selectedId,
  onSelect,
  onToggleFavorite,
}: {
  illustrations: Illustration[]
  selectedId: string | null
  onSelect: (id: string) => void
  onToggleFavorite: (id: string) => void
}) {
  const { t } = useI18n()
  return (
    <div className="space-y-1 pb-8">
      {illustrations.map((illustration) => (
        <div
          key={illustration.id}
          className={clsx(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-bg-secondary',
            selectedId === illustration.id && 'bg-accent-soft/30'
          )}
        >
          <button type="button" onClick={() => onSelect(illustration.id)} className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-bg-tertiary">
            <MediaImage
              path={illustration.thumbnail_path || illustration.original_path}
              fallbackPath={illustration.original_path}
              alt={illustration.title || illustration.original_filename}
              className="h-full w-full object-cover"
            />
          </button>
          <button type="button" onClick={() => onSelect(illustration.id)} className="min-w-0 flex-1 text-left">
            <p className="truncate text-sm font-semibold text-text-primary">{illustration.title || t('common.untitled')}</p>
            <p className="mt-0.5 truncate text-xs text-text-muted">{illustration.original_filename}</p>
          </button>
          <span className="hidden min-w-28 truncate text-xs text-text-muted lg:block">{illustration.artist || t('common.unknownArtist')}</span>
          <span className="hidden min-w-20 text-xs text-text-muted lg:inline-flex lg:items-center lg:gap-1.5">
            <Calendar size={13} />
            {formatDate(illustration.date || illustration.created_at)}
          </span>
          <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
            {illustration.category === 'official' ? t('common.official') : t('common.fanart')}
          </span>
          <FavoriteIconButton illustration={illustration} onToggleFavorite={onToggleFavorite} />
        </div>
      ))}
    </div>
  )
}

function FavoriteIconButton({ illustration, onToggleFavorite }: { illustration: Illustration; onToggleFavorite: (id: string) => void }) {
  const { t } = useI18n()
  return (
    <button
      type="button"
      onClick={() => onToggleFavorite(illustration.id)}
      className={clsx(
        'rounded-lg p-1.5 transition-colors',
        illustration.favorite ? 'text-pink-500' : 'text-text-muted hover:bg-bg-tertiary hover:text-pink-500'
      )}
      title={illustration.favorite ? t('illustrations.removeFavorite') : t('illustrations.favorite')}
    >
      <Heart size={16} fill={illustration.favorite ? 'currentColor' : 'none'} />
    </button>
  )
}

function IconToggle({ active, title, onClick, children }: { active: boolean; title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" title={title} onClick={onClick} className={`rounded-lg p-2 transition-colors ${active ? 'bg-bg-primary text-accent shadow-sm' : 'text-text-muted hover:text-text-primary'}`}>
      {children}
    </button>
  )
}

export function IllustrationCreateModal({
  oshiId,
  oshis,
  onClose,
  onCreated,
}: {
  oshiId: string
  oshis: Oshi[]
  onClose: () => void
  onCreated: (illustration: Illustration) => void
}) {
  const { t } = useI18n()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [selectedOshiId, setSelectedOshiId] = useState(oshiId)
  const [previewUrl, setPreviewUrl] = useState('')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<IllustrationCategory>('official')
  const [date, setDate] = useState('')
  const [artist, setArtist] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [tags, setTags] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function handleFile(value: File | null) {
    setError('')
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    if (!value) {
      setFile(null)
      setPreviewUrl('')
      return
    }
    const validation = validateIllustrationFile(value)
    if (validation) {
      setError(validation.includes('20 MB') ? t('illustrations.validation.size') : t('illustrations.validation.supported'))
      return
    }
    setFile(value)
    setPreviewUrl(URL.createObjectURL(value))
    if (!title.trim()) {
      setTitle(value.name.replace(/\.[^.]+$/, ''))
    }
  }

  async function handleSave() {
    if (!file) {
      setError(t('illustrations.validation.chooseImageFirst'))
      return
    }
    setSaving(true)
    setError('')
    try {
      const id = createIllustrationId()
      const stored = await storeIllustrationImage(file, id)
      const created = await createIllustration({
        id,
        oshi_id: selectedOshiId || null,
        category,
        title: title.trim() || t('common.untitled'),
        date: date || null,
        artist: artist.trim(),
        source_url: sourceUrl.trim(),
        tags: parseTagInput(tags),
        description: description.trim(),
        ...stored,
      })
      onCreated(created)
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-bg-primary/70 p-4 backdrop-blur-sm sm:p-6" style={{ zIndex: OVERLAY_Z_INDEX.modal }}>
      <div className="grid h-[calc(100vh-48px)] max-h-[780px] w-[min(920px,calc(100vw-32px))] min-h-0 overflow-hidden rounded-3xl border border-border-color bg-bg-primary shadow-glass md:grid-cols-[minmax(0,1fr)_360px]">
        <div className="hidden min-h-0 bg-bg-secondary/40 p-4 md:block">
          {previewUrl ? (
            <img src={previewUrl} alt="" className="h-full w-full rounded-2xl object-contain" />
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-full w-full flex-col items-center justify-center rounded-2xl border border-dashed border-border-color text-text-muted transition-colors hover:border-accent hover:text-accent"
            >
              <Upload size={34} />
              <span className="mt-3 text-sm font-semibold">{t('illustrations.chooseImage')}</span>
              <span className="mt-1 text-xs">{t('illustrations.imageHelp')}</span>
            </button>
          )}
        </div>

        <div className="flex h-full min-h-0 flex-col overflow-hidden p-5">
          <div className="mb-5 flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-soft/25 text-accent">
              <ImageIcon size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-text-primary">{t('illustrations.add')}</h2>
              <p className="text-xs text-text-muted">{t('illustrations.addDescription')}</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl p-2 text-text-muted hover:bg-bg-tertiary hover:text-text-primary" title={t('common.cancel')}>
              <X size={18} />
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => handleFile(event.target.files?.[0] || null)}
          />
          <div className="mb-4 md:hidden">
            {previewUrl ? (
              <img src={previewUrl} alt="" className="max-h-48 w-full rounded-2xl bg-bg-secondary/40 object-contain" />
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-40 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-border-color bg-bg-secondary/40 text-text-muted transition-colors hover:border-accent hover:text-accent"
              >
                <Upload size={28} />
                <span className="mt-2 text-sm font-semibold">{t('illustrations.chooseImage')}</span>
                <span className="mt-1 text-xs">{t('illustrations.imageHelp')}</span>
              </button>
            )}
          </div>
          {previewUrl && (
            <Button variant="secondary" size="sm" className="mb-4 w-full" onClick={() => fileInputRef.current?.click()}>
              <Upload size={15} />
              {t('illustrations.changeImage')}
            </Button>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
            <OshiSelectField
              label={t('illustrations.belongsTo')}
              value={selectedOshiId}
              oshis={oshis}
              onChange={setSelectedOshiId}
            />
            <IllustrationFormFields
              title={title}
              category={category}
              date={date}
              artist={artist}
              sourceUrl={sourceUrl}
              tags={tags}
              description={description}
              onTitleChange={setTitle}
              onCategoryChange={setCategory}
              onDateChange={setDate}
              onArtistChange={setArtist}
              onSourceUrlChange={setSourceUrl}
              onTagsChange={setTags}
              onDescriptionChange={setDescription}
            />

            {error && <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>}
          </div>

          <div className="-mx-5 mt-4 flex shrink-0 gap-2 border-t border-border-color bg-bg-primary px-5 pt-4">
            <Button className="flex-1" disabled={saving} onClick={handleSave}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {saving ? t('journalInspector.saving') : t('journalEditor.setup.save')}
            </Button>
            <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function IllustrationDetailDrawer({
  illustration,
  oshis,
  onClose,
  onUpdate,
  onToggleFavorite,
  onDelete,
}: {
  illustration: Illustration
  oshis: Oshi[]
  onClose: () => void
  onUpdate: (id: string, input: UpdateIllustrationInput) => void | Promise<void>
  onToggleFavorite: (id: string) => void
  onDelete: (illustration: Illustration) => void
}) {
  const { t } = useI18n()
  const motionSeconds = useUiMotionSeconds()
  const [editing, setEditing] = useState(false)
  const [selectedOshiId, setSelectedOshiId] = useState(illustration.oshi_id || '')
  const [title, setTitle] = useState(illustration.title)
  const [category, setCategory] = useState<IllustrationCategory>(illustration.category)
  const [date, setDate] = useState(toDateInput(illustration.date))
  const [artist, setArtist] = useState(illustration.artist)
  const [sourceUrl, setSourceUrl] = useState(illustration.source_url)
  const [tags, setTags] = useState(illustration.tags.join(', '))
  const [description, setDescription] = useState(illustration.description)
  const [showPreview, setShowPreview] = useState(false)
  const [stampDraft, setStampDraft] = useState<Stamp | StampInput | null>(null)

  useEffect(() => {
    setEditing(false)
    setSelectedOshiId(illustration.oshi_id || '')
    setTitle(illustration.title)
    setCategory(illustration.category)
    setDate(toDateInput(illustration.date))
    setArtist(illustration.artist)
    setSourceUrl(illustration.source_url)
    setTags(illustration.tags.join(', '))
    setDescription(illustration.description)
    fetchStampForTarget('illustration', illustration.id).then(setStampDraft).catch(() => setStampDraft(null))
  }, [illustration])

  async function handleSave() {
    await onUpdate(illustration.id, {
      title: title.trim() || t('common.untitled'),
      oshi_id: selectedOshiId || null,
      category,
      date: date || null,
      artist: artist.trim(),
      source_url: sourceUrl.trim(),
      tags: parseTagInput(tags),
      description: description.trim(),
    })
    setStampDraft(await persistStampForTarget('illustration', illustration.id, stampDraft))
    setEditing(false)
  }

  async function handleOpenSource() {
    const url = normalizeWebUrl(illustration.source_url)
    if (!url) return
    try {
      await invoke('open_external_url', { url })
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  const previewOverlay = typeof document === 'undefined' ? null : createPortal(
    <AnimatePresence>
      {showPreview && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: motionSeconds, ease: 'easeOut' }}
          className="fixed inset-0 flex items-center justify-center bg-black/82 p-5 backdrop-blur-sm"
          style={{ zIndex: OVERLAY_Z_INDEX.fullscreen }}
          onClick={() => setShowPreview(false)}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              setShowPreview(false)
            }}
            className="absolute right-5 top-5 rounded-full border border-white/20 bg-white/12 p-3 text-white shadow-lg transition-colors hover:bg-white/20"
            title={t('illustrations.preview.close')}
            aria-label={t('illustrations.preview.close')}
          >
            <X size={22} />
          </button>
          <motion.div
            initial={{ opacity: 0, scale: motionSeconds === 0 ? 1 : 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: motionSeconds === 0 ? 1 : 0.98 }}
            transition={{ duration: motionSeconds, ease: 'easeOut' }}
            className="relative max-h-full max-w-full"
            onClick={(event) => event.stopPropagation()}
          >
            <MediaImage
              path={illustration.original_path}
              alt={illustration.title || illustration.original_filename}
              className="max-h-[calc(100vh-56px)] max-w-[calc(100vw-56px)] rounded-xl object-contain shadow-2xl"
            />
            <StampOverlay stamp={stampDraft} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )

  return (
    <motion.aside
      initial={{ opacity: 0, x: motionSeconds === 0 ? 0 : 28 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: motionSeconds === 0 ? 0 : 28 }}
      transition={{ duration: motionSeconds, ease: 'easeOut' }}
      className="fixed right-0 top-0 flex h-full w-[min(440px,100vw)] flex-col border-l border-border-color bg-bg-primary shadow-2xl transform-gpu will-change-[transform,opacity]"
      style={{ zIndex: OVERLAY_Z_INDEX.drawer }}
    >
      <div className="flex items-center gap-3 border-b border-border-color p-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-accent-soft/25 text-accent">
          <Palette size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-text-muted">{t('illustrations.detailType')}</p>
          <h2 className="truncate text-base font-bold text-text-primary">{illustration.title || t('common.untitled')}</h2>
        </div>
        <button type="button" onClick={onClose} className="rounded-xl p-2 text-text-muted hover:bg-bg-tertiary hover:text-text-primary" title={t('common.cancel')}>
          <X size={18} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="bg-bg-secondary/40 p-4">
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="relative block w-full rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-soft"
            title={t('illustrations.preview.open')}
            aria-label={t('illustrations.preview.open')}
          >
            <MediaImage path={illustration.original_path} alt={illustration.title} className="max-h-[420px] w-full rounded-2xl object-contain" />
            <StampOverlay stamp={stampDraft} />
          </button>
        </div>
        <div className="space-y-5 p-5">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onToggleFavorite(illustration.id)}
              className={clsx(
                'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors',
                illustration.favorite
                  ? 'border-pink-200 bg-pink-50 text-pink-500'
                  : 'border-border-color text-text-muted hover:text-pink-500'
              )}
            >
              <Heart size={16} fill={illustration.favorite ? 'currentColor' : 'none'} />
              {t('illustrations.favorite')}
            </button>
            <Button variant="secondary" size="sm" onClick={() => setEditing(!editing)}>
              {editing ? <X size={15} /> : <Palette size={15} />}
              {editing ? t('illustrations.cancelEdit') : t('illustrations.edit')}
            </Button>
            <Button variant="ghost" size="sm" className="text-red-500" onClick={() => onDelete(illustration)}>
              <Trash2 size={15} />
              {t('illustrations.delete')}
            </Button>
          </div>

          {editing ? (
            <>
              <OshiSelectField
                label={t('illustrations.belongsTo')}
                value={selectedOshiId}
                oshis={oshis}
                onChange={setSelectedOshiId}
              />
              <IllustrationFormFields
                title={title}
                category={category}
                date={date}
                artist={artist}
                sourceUrl={sourceUrl}
                tags={tags}
                description={description}
                onTitleChange={setTitle}
                onCategoryChange={setCategory}
                onDateChange={setDate}
                onArtistChange={setArtist}
                onSourceUrlChange={setSourceUrl}
                onTagsChange={setTags}
                onDescriptionChange={setDescription}
              />
              <StampControl
                value={stampDraft}
                onChange={setStampDraft}
                onClear={() => setStampDraft(null)}
              />
              <Button className="w-full" onClick={handleSave}>
                <Check size={16} />
                {t('illustrations.saveChanges')}
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-text-primary">{illustration.title || t('common.untitled')}</h3>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
                  {illustration.category === 'official' ? t('common.official') : t('common.fanart')}
                </span>
                {illustration.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-bg-tertiary px-3 py-1 text-xs text-text-secondary">#{tag}</span>
                ))}
              </div>
              <MetadataRow icon={<Calendar size={15} />} label={t('illustrations.date')} value={formatDate(illustration.date || illustration.created_at)} />
              <MetadataRow icon={<UserRound size={15} />} label={t('illustrations.belongsTo')} value={getOshiName(oshis, illustration.oshi_id, t('illustrations.noOshi'), t('illustrations.unknownOshi'))} />
              <MetadataRow icon={<UserRound size={15} />} label={t('illustrations.artist')} value={illustration.artist || t('common.unknownArtist')} />
              <MetadataRow icon={<ImageIcon size={15} />} label={t('illustrations.file')} value={`${illustration.original_filename} ${formatImageSize(illustration)}`} />
              {illustration.source_url && (
                <button type="button" onClick={handleOpenSource} className="flex w-full items-center gap-3 rounded-xl border border-border-color px-3 py-2 text-left text-sm text-text-secondary transition-colors hover:border-accent hover:text-accent">
                  <ExternalLink size={15} />
                  <span className="min-w-0 flex-1 truncate">{formatUrlLabel(illustration.source_url)}</span>
                </button>
              )}
              {illustration.description && (
                <p className="rounded-2xl bg-bg-secondary/50 p-4 text-sm leading-relaxed text-text-secondary">{illustration.description}</p>
              )}
            </div>
          )}
        </div>
      </div>
      {previewOverlay}
    </motion.aside>
  )
}

function IllustrationFormFields({
  title,
  category,
  date,
  artist,
  sourceUrl,
  tags,
  description,
  onTitleChange,
  onCategoryChange,
  onDateChange,
  onArtistChange,
  onSourceUrlChange,
  onTagsChange,
  onDescriptionChange,
}: {
  title: string
  category: IllustrationCategory
  date: string
  artist: string
  sourceUrl: string
  tags: string
  description: string
  onTitleChange: (value: string) => void
  onCategoryChange: (value: IllustrationCategory) => void
  onDateChange: (value: string) => void
  onArtistChange: (value: string) => void
  onSourceUrlChange: (value: string) => void
  onTagsChange: (value: string) => void
  onDescriptionChange: (value: string) => void
}) {
  const { t } = useI18n()
  return (
    <div className="space-y-3">
      <Field label={t('illustrations.formTitle')}>
        <input value={title} onChange={(event) => onTitleChange(event.target.value)} className={fieldClassName} placeholder={t('illustrations.titlePlaceholder')} />
      </Field>
      <Field label={t('illustrations.category')}>
        <div className="grid grid-cols-2 gap-2">
          {(['official', 'fanart'] as IllustrationCategory[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onCategoryChange(item)}
              className={clsx(
                'rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                category === item ? 'border-accent bg-accent-soft text-accent' : 'border-border-color bg-bg-secondary text-text-secondary hover:border-border-hover'
              )}
            >
              {item === 'official' ? t('common.official') : t('common.fanart')}
            </button>
          ))}
        </div>
      </Field>
      <Field label={t('illustrations.date')}>
        <input type="date" value={date} onChange={(event) => onDateChange(event.target.value)} className={fieldClassName} />
      </Field>
      <Field label={t('illustrations.artist')}>
        <input value={artist} onChange={(event) => onArtistChange(event.target.value)} className={fieldClassName} placeholder={t('illustrations.artistPlaceholder')} />
      </Field>
      <Field label={t('illustrations.sourceUrl')}>
        <input value={sourceUrl} onChange={(event) => onSourceUrlChange(event.target.value)} className={fieldClassName} placeholder="https://..." />
      </Field>
      <Field label={t('illustrations.tags')}>
        <input value={tags} onChange={(event) => onTagsChange(event.target.value)} className={fieldClassName} placeholder={t('illustrations.tagsPlaceholder')} />
      </Field>
      <Field label={t('illustrations.description')}>
        <textarea value={description} onChange={(event) => onDescriptionChange(event.target.value)} className={`${fieldClassName} h-24 resize-none`} placeholder={t('illustrations.descriptionPlaceholder')} />
      </Field>
    </div>
  )
}

export function MediaImage({
  path,
  fallbackPath,
  alt,
  className,
}: {
  path: string | null
  fallbackPath?: string | null
  alt: string
  className?: string
}) {
  const candidates = useMemo(
    () => Array.from(new Set([path, fallbackPath].filter((candidate): candidate is string => Boolean(candidate)))),
    [fallbackPath, path]
  )
  const [src, setSrc] = useState('')
  const [sourceIndex, setSourceIndex] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setSourceIndex(0)
    setFailed(false)
    setSrc('')
  }, [candidates])

  useEffect(() => {
    let alive = true
    setSrc('')
    let currentUrl = ''
    resolveMediaUrlWithFallback(candidates[sourceIndex], candidates[sourceIndex + 1])
      .then((url) => {
        if (!url) throw new Error('Media file not found')
        currentUrl = url
        if (alive) setSrc(url)
        else releaseMediaUrl(url)
      })
      .catch(() => {
        if (!alive) return
        if (sourceIndex < candidates.length - 1) {
          setSourceIndex((index) => index + 1)
        } else {
          setFailed(true)
        }
      })
    return () => {
      alive = false
      releaseMediaUrl(currentUrl)
    }
  }, [candidates, sourceIndex])

  function handleImageError() {
    releaseMediaUrl(src)
    if (sourceIndex < candidates.length - 1) {
      setSourceIndex((index) => index + 1)
      return
    }
    setFailed(true)
    setSrc('')
  }

  if (!src || failed) {
    return (
      <div className={clsx('flex min-h-48 items-center justify-center bg-bg-tertiary text-text-muted', className)}>
        <ImageIcon size={26} />
      </div>
    )
  }
  return <img src={src} alt={alt} className={className} loading="lazy" onError={handleImageError} />
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  const { t } = useI18n()
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-3xl border border-dashed border-border-color bg-bg-secondary/25 px-6 py-16 text-center">
      <ImageIcon size={46} className="mb-4 text-accent" />
      <h2 className="text-lg font-semibold text-text-primary">{t('illustrations.empty.oshiTitle')}</h2>
      <p className="mt-1 max-w-md text-sm text-text-muted">{t('illustrations.empty.oshiBody')}</p>
      <Button className="mt-6" onClick={onCreate}>
        <Plus size={16} />
        {t('illustrations.add')}
      </Button>
    </div>
  )
}

function MetadataRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-text-muted">{icon}</span>
      <span className="w-20 shrink-0 text-text-muted">{label}</span>
      <span className="min-w-0 flex-1 truncate text-text-secondary">{value}</span>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-text-muted">
      {label}
      {children}
    </label>
  )
}

function OshiSelectField({
  label,
  value,
  oshis,
  onChange,
}: {
  label: string
  value: string
  oshis: Oshi[]
  onChange: (value: string) => void
}) {
  const { t } = useI18n()
  return (
    <div className="mb-3 grid gap-1.5 text-xs font-medium text-text-muted">
      {label}
      <SelectMenu
        value={value}
        onChange={onChange}
        options={[
          { value: '', label: t('illustrations.noOshi') },
          ...oshis.map((oshi) => ({ value: oshi.id, label: oshi.name })),
        ]}
        ariaLabel={label}
        className="w-full"
        buttonClassName="w-full rounded-xl text-text-primary"
        menuClassName="w-full"
      />
    </div>
  )
}

const fieldClassName = 'w-full rounded-xl border border-border-color bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-soft'

function parseTagInput(value: string): string[] {
  return Array.from(new Set(value.replace(/\uFF0C/g, ',').split(',').map((tag) => tag.trim()).filter(Boolean)))
}

function toDateInput(value: string | null): string {
  if (!value) return ''
  return value.slice(0, 10)
}

function normalizeWebUrl(value: string): string | null {
  try {
    const trimmed = value.trim()
    if (!trimmed) return null
    const withProtocol = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    const url = new URL(withProtocol)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function formatUrlLabel(value: string): string {
  const url = normalizeWebUrl(value)
  if (!url) return value
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return value
  }
}
