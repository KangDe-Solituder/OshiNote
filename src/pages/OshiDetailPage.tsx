import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, Check, GitGraph, LayoutGrid, List, Loader2, Palette, Plus, Search, StickyNote, Trash2, X } from 'lucide-react'
import clsx from 'clsx'
import { Button } from '../components/ui/Button'
import { TagGraphView } from '../components/features/notes/TagGraphView'
import { useArchiveStore } from '../stores/archiveStore'
import { useNoteStore } from '../stores/noteStore'
import { useOshiStore } from '../stores/oshiStore'
import { fetchOshiById } from '../features/oshis/oshiService'
import { getOshiArchiveNoteCounts } from '../features/notes/noteService'
import type { Archive, CardStyle, Oshi, OshiArchiveNoteCounts, OshiNoteArchiveFilter } from '../types'
import { usePageTransition } from '../components/features/themes/uiMotion'
import { useI18n } from '../i18n/useI18n'

const ARCHIVE_FILTER_ALL = 'all'
const ARCHIVE_FILTER_UNFILED = 'unfiled'
const ARCHIVE_FILTER_PREFIX = 'archive:'
const EMPTY_ARCHIVE_COUNTS: OshiArchiveNoteCounts = { all: 0, unfiled: 0, byArchiveId: {} }
type NoteArchiveFilterValue = typeof ARCHIVE_FILTER_ALL | typeof ARCHIVE_FILTER_UNFILED | `${typeof ARCHIVE_FILTER_PREFIX}${string}`

