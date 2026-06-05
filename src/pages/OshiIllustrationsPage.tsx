import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { invoke } from '@tauri-apps/api/core'
import clsx from 'clsx'
import {
  Calendar,
  Check,
  ExternalLink,
  Filter,
  Heart,
  ImageIcon,
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
  resolveMediaUrl,
  storeIllustrationImage,
  validateIllustrationFile,
} from '../services/media/illustrationMedia'
import type {
  Illustration,
  IllustrationCategory,
  IllustrationSort,
  IllustrationTab,
  Oshi,
  UpdateIllustrationInput,
} from '../types'

const TABS: { id: IllustrationTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'official', label: 'Official' },
  { id: 'fanart', label: 'Fanart' },
  { id: 'favorites', label: 'Favorites' },
]

export function OshiIllustrationsPage() {
  const { oshiId } = useParams<{ oshiId: string }>()
  const [oshi, setOshi] = useState<Oshi | null>(null)
  const [oshis, setOshis] = useState<Oshi[]>([])
  const [illustrations, setIllustrations] = useState<Illustration[]>([])
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([])
  const [activeTab, setActiveTab] = useState<IllustrationTab>('all')
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('')
  const [sort, setSort] = useState<IllustrationSort>('newest')
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
    if (!confirm(`Delete "${illustration.title || 'Untitled'}"? The copied image inside OshiNote media storage will also be removed.`)) return
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
        title="Illustrations"
        subtitle={oshi ? `Visual memories and art for ${oshi.name}.` : 'Visual memories and art for this oshi.'}
        icon={ImageIcon}
        actions={(
          <Button onClick={() => setShowCreate(true)} className="rounded-2xl px-4">
            <Plus size={16} />
            Add Illustration
          </Button>
        )}
      />

      <main className={`${PAGE_CONTENT_CLASS} min-h-0`}>
        <div className="mx-auto flex h-full max-w-7xl flex-col">
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
                  {item.label}
                </button>
              ))}
            </div>
            <p className="pb-3 text-sm text-text-muted">{illustrations.length} illustration{illustrations.length === 1 ? '' : 's'}</p>
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[260px] flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search title, artist, tags..."
                className="w-full rounded-2xl border border-border-color bg-bg-secondary py-2.5 pl-9 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-soft"
              />
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-border-color bg-bg-secondary px-3 py-2 text-text-muted">
              <Filter size={15} />
              <select
                value={tag}
                onChange={(event) => setTag(event.target.value)}
                className="bg-transparent text-sm text-text-secondary focus:outline-none"
              >
                <option value="">All Tags</option>
                {tags.map((item) => (
                  <option key={item.tag} value={item.tag}>#{item.tag}</option>
                ))}
              </select>
            </div>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as IllustrationSort)}
              className="rounded-2xl border border-border-color bg-bg-secondary px-3 py-2.5 text-sm text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-soft"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="title">Title A-Z</option>
            </select>
          </div>

          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 size={30} className="animate-spin text-accent" />
            </div>
          ) : illustrations.length === 0 ? (
            <EmptyState onCreate={() => setShowCreate(true)} />
          ) : (
            <IllustrationMasonry
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

      {selected && (
        <IllustrationDetailDrawer
          illustration={selected}
          oshis={oshis}
          onClose={() => setSelectedId(null)}
          onUpdate={handleUpdate}
          onToggleFavorite={handleToggleFavorite}
          onDelete={handleDelete}
        />
      )}
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
  return (
    <div className="columns-1 gap-5 pb-8 sm:columns-2 xl:columns-3 2xl:columns-4">
      {illustrations.map((illustration) => (
        <article
          key={illustration.id}
          className={clsx(
            'mb-5 break-inside-avoid overflow-hidden rounded-xl border bg-bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg',
            selectedId === illustration.id ? 'border-accent ring-2 ring-accent-soft' : 'border-border-color'
          )}
        >
          <button type="button" onClick={() => onSelect(illustration.id)} className="block w-full text-left">
            <div className="relative bg-bg-tertiary">
              <MediaImage
                path={illustration.thumbnail_path || illustration.original_path}
                alt={illustration.title || illustration.original_filename}
                className="w-full object-cover"
              />
              <span className={clsx(
                'absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm backdrop-blur',
                illustration.category === 'official'
                  ? 'bg-blue-50/85 text-blue-600'
                  : 'bg-pink-50/85 text-pink-600'
              )}>
                {illustration.category === 'official' ? 'Official' : 'Fanart'}
              </span>
            </div>
          </button>
          <div className="p-3">
            <div className="flex items-start gap-2">
              <button type="button" onClick={() => onSelect(illustration.id)} className="min-w-0 flex-1 text-left">
                <h2 className="line-clamp-1 text-sm font-semibold text-text-primary">{illustration.title || 'Untitled'}</h2>
                {illustration.artist && (
                  <p className="mt-1 line-clamp-1 text-xs text-text-muted">by {illustration.artist}</p>
                )}
              </button>
              <button
                type="button"
                onClick={() => onToggleFavorite(illustration.id)}
                className={clsx(
                  'rounded-lg p-1.5 transition-colors',
                  illustration.favorite ? 'text-pink-500' : 'text-text-muted hover:bg-bg-tertiary hover:text-pink-500'
                )}
                title={illustration.favorite ? 'Remove from favorites' : 'Favorite'}
              >
                <Heart size={16} fill={illustration.favorite ? 'currentColor' : 'none'} />
              </button>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-text-muted">
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

function IllustrationCreateModal({
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
      setError(validation)
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
      setError('Choose an image first.')
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
        title: title.trim() || 'Untitled',
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
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-bg-primary/70 p-4 backdrop-blur-sm sm:p-6">
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
              <span className="mt-3 text-sm font-semibold">Choose image</span>
              <span className="mt-1 text-xs">JPEG, PNG, or WebP up to 20 MB</span>
            </button>
          )}
        </div>

        <div className="flex h-full min-h-0 flex-col overflow-hidden p-5">
          <div className="mb-5 flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-soft/25 text-accent">
              <ImageIcon size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-text-primary">Add Illustration</h2>
              <p className="text-xs text-text-muted">Copy an image into OshiNote media storage.</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl p-2 text-text-muted hover:bg-bg-tertiary hover:text-text-primary" title="Close">
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
                <span className="mt-2 text-sm font-semibold">Choose image</span>
                <span className="mt-1 text-xs">JPEG, PNG, or WebP up to 20 MB</span>
              </button>
            )}
          </div>
          {previewUrl && (
            <Button variant="secondary" size="sm" className="mb-4 w-full" onClick={() => fileInputRef.current?.click()}>
              <Upload size={15} />
              Change image
            </Button>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
            <OshiSelectField
              label="Belongs to"
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
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function IllustrationDetailDrawer({
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
  onUpdate: (id: string, input: UpdateIllustrationInput) => void
  onToggleFavorite: (id: string) => void
  onDelete: (illustration: Illustration) => void
}) {
  const [editing, setEditing] = useState(false)
  const [selectedOshiId, setSelectedOshiId] = useState(illustration.oshi_id || '')
  const [title, setTitle] = useState(illustration.title)
  const [category, setCategory] = useState<IllustrationCategory>(illustration.category)
  const [date, setDate] = useState(toDateInput(illustration.date))
  const [artist, setArtist] = useState(illustration.artist)
  const [sourceUrl, setSourceUrl] = useState(illustration.source_url)
  const [tags, setTags] = useState(illustration.tags.join(', '))
  const [description, setDescription] = useState(illustration.description)

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
  }, [illustration])

  function handleSave() {
    onUpdate(illustration.id, {
      title: title.trim() || 'Untitled',
      oshi_id: selectedOshiId || null,
      category,
      date: date || null,
      artist: artist.trim(),
      source_url: sourceUrl.trim(),
      tags: parseTagInput(tags),
      description: description.trim(),
    })
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

  return (
    <aside className="fixed right-0 top-0 z-[100] flex h-full w-[min(440px,100vw)] flex-col border-l border-border-color bg-bg-primary shadow-2xl">
      <div className="flex items-center gap-3 border-b border-border-color p-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-accent-soft/25 text-accent">
          <Palette size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-text-muted">Illustration</p>
          <h2 className="truncate text-base font-bold text-text-primary">{illustration.title || 'Untitled'}</h2>
        </div>
        <button type="button" onClick={onClose} className="rounded-xl p-2 text-text-muted hover:bg-bg-tertiary hover:text-text-primary" title="Close">
          <X size={18} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="bg-bg-secondary/40 p-4">
          <MediaImage path={illustration.original_path} alt={illustration.title} className="max-h-[420px] w-full rounded-2xl object-contain" />
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
              Favorite
            </button>
            <Button variant="secondary" size="sm" onClick={() => setEditing(!editing)}>
              {editing ? <X size={15} /> : <Palette size={15} />}
              {editing ? 'Cancel Edit' : 'Edit'}
            </Button>
            <Button variant="ghost" size="sm" className="text-red-500" onClick={() => onDelete(illustration)}>
              <Trash2 size={15} />
              Delete
            </Button>
          </div>

          {editing ? (
            <>
              <OshiSelectField
                label="Belongs to"
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
              <Button className="w-full" onClick={handleSave}>
                <Check size={16} />
                Save Changes
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-text-primary">{illustration.title || 'Untitled'}</h3>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
                  {illustration.category === 'official' ? 'Official' : 'Fanart'}
                </span>
                {illustration.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-bg-tertiary px-3 py-1 text-xs text-text-secondary">#{tag}</span>
                ))}
              </div>
              <MetadataRow icon={<Calendar size={15} />} label="Date" value={formatDate(illustration.date || illustration.created_at)} />
              <MetadataRow icon={<UserRound size={15} />} label="Belongs to" value={getOshiName(oshis, illustration.oshi_id)} />
              <MetadataRow icon={<UserRound size={15} />} label="Artist" value={illustration.artist || 'Unknown'} />
              <MetadataRow icon={<ImageIcon size={15} />} label="File" value={`${illustration.original_filename} ${formatImageSize(illustration)}`} />
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
    </aside>
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
  return (
    <div className="space-y-3">
      <Field label="Title">
        <input value={title} onChange={(event) => onTitleChange(event.target.value)} className={fieldClassName} placeholder="Illustration title" />
      </Field>
      <Field label="Category">
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
              {item === 'official' ? 'Official' : 'Fanart'}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Date">
        <input type="date" value={date} onChange={(event) => onDateChange(event.target.value)} className={fieldClassName} />
      </Field>
      <Field label="Artist">
        <input value={artist} onChange={(event) => onArtistChange(event.target.value)} className={fieldClassName} placeholder="Person who drew this image" />
      </Field>
      <Field label="Source URL">
        <input value={sourceUrl} onChange={(event) => onSourceUrlChange(event.target.value)} className={fieldClassName} placeholder="https://..." />
      </Field>
      <Field label="Tags">
        <input value={tags} onChange={(event) => onTagsChange(event.target.value)} className={fieldClassName} placeholder="birthday, live, key visual" />
      </Field>
      <Field label="Description">
        <textarea value={description} onChange={(event) => onDescriptionChange(event.target.value)} className={`${fieldClassName} h-24 resize-none`} placeholder="Notes about this image..." />
      </Field>
    </div>
  )
}

function MediaImage({ path, alt, className }: { path: string | null; alt: string; className?: string }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let alive = true
    resolveMediaUrl(path).then((url) => {
      if (alive) setSrc(url)
    })
    return () => { alive = false }
  }, [path])

  if (!src) {
    return (
      <div className={clsx('flex min-h-48 items-center justify-center bg-bg-tertiary text-text-muted', className)}>
        <ImageIcon size={26} />
      </div>
    )
  }
  return <img src={src} alt={alt} className={className} loading="lazy" />
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-3xl border border-dashed border-border-color bg-bg-secondary/25 px-6 py-16 text-center">
      <ImageIcon size={46} className="mb-4 text-accent" />
      <h2 className="text-lg font-semibold text-text-primary">No illustrations yet</h2>
      <p className="mt-1 max-w-md text-sm text-text-muted">Build a visual library for official art, fanart, and images you want to use in postcards and memory books later.</p>
      <Button className="mt-6" onClick={onCreate}>
        <Plus size={16} />
        Add Illustration
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
  return (
    <div className="mb-3 grid gap-1.5 text-xs font-medium text-text-muted">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClassName}
      >
        <option value="">No Oshi</option>
        {oshis.map((oshi) => (
          <option key={oshi.id} value={oshi.id}>{oshi.name}</option>
        ))}
      </select>
    </div>
  )
}

const fieldClassName = 'w-full rounded-xl border border-border-color bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-soft'

function parseTagInput(value: string): string[] {
  return Array.from(new Set(value.replaceAll('，', ',').split(',').map((tag) => tag.trim()).filter(Boolean)))
}

function formatDate(value: string): string {
  const date = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString()
}

function toDateInput(value: string | null): string {
  if (!value) return ''
  return value.slice(0, 10)
}

function formatImageSize(illustration: Illustration): string {
  const dimensions = illustration.width && illustration.height ? `${illustration.width}x${illustration.height}` : ''
  const size = illustration.file_size > 0 ? `${(illustration.file_size / 1024 / 1024).toFixed(1)} MB` : ''
  return [dimensions, size].filter(Boolean).join(' / ')
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

function getOshiName(oshis: Oshi[], oshiId: string | null): string {
  if (!oshiId) return 'No Oshi'
  return oshis.find((oshi) => oshi.id === oshiId)?.name || 'Unknown Oshi'
}
