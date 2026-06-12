import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { Calendar, Heart, ImageIcon, LayoutGrid, List, Loader2, Plus, Search, UserRound } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { PAGE_CONTENT_CLASS, PAGE_HEADER_CLASS } from '../components/layout/pageShell'
import { fetchAllOshis } from '../features/oshis/oshiService'
import {
  deleteIllustration,
  fetchIllustrations,
  getIllustrationTags,
  toggleIllustrationFavorite,
  updateIllustration,
} from '../features/illustrations/illustrationService'
import type { Illustration, IllustrationCategory, IllustrationSort, Oshi, UpdateIllustrationInput } from '../types'
import {
  formatDate,
  getOshiName,
  IllustrationCreateModal,
  IllustrationDetailDrawer,
  MediaImage,
} from './OshiIllustrationsPage'
import { useI18n } from '../i18n/useI18n'
import { SelectMenu } from '../components/ui/SelectMenu'

type IllustrationCategoryFilter = 'all' | IllustrationCategory

export function IllustrationsPage() {
  const { t } = useI18n()
  const [oshis, setOshis] = useState<Oshi[]>([])
  const [illustrations, setIllustrations] = useState<Illustration[]>([])
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([])
  const [query, setQuery] = useState('')
  const [oshiId, setOshiId] = useState('')
  const [category, setCategory] = useState<IllustrationCategoryFilter>('all')
  const [tag, setTag] = useState('')
  const [sort, setSort] = useState<IllustrationSort>('newest')
  const [favorite, setFavorite] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = useMemo(
    () => illustrations.find((illustration) => illustration.id === selectedId) || null,
    [illustrations, selectedId]
  )

  async function load() {
    setLoading(true)
    try {
      const [oshiRows, rows, tagRows] = await Promise.all([
        fetchAllOshis(),
        fetchIllustrations({
          oshiId: oshiId && oshiId !== '__none' ? oshiId : undefined,
          unassigned: oshiId === '__none',
          category: category === 'all' ? undefined : category,
          favorite: favorite || undefined,
          query,
          tag: tag || undefined,
          sort,
        }),
        getIllustrationTags(oshiId || undefined),
      ])
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
  }, [category, favorite, oshiId, query, sort, tag])

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

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg-primary">
      <header className={PAGE_HEADER_CLASS}>
        <div className="flex w-full items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-text-primary">{t('illustrations.title')}</h1>
            <p className="mt-1 text-text-secondary">{t('illustrations.subtitle')}</p>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={16} />
            {t('illustrations.add')}
          </Button>
        </div>
      </header>

      <main className={PAGE_CONTENT_CLASS}>
        <div className="mx-auto max-w-7xl">
          <div className="mb-5 space-y-3 border-b border-border-color pb-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('illustrations.search')}
                  className="w-full rounded-xl border border-border-color bg-bg-secondary py-2.5 pl-9 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-soft"
                />
              </div>
              <div className="flex rounded-xl bg-bg-secondary p-1">
                <IconToggle active={viewMode === 'grid'} title={t('illustrations.gridView')} onClick={() => setViewMode('grid')}><LayoutGrid size={17} /></IconToggle>
                <IconToggle active={viewMode === 'list'} title={t('illustrations.listView')} onClick={() => setViewMode('list')}><List size={17} /></IconToggle>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <SelectMenu
                value={oshiId}
                onChange={setOshiId}
                options={[
                  { value: '', label: t('notes.allOshis') },
                  { value: '__none', label: t('illustrations.noOshi') },
                  ...oshis.map((oshi) => ({ value: oshi.id, label: oshi.name })),
                ]}
                ariaLabel={t('notes.allOshis')}
                menuClassName="w-[220px]"
              />
              <SelectMenu
                value={category}
                onChange={(value) => setCategory(value as IllustrationCategoryFilter)}
                options={[
                  { value: 'all', label: t('illustrations.allCategories') },
                  { value: 'official', label: t('common.official') },
                  { value: 'fanart', label: t('common.fanart') },
                ]}
                ariaLabel={t('illustrations.allCategories')}
                menuClassName="w-[196px]"
              />
              <SelectMenu
                value={tag}
                onChange={setTag}
                options={[
                  { value: '', label: t('notes.allTags') },
                  ...tags.map((item) => ({ value: item.tag, label: `#${item.tag}` })),
                ]}
                ariaLabel={t('notes.allTags')}
                menuClassName="w-[220px]"
              />
              <SelectMenu
                value={sort}
                onChange={(value) => setSort(value as IllustrationSort)}
                options={[
                  { value: 'newest', label: t('notes.newest') },
                  { value: 'oldest', label: t('notes.oldest') },
                  { value: 'title', label: t('illustrations.titleSort') },
                ]}
                ariaLabel={t('notes.newest')}
                menuClassName="w-[196px]"
              />
              <label className="inline-flex items-center gap-2 rounded-lg border border-border-color bg-bg-secondary px-3 py-2 text-sm text-text-secondary">
                <input type="checkbox" checked={favorite} onChange={(event) => setFavorite(event.target.checked)} />
                {t('common.favorites')}
              </label>
              <span className="ml-auto text-sm text-text-muted">{t('illustrations.count', { count: illustrations.length, plural: illustrations.length === 1 ? '' : 's' })}</span>
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center"><Loader2 size={28} className="mx-auto animate-spin text-accent" /></div>
          ) : illustrations.length === 0 ? (
            <div className="py-20 text-center">
              <ImageIcon size={46} className="mx-auto mb-4 text-accent-soft" />
              <h2 className="text-lg font-semibold text-text-primary">{t('illustrations.empty.title')}</h2>
              <p className="mt-1 text-sm text-text-muted">{t('illustrations.empty.body')}</p>
              <Button className="mt-5" onClick={() => setShowCreate(true)}>
                <Plus size={16} />
                {t('illustrations.add')}
              </Button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {illustrations.map((illustration) => (
                <IllustrationCard
                  key={illustration.id}
                  illustration={illustration}
                  oshis={oshis}
                  onSelect={setSelectedId}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {illustrations.map((illustration) => (
                <IllustrationRow
                  key={illustration.id}
                  illustration={illustration}
                  oshis={oshis}
                  onSelect={setSelectedId}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {showCreate && (
        <IllustrationCreateModal
          oshiId=""
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

function IllustrationCard({
  illustration,
  oshis,
  onSelect,
  onToggleFavorite,
}: {
  illustration: Illustration
  oshis: Oshi[]
  onSelect: (id: string) => void
  onToggleFavorite: (id: string) => void
}) {
  const { t } = useI18n()
  return (
    <article className="overflow-hidden rounded-xl border border-border-color bg-bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <button type="button" onClick={() => onSelect(illustration.id)} className="block w-full text-left">
        <div className="relative aspect-[4/3] bg-bg-tertiary">
          <MediaImage
            path={illustration.thumbnail_path || illustration.original_path}
            alt={illustration.title || illustration.original_filename}
            className="h-full w-full object-cover"
          />
          <CategoryBadge category={illustration.category} />
        </div>
      </button>
      <div className="p-3">
        <div className="flex items-start gap-2">
          <button type="button" onClick={() => onSelect(illustration.id)} className="min-w-0 flex-1 text-left">
            <h2 className="line-clamp-1 text-sm font-semibold text-text-primary">{illustration.title || t('common.untitled')}</h2>
            <p className="mt-1 line-clamp-1 text-xs text-text-muted">{t('common.byArtist', { artist: illustration.artist || t('common.unknownArtist') })}</p>
          </button>
          <FavoriteButton illustration={illustration} onToggleFavorite={onToggleFavorite} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-text-muted">
          <span className="rounded-full bg-bg-tertiary px-2 py-0.5">{getOshiName(oshis, illustration.oshi_id)}</span>
          {illustration.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="rounded-full bg-accent-soft/50 px-2 py-0.5 text-accent">#{tag}</span>
          ))}
          <span className="ml-auto">{formatDate(illustration.date || illustration.created_at)}</span>
        </div>
      </div>
    </article>
  )
}

function IllustrationRow({
  illustration,
  oshis,
  onSelect,
  onToggleFavorite,
}: {
  illustration: Illustration
  oshis: Oshi[]
  onSelect: (id: string) => void
  onToggleFavorite: (id: string) => void
}) {
  const { t } = useI18n()
  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-bg-secondary">
      <button type="button" onClick={() => onSelect(illustration.id)} className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-bg-tertiary">
        <MediaImage
          path={illustration.thumbnail_path || illustration.original_path}
          alt={illustration.title || illustration.original_filename}
          className="h-full w-full object-cover"
        />
      </button>
      <button type="button" onClick={() => onSelect(illustration.id)} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-semibold text-text-primary">{illustration.title || t('common.untitled')}</p>
        <p className="mt-0.5 truncate text-xs text-text-muted">{illustration.original_filename}</p>
      </button>
      <span className="hidden min-w-28 text-xs text-text-muted md:inline-flex md:items-center md:gap-1.5">
        <UserRound size={13} />
        <span className="truncate">{getOshiName(oshis, illustration.oshi_id)}</span>
      </span>
      <span className="hidden min-w-28 truncate text-xs text-text-muted lg:block">{illustration.artist || t('common.unknownArtist')}</span>
      <span className="hidden min-w-20 text-xs text-text-muted lg:inline-flex lg:items-center lg:gap-1.5">
        <Calendar size={13} />
        {formatDate(illustration.date || illustration.created_at)}
      </span>
      <CategoryBadge category={illustration.category} compact />
      <FavoriteButton illustration={illustration} onToggleFavorite={onToggleFavorite} />
    </div>
  )
}

function CategoryBadge({ category, compact = false }: { category: IllustrationCategory; compact?: boolean }) {
  const { t } = useI18n()
  return (
    <span className={clsx(
      compact ? 'shrink-0' : 'absolute left-3 top-3 shadow-sm backdrop-blur',
      'rounded-full px-2.5 py-1 text-xs font-semibold',
      category === 'official'
        ? 'bg-blue-50/85 text-blue-600'
        : 'bg-pink-50/85 text-pink-600'
    )}>
      {category === 'official' ? t('common.official') : t('common.fanart')}
    </span>
  )
}

function FavoriteButton({ illustration, onToggleFavorite }: { illustration: Illustration; onToggleFavorite: (id: string) => void }) {
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