export function OshiDetailPage() {
  const { t } = useI18n()
  const { oshiId } = useParams<{ oshiId: string }>()
  const [oshi, setOshi] = useState<Oshi | null>(null)
  const [loading, setLoading] = useState(true)
  const [newArchiveName, setNewArchiveName] = useState('')
  const [showAddArchive, setShowAddArchive] = useState(false)
  const [showCardStyleMenu, setShowCardStyleMenu] = useState(false)
  const [activeArchiveFilter, setActiveArchiveFilter] = useState<NoteArchiveFilterValue>(ARCHIVE_FILTER_ALL)
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [archiveCounts, setArchiveCounts] = useState<OshiArchiveNoteCounts>(EMPTY_ARCHIVE_COUNTS)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const pageTransition = usePageTransition()

  const { archives, fetchByOshi: fetchArchivesByOshi, createArchive, deleteArchive } = useArchiveStore()
  const {
    notes, totalNotes, currentPage, viewMode, cardStyle, searchQuery, loading: notesLoading,
    fetchByOshi: fetchNotesByOshi, setViewMode, setCardStyle, setSearchQuery, setPage,
  } = useNoteStore()
  const refreshOshis = useOshiStore((s) => s.fetchAll)

  useEffect(() => {
    if (!oshiId) return
    setLoading(true)
    setActiveArchiveFilter(ARCHIVE_FILTER_ALL)
    setSubmittedQuery('')
    setArchiveCounts(EMPTY_ARCHIVE_COUNTS)
    setSearchQuery('')
    fetchOshiById(oshiId).then((o) => { setOshi(o); setLoading(false) })
    fetchArchivesByOshi(oshiId)
  }, [oshiId, fetchArchivesByOshi, setSearchQuery])

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!toolbarRef.current?.contains(event.target as Node)) {
        setShowCardStyleMenu(false)
        setShowAddArchive(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  const totalPages = Math.max(1, Math.ceil(totalNotes / useNoteStore.getState().pageSize))
  const archiveTabs = buildArchiveTabs(archives, archiveCounts, t)

  const refreshArchiveCounts = useCallback(async () => {
    if (!oshiId) return
    setArchiveCounts(await getOshiArchiveNoteCounts(oshiId))
  }, [oshiId])

  const loadNotes = useCallback(async (page = 1, filter: NoteArchiveFilterValue = activeArchiveFilter) => {
    if (!oshiId) return
    const archiveId = getArchiveIdFromFilter(filter)
    await fetchNotesByOshi(oshiId, {
      query: submittedQuery || undefined,
      archiveFilter: getArchiveFilterKind(filter),
      archiveId,
      page,
      pageSize: useNoteStore.getState().pageSize,
    })
  }, [activeArchiveFilter, fetchNotesByOshi, oshiId, submittedQuery])

  useEffect(() => {
    if (viewMode === 'journal') setViewMode('card')
  }, [setViewMode, viewMode])

  useEffect(() => {
    loadNotes(1)
    refreshArchiveCounts()
  }, [loadNotes, refreshArchiveCounts])

  useEffect(() => {
    const activeArchiveId = getArchiveIdFromFilter(activeArchiveFilter)
    if (activeArchiveId && !archives.some((archive) => archive.id === activeArchiveId)) {
      setActiveArchiveFilter(ARCHIVE_FILTER_ALL)
    }
    if (activeArchiveFilter === ARCHIVE_FILTER_UNFILED && archiveCounts.unfiled === 0) {
      setActiveArchiveFilter(ARCHIVE_FILTER_ALL)
    }
  }, [activeArchiveFilter, archiveCounts.unfiled, archives])

  function handleSearch() {
    const nextQuery = searchQuery.trim()
    if (nextQuery === submittedQuery) {
      loadNotes(1)
      return
    }
    setSubmittedQuery(nextQuery)
  }

  async function handleAddArchive() {
    if (!oshiId || !newArchiveName.trim()) return
    const archive = await createArchive(oshiId, newArchiveName.trim())
    await fetchArchivesByOshi(oshiId)
    await refreshArchiveCounts()
    setActiveArchiveFilter(getArchiveFilterValue(archive.id))
    setNewArchiveName('')
    setShowAddArchive(false)
  }

  async function handleDeleteArchive(archiveId: string, archiveName: string) {
    if (!oshiId) return
    const noteCount = archiveCounts.byArchiveId[archiveId] || 0
    const message = noteCount > 0
      ? `Delete archive "${archiveName}"? Its ${noteCount} note${noteCount === 1 ? '' : 's'} will be kept in All Notes as unfiled.`
      : `Delete empty archive "${archiveName}"?`
    if (!confirm(message)) return
    const nextFilter = activeArchiveFilter === getArchiveFilterValue(archiveId) ? ARCHIVE_FILTER_ALL : activeArchiveFilter
    await deleteArchive(archiveId)
    await fetchArchivesByOshi(oshiId)
    await refreshOshis()
    await refreshArchiveCounts()
    if (nextFilter !== activeArchiveFilter) {
      setActiveArchiveFilter(nextFilter)
    } else {
      await loadNotes(1, nextFilter)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={32} className="animate-spin text-accent" />
      </div>
    )
  }

  if (!oshi) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-text-muted mb-4">Oshi not found</p>
          <Link to="/oshis">
            <Button variant="secondary">Back to Oshis</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div
        ref={toolbarRef}
        className="relative z-40 border-b border-border-color bg-bg-primary/60 px-6 py-4 lg:px-10"
      >
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4 border-b border-border-color">
          <div className="flex min-w-0 flex-wrap items-end gap-5">
            {archiveTabs.map((tab) => (
              <ArchiveTab
                key={tab.id}
                tab={tab}
                active={activeArchiveFilter === tab.id}
                onSelect={() => setActiveArchiveFilter(tab.id)}
                onDelete={tab.archiveId ? () => handleDeleteArchive(tab.archiveId!, tab.label) : undefined}
                deleteTitle={t('notes.archive.delete')}
              />
            ))}

            {showAddArchive ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  handleAddArchive()
                }}
                className="flex items-center gap-1 pb-2"
              >
                <input
                  autoFocus
                  value={newArchiveName}
                  onChange={(event) => setNewArchiveName(event.target.value)}
                  placeholder={t('notes.archive.namePlaceholder')}
                  className="h-8 min-w-0 rounded-lg border border-accent bg-bg-primary px-2 text-sm text-text-primary focus:outline-none"
                />
                <button type="submit" className="rounded-md p-1.5 text-accent hover:bg-accent-soft" title={t('notes.archive.create')}>
                  <Check size={14} />
                </button>
                <button type="button" onClick={() => setShowAddArchive(false)} className="rounded-md p-1.5 text-text-muted hover:bg-bg-secondary hover:text-text-primary" title={t('common.cancel')}>
                  <X size={14} />
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddArchive(true)}
                className="border-b-2 border-transparent px-1 pb-3 text-sm font-semibold text-text-muted transition-colors hover:text-accent"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Plus size={14} />
                  {t('notes.archive.create')}
                </span>
              </button>
            )}
          </div>

          <p className="pb-3 text-sm text-text-muted">
            {t('notes.archive.currentCount', { count: totalNotes, plural: totalNotes === 1 ? '' : 's' })}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap overflow-visible">
          <div className="relative flex-1 min-w-[180px] max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              placeholder={t('notes.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-border-color bg-bg-secondary text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-soft"
            />
          </div>

          <div className="flex gap-1 bg-bg-secondary rounded-xl p-1">
            {[
              { mode: 'card' as const, icon: LayoutGrid, title: t('notes.cardView') },
              { mode: 'list' as const, icon: List, title: t('notes.listView') },
              { mode: 'graph' as const, icon: GitGraph, title: t('notes.graphView') },
            ].map(({ mode, icon: Icon, title }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === mode ? 'bg-bg-primary text-accent shadow-sm' : 'text-text-muted hover:text-text-primary'
                }`}
                title={title}
              >
                <Icon size={18} />
              </button>
            ))}
          </div>

        {viewMode === 'card' && (
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowCardStyleMenu(!showCardStyleMenu)
                setShowAddArchive(false)
              }}
              className={clsx(
                'flex items-center gap-1.5 rounded-lg border border-border-color bg-bg-secondary px-2.5 py-2 text-sm transition-colors',
                showCardStyleMenu ? 'text-accent ring-2 ring-accent-soft' : 'text-text-secondary hover:text-text-primary'
              )}
              title="Card skin"
            >
              <Palette size={17} />
              <span className="capitalize">{cardStyle}</span>
            </button>

            {showCardStyleMenu && (
              <div className="absolute right-0 top-12 z-50 w-48 rounded-xl border border-border-color bg-bg-primary p-2 shadow-xl">
                <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Card skin</p>
                {CARD_STYLES.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => {
                      setCardStyle(style.id)
                      setShowCardStyleMenu(false)
                    }}
                    className={clsx(
                      'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors',
                      cardStyle === style.id
                        ? 'bg-accent-soft text-accent'
                        : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
                    )}
                  >
                    <style.icon size={15} />
                    {style.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <Link to={`/oshis/${oshiId}/notes/new`}>
          <Button size="sm">
            <Plus size={16} />
            {t('notes.new')}
          </Button>
        </Link>

        </div>
      </div>

      {/* Content */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={notesLoading ? 'loading' : viewMode}
            {...pageTransition}
            className="absolute inset-0 overflow-y-auto p-6"
          >
            {notesLoading && (
              <div className="text-center py-12">
                <Loader2 size={24} className="mx-auto mb-3 text-accent animate-spin" />
              </div>
            )}

            {!notesLoading && notes.length === 0 && (
              <div className="text-center py-20">
                <StickyNote size={48} className="mx-auto mb-4 text-accent-soft" />
                <h3 className="text-lg font-semibold text-text-primary mb-2">{t('notes.empty.title')}</h3>
                <p className="text-text-muted mb-6">{t('notes.empty.body')}</p>
                <Link to={`/oshis/${oshiId}/notes/new`}>
                  <Button size="lg">
                    <Plus size={18} />
                    {t('notes.new')}
                  </Button>
                </Link>
              </div>
            )}

            {!notesLoading && notes.length > 0 && viewMode === 'graph' && (
              <div className="h-full">
                <TagGraphView notes={notes} />
              </div>
            )}

            {!notesLoading && notes.length > 0 && viewMode !== 'graph' && (
              <>
            <div className={viewMode === 'card' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4' : 'space-y-1'}>
              {notes.map((note, index) => (
                <Link
                  key={note.id}
                  to={`/oshis/${oshiId}/notes/${note.id}`}
                  className={viewMode === 'card'
                    ? getNoteCardClass(cardStyle, index)
                    : 'flex items-center gap-4 px-4 py-2.5 rounded-lg hover:bg-bg-secondary transition-colors'}
                >
                  {viewMode === 'list' ? (
                    <>
                      <span className="flex-1 text-sm font-medium text-text-primary truncate">{note.title || 'Untitled'}</span>
                      <div className="flex gap-1 shrink-0">
                        {note.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="px-1.5 py-0.5 rounded-full text-xs bg-bg-tertiary text-text-muted">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <span className="text-xs text-text-muted shrink-0 w-20 text-right">
                        {new Date(note.created_at).toLocaleDateString()}
                      </span>
                    </>
                  ) : (
                    <>
                      {cardStyle === 'sticky' && (
                        <span className="absolute left-1/2 top-0 h-5 w-20 -translate-x-1/2 -translate-y-1/2 rotate-[-4deg] rounded-sm bg-accent-soft/70 shadow-sm" />
                      )}
                      {cardStyle === 'bookshelf' && (
                        <span className="absolute inset-y-0 left-0 w-3 rounded-l-lg bg-accent/70" />
                      )}
                      {cardStyle === 'postcard' && (
                        <span className="absolute right-4 top-4 h-9 w-9 rounded-md border border-dashed border-accent/45 bg-bg-primary/60" />
                      )}
                      <h4 className={clsx(
                        'font-semibold text-text-primary mb-2 line-clamp-1',
                        cardStyle === 'bookshelf' && 'pl-2',
                        cardStyle === 'postcard' && 'pr-12'
                      )}>
                        {note.title || 'Untitled'}
                      </h4>
                      <p className={clsx(
                        'text-xs text-text-muted mb-3 line-clamp-2',
                        cardStyle === 'bookshelf' && 'pl-2',
                        cardStyle === 'postcard' && 'font-serif italic'
                      )}>
                        {note.plain_text || 'No content'}
                      </p>
                      {cardStyle === 'postcard' && (
                        <div className="mb-3 space-y-1 pr-10">
                          <span className="block h-px bg-border-color/70" />
                          <span className="block h-px bg-border-color/50" />
                        </div>
                      )}
                      <div className={clsx('flex items-center gap-2 flex-wrap', cardStyle === 'bookshelf' && 'pl-2')}>
                        {note.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="px-2 py-0.5 rounded-full text-xs bg-bg-tertiary text-text-muted">
                            {tag}
                          </span>
                        ))}
                        <span className="text-xs text-text-muted ml-auto">
                          {new Date(note.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </>
                  )}
                </Link>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => {
                    setPage(currentPage - 1)
                    loadNotes(currentPage - 1)
                  }}
                >
                  Prev
                </Button>
                <span className="text-sm text-text-muted px-2">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => {
                    setPage(currentPage + 1)
                    loadNotes(currentPage + 1)
                  }}
                >
                  Next
                </Button>
              </div>
            )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

interface ArchiveTabItem {
  id: NoteArchiveFilterValue
  label: string
  count: number
  archiveId?: string
}

function ArchiveTab({
  tab,
  active,
  onSelect,
  onDelete,
  deleteTitle,
}: {
  tab: ArchiveTabItem
  active: boolean
  onSelect: () => void
  onDelete?: () => void
  deleteTitle: string
}) {
  return (
    <div className="group flex items-center gap-1">
      <button
        type="button"
        onClick={onSelect}
        className={clsx(
          'border-b-2 px-1 pb-3 text-sm font-semibold transition-colors',
          active ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-text-primary'
        )}
      >
        <span>{tab.label}</span>
        <span className={clsx(
          'ml-1.5 rounded-full px-1.5 py-0.5 text-[11px]',
          active ? 'bg-accent-soft text-accent' : 'bg-bg-secondary text-text-muted'
        )}>
          {tab.count}
        </span>
      </button>

      {active && onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="mb-2 rounded-md p-1 text-text-muted opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
          title={deleteTitle}
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  )
}

function buildArchiveTabs(
  archives: Archive[],
  archiveCounts: OshiArchiveNoteCounts,
  t: ReturnType<typeof useI18n>['t']
): ArchiveTabItem[] {
  const tabs: ArchiveTabItem[] = [
    { id: ARCHIVE_FILTER_ALL, label: t('common.all'), count: archiveCounts.all },
  ]

  if (archiveCounts.unfiled > 0) {
    tabs.push({ id: ARCHIVE_FILTER_UNFILED, label: t('common.unfiled'), count: archiveCounts.unfiled })
  }

  tabs.push(
    ...archives.map((archive) => ({
      id: getArchiveFilterValue(archive.id),
      label: archive.name,
      count: archiveCounts.byArchiveId[archive.id] || 0,
      archiveId: archive.id,
    }))
  )

  return tabs
}

function getArchiveFilterValue(archiveId: string): NoteArchiveFilterValue {
  return `${ARCHIVE_FILTER_PREFIX}${archiveId}`
}

function getArchiveIdFromFilter(filter: NoteArchiveFilterValue): string | null {
  return filter.startsWith(ARCHIVE_FILTER_PREFIX) ? filter.slice(ARCHIVE_FILTER_PREFIX.length) : null
}

function getArchiveFilterKind(filter: NoteArchiveFilterValue): OshiNoteArchiveFilter {
  if (filter === ARCHIVE_FILTER_UNFILED) return 'unfiled'
  if (getArchiveIdFromFilter(filter)) return 'archive'
  return 'all'
}

function getNoteCardClass(cardStyle: CardStyle, index: number): string {
  return clsx(
    'relative block min-h-[150px] overflow-hidden p-4 border backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg',
    cardStyle === 'basic' && 'rounded-xl border-border-color bg-bg-card shadow-sm',
    cardStyle === 'sticky' && [
      'rounded-xl border-yellow-200/70 bg-[#fff7c7]/80 shadow-md',
      index % 2 === 0 ? 'rotate-[-0.8deg]' : 'rotate-[0.7deg]',
    ],
    cardStyle === 'bookshelf' && [
      'rounded-lg border-border-color bg-bg-card shadow-sm',
      "before:absolute before:inset-x-4 before:bottom-3 before:h-px before:bg-border-color/70 before:content-['']",
      index % 3 === 0 && 'bg-[#eef6ff]/85',
      index % 3 === 1 && 'bg-[#f3f0ff]/85',
      index % 3 === 2 && 'bg-[#fff1f5]/85',
    ],
    cardStyle === 'postcard' && [
      'rounded-md border-2 border-dashed border-accent/35 bg-[#fffdf8]/90 shadow-sm',
      "after:absolute after:bottom-3 after:right-4 after:h-px after:w-20 after:bg-border-color/70 after:content-['']",
    ]
  )
}

const CARD_STYLES: { id: CardStyle; label: string; icon: typeof Palette }[] = [
  { id: 'basic', label: 'Basic', icon: LayoutGrid },
  { id: 'sticky', label: 'Sticky', icon: StickyNote },
  { id: 'bookshelf', label: 'Bookshelf', icon: BookOpen },
  { id: 'postcard', label: 'Postcard', icon: Palette },
]
