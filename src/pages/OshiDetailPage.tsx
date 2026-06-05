import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { invoke } from '@tauri-apps/api/core'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, FileText, FolderArchive, Palette, Plus, Search, LayoutGrid, List, GitGraph, StickyNote, BookOpen, Loader2, Link2, X, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { Button } from '../components/ui/Button'
import { TagGraphView } from '../components/features/notes/TagGraphView'
import { OshiModuleHeader } from '../components/layout/OshiModuleHeader'
import { useArchiveStore } from '../stores/archiveStore'
import { useNoteStore } from '../stores/noteStore'
import { useOshiStore } from '../stores/oshiStore'
import { fetchOshiById } from '../features/oshis/oshiService'
import type { CardStyle, Oshi } from '../types'
import { usePageTransition, useUiMotionSeconds } from '../components/features/themes/uiMotion'

export function OshiDetailPage() {
  const { oshiId } = useParams<{ oshiId: string }>()
  const [oshi, setOshi] = useState<Oshi | null>(null)
  const [loading, setLoading] = useState(true)
  const [newArchiveName, setNewArchiveName] = useState('')
  const [showAddArchive, setShowAddArchive] = useState(false)
  const [showArchiveMenu, setShowArchiveMenu] = useState(false)
  const [showCardStyleMenu, setShowCardStyleMenu] = useState(false)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const uiMotionSeconds = useUiMotionSeconds()
  const pageTransition = usePageTransition()

  const { archives, activeArchiveId, fetchByOshi, createArchive, deleteArchive, getArchiveNoteCount, setActiveArchive } = useArchiveStore()
  const {
    notes, totalNotes, currentPage, viewMode, cardStyle, searchQuery, loading: notesLoading,
    fetchByArchive, search, setViewMode, setCardStyle, setSearchQuery, setPage,
  } = useNoteStore()
  const refreshOshis = useOshiStore((s) => s.fetchAll)

  useEffect(() => {
    if (!oshiId) return
    fetchOshiById(oshiId).then((o) => { setOshi(o); setLoading(false) })
    fetchByOshi(oshiId)
  }, [oshiId, fetchByOshi])

  useEffect(() => {
    if (activeArchiveId) {
      fetchByArchive(activeArchiveId)
    }
  }, [activeArchiveId, fetchByArchive])

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!toolbarRef.current?.contains(event.target as Node)) {
        setShowArchiveMenu(false)
        setShowCardStyleMenu(false)
        setShowAddArchive(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  const totalPages = Math.max(1, Math.ceil(totalNotes / useNoteStore.getState().pageSize))
  const activeArchive = archives.find((archive) => archive.id === activeArchiveId)

  useEffect(() => {
    if (viewMode === 'journal') setViewMode('card')
  }, [setViewMode, viewMode])

  function handleSearch() {
    if (!oshiId) return
    if (searchQuery.trim()) {
      search(oshiId, { query: searchQuery, page: 1, pageSize: 20 })
    } else if (activeArchiveId) {
      fetchByArchive(activeArchiveId)
    }
  }

  function handleAddArchive() {
    if (!oshiId || !newArchiveName.trim()) return
    createArchive(oshiId, newArchiveName.trim())
    setNewArchiveName('')
    setShowAddArchive(false)
  }

  async function handleDeleteArchive(archiveId: string, archiveName: string) {
    if (!oshiId) return
    const noteCount = await getArchiveNoteCount(archiveId)
    const message = noteCount > 0
      ? `Delete archive "${archiveName}"? Its ${noteCount} note${noteCount === 1 ? '' : 's'} will be kept in All Notes as unfiled.`
      : `Delete empty archive "${archiveName}"?`
    if (!confirm(message)) return
    await deleteArchive(archiveId)
    await fetchByOshi(oshiId)
    await refreshOshis()
    const nextArchive = useArchiveStore.getState().activeArchiveId
    if (nextArchive) {
      await fetchByArchive(nextArchive, 1)
    }
  }

  async function handleOpenExternalLink(value: string) {
    const url = normalizeWebUrl(value)
    if (!url) return
    try {
      await invoke('open_external_url', { url })
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer')
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
      <OshiModuleHeader
        oshiId={oshiId!}
        title="Notes"
        subtitle={`${totalNotes} notes for ${oshi.name}`}
        icon={FileText}
        actions={oshi.activity_links.length > 0 && (
          <div className="hidden max-w-[220px] shrink-0 flex-col gap-1 md:flex">
            {oshi.activity_links.slice(0, 2).map((url) => (
              <button
                type="button"
                key={url}
                onClick={() => handleOpenExternalLink(url)}
                className="flex min-w-0 items-center gap-1.5 text-xs text-accent transition-colors hover:text-accent-hover"
                title={url}
              >
                <Link2 size={13} className="shrink-0 text-text-muted" />
                <span className="truncate">{formatLinkLabel(url)}</span>
              </button>
            ))}
          </div>
        )}
      />

      {/* Toolbar */}
      <AnimatePresence initial={false}>
      <motion.div
        ref={toolbarRef}
        initial={{ opacity: 0, y: -14, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, y: -14, height: 0 }}
        transition={{ duration: uiMotionSeconds, ease: 'easeOut' }}
        className="relative z-40 p-4 border-b border-border-color flex items-center gap-3 flex-wrap bg-bg-secondary/10 overflow-visible"
      >
        <div className="relative flex-1 min-w-[180px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-border-color bg-bg-secondary text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-soft"
          />
        </div>

        <div className="flex gap-1 bg-bg-secondary rounded-xl p-1">
          {[
            { mode: 'card' as const, icon: LayoutGrid },
            { mode: 'list' as const, icon: List },
            { mode: 'graph' as const, icon: GitGraph },
          ].map(({ mode, icon: Icon }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === mode ? 'bg-bg-primary text-accent shadow-sm' : 'text-text-muted hover:text-text-primary'
              }`}
              title={mode}
            >
              <Icon size={18} />
            </button>
          ))}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowArchiveMenu(!showArchiveMenu)
              setShowCardStyleMenu(false)
            }}
            className={clsx(
              'flex items-center gap-1.5 rounded-lg border border-border-color bg-bg-secondary px-2.5 py-2 text-sm transition-colors',
              showArchiveMenu ? 'text-accent ring-2 ring-accent-soft' : 'text-text-secondary hover:text-text-primary'
            )}
            title="Archives"
          >
            <FolderArchive size={17} />
            <span className="max-w-24 truncate">{activeArchive?.name || 'Archive'}</span>
            <ChevronDown size={14} />
          </button>

          {showArchiveMenu && (
            <div className="absolute right-0 top-12 z-50 w-64 rounded-xl border border-border-color bg-bg-primary p-2 shadow-xl">
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Archives</p>
              <div className="max-h-56 overflow-y-auto">
                {archives.length === 0 ? (
                  <p className="px-2 py-3 text-xs text-text-muted">No archives yet.</p>
                ) : (
                  archives.map((archive) => (
                    <div
                      key={archive.id}
                      className={clsx(
                        'group flex items-center gap-1 rounded-lg',
                        archive.id === activeArchiveId ? 'bg-accent-soft text-accent' : 'text-text-secondary hover:bg-bg-secondary'
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActiveArchive(archive.id)
                          setShowArchiveMenu(false)
                        }}
                        className="min-w-0 flex-1 truncate px-2 py-2 text-left text-sm"
                      >
                        {archive.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteArchive(archive.id, archive.name)}
                        className="mr-1 rounded-md p-1 text-text-muted opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                        title="Delete archive"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-2 border-t border-border-color pt-2">
                {showAddArchive ? (
                  <form onSubmit={(e) => { e.preventDefault(); handleAddArchive() }} className="flex items-center gap-1">
                    <input
                      autoFocus
                      value={newArchiveName}
                      onChange={(e) => setNewArchiveName(e.target.value)}
                      placeholder="Archive name..."
                      className="min-w-0 flex-1 rounded-lg border border-accent bg-bg-primary px-2 py-1.5 text-sm text-text-primary focus:outline-none"
                    />
                    <button type="submit" className="p-1.5 text-accent hover:text-accent-hover" title="Create archive"><Plus size={15} /></button>
                    <button type="button" onClick={() => setShowAddArchive(false)} className="p-1.5 text-text-muted hover:text-text-primary" title="Cancel"><X size={15} /></button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAddArchive(true)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-secondary hover:text-accent"
                  >
                    <Plus size={15} />
                    New archive
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {viewMode === 'card' && (
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowCardStyleMenu(!showCardStyleMenu)
                setShowArchiveMenu(false)
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
              <ChevronDown size={14} />
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
            New Note
          </Button>
        </Link>

      </motion.div>
      </AnimatePresence>

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
                <h3 className="text-lg font-semibold text-text-primary mb-2">No notes yet</h3>
                <p className="text-text-muted mb-6">Write your first impression of this oshi.</p>
                <Link to={`/oshis/${oshiId}/notes/new`}>
                  <Button size="lg">
                    <Plus size={18} />
                    Write a Note
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
                    if (activeArchiveId) fetchByArchive(activeArchiveId, currentPage - 1)
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
                    if (activeArchiveId) fetchByArchive(activeArchiveId, currentPage + 1)
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

function formatLinkLabel(value: string): string {
  try {
    const url = new URL(value)
    return url.hostname.replace(/^www\./, '')
  } catch {
    return value
  }
}

function normalizeWebUrl(value: string): string | null {
  try {
    const withProtocol = /^[a-z]+:\/\//i.test(value) ? value : `https://${value}`
    const url = new URL(withProtocol)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}
