import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Plus, Search, LayoutGrid, List, GitGraph, StickyNote, BookOpen, Mail, Loader2, Link2, X } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { useArchiveStore } from '../stores/archiveStore'
import { useNoteStore } from '../stores/noteStore'
import { fetchOshiById } from '../features/oshis/oshiService'
import type { Oshi } from '../types'

export function OshiDetailPage() {
  const { oshiId } = useParams<{ oshiId: string }>()
  const [oshi, setOshi] = useState<Oshi | null>(null)
  const [loading, setLoading] = useState(true)
  const [newArchiveName, setNewArchiveName] = useState('')
  const [showAddArchive, setShowAddArchive] = useState(false)

  const { archives, activeArchiveId, fetchByOshi, createArchive, setActiveArchive } = useArchiveStore()
  const {
    notes, totalNotes, currentPage, viewMode, cardStyle, searchQuery, loading: notesLoading,
    fetchByArchive, search, setViewMode, setCardStyle, setSearchQuery, setPage,
  } = useNoteStore()

  useEffect(() => {
    if (!oshiId) return
    setLoading(true)
    fetchOshiById(oshiId).then((o) => { setOshi(o); setLoading(false) })
    fetchByOshi(oshiId)
  }, [oshiId, fetchByOshi])

  useEffect(() => {
    if (activeArchiveId) {
      fetchByArchive(activeArchiveId)
    }
  }, [activeArchiveId, fetchByArchive])

  const totalPages = Math.max(1, Math.ceil(totalNotes / useNoteStore.getState().pageSize))

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
      {/* Header */}
      <div className="p-6 border-b border-border-color bg-bg-secondary/30">
        <div className="flex items-center gap-4 mb-4">
          <Link to="/oshis" className="text-text-muted hover:text-text-primary transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div
            className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center text-xl font-bold text-white shadow-lg shrink-0"
            style={{ backgroundColor: oshi.color || '#EC4899' }}
          >
            {oshi.avatar ? (
              <img src={oshi.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              oshi.name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-text-primary truncate">{oshi.name}</h1>
            <p className="text-sm text-text-muted">{totalNotes} notes</p>
          </div>
        </div>

        {(oshi.description || oshi.activity_links.length > 0) && (
          <div className="mb-4 pl-9 sm:pl-16">
            {oshi.description && (
              <p className="text-sm text-text-secondary mb-2 whitespace-pre-wrap">{oshi.description}</p>
            )}
            {oshi.activity_links.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Link2 size={14} className="text-text-muted" />
                {oshi.activity_links.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 rounded-full text-xs bg-accent-soft text-accent hover:bg-accent hover:text-white transition-colors"
                    title={url}
                  >
                    {formatLinkLabel(url)}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Archives */}
        <div className="flex gap-2 overflow-x-auto pb-1 items-center">
          {archives.map((archive) => (
            <button
              key={archive.id}
              onClick={() => setActiveArchive(archive.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors shrink-0 ${
                activeArchiveId === archive.id
                  ? 'bg-accent text-white'
                  : 'bg-bg-tertiary text-text-secondary hover:bg-accent-soft hover:text-accent'
              }`}
            >
              {archive.name}
            </button>
          ))}
          {showAddArchive ? (
            <form
              onSubmit={(e) => { e.preventDefault(); handleAddArchive() }}
              className="flex items-center gap-1 shrink-0"
            >
              <input
                autoFocus
                value={newArchiveName}
                onChange={(e) => setNewArchiveName(e.target.value)}
                placeholder="Name..."
                className="w-24 px-2 py-1 rounded-full text-sm border border-accent bg-bg-primary text-text-primary focus:outline-none"
              />
              <button type="submit" className="p-1 text-accent hover:text-accent-hover"><Plus size={14} /></button>
              <button type="button" onClick={() => setShowAddArchive(false)} className="p-1 text-text-muted hover:text-text-primary"><X size={14} /></button>
            </form>
          ) : (
            <button
              onClick={() => setShowAddArchive(true)}
              className="px-3 py-1.5 rounded-full text-sm border border-dashed border-border-hover text-text-muted hover:text-accent hover:border-accent transition-colors shrink-0 flex items-center gap-1"
            >
              <Plus size={14} />
              Add
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="p-4 border-b border-border-color flex items-center gap-3 flex-wrap bg-bg-secondary/10">
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

        {viewMode === 'card' && (
          <div className="flex gap-1 bg-bg-secondary rounded-xl p-1">
            {[
              { style: 'sticky' as const, icon: StickyNote },
              { style: 'bookshelf' as const, icon: BookOpen },
              { style: 'postcard' as const, icon: Mail },
            ].map(({ style, icon: Icon }) => (
              <button
                key={style}
                onClick={() => setCardStyle(style)}
                className={`p-2 rounded-lg transition-colors ${
                  cardStyle === style ? 'bg-bg-primary text-accent shadow-sm' : 'text-text-muted hover:text-text-primary'
                }`}
                title={style}
              >
                <Icon size={18} />
              </button>
            ))}
          </div>
        )}

        <Link to={`/oshis/${oshiId}/notes/new`}>
          <Button size="sm">
            <Plus size={16} />
            New Note
          </Button>
        </Link>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
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

        {!notesLoading && notes.length > 0 && (
          <>
            <div className={viewMode === 'card' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4' : 'space-y-1'}>
              {notes.map((note) => (
                <Link
                  key={note.id}
                  to={`/oshis/${oshiId}/notes/${note.id}`}
                  className={
                    viewMode === 'card'
                      ? `block p-4 rounded-xl border border-border-color bg-bg-card backdrop-blur-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 ${
                          cardStyle === 'sticky' ? 'rotate-[-0.5deg]' : cardStyle === 'postcard' ? 'border-2' : ''
                        }`
                      : 'flex items-center gap-4 px-4 py-2.5 rounded-lg hover:bg-bg-secondary transition-colors'
                  }
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
                      <h4 className="font-semibold text-text-primary mb-2 line-clamp-1">{note.title || 'Untitled'}</h4>
                      <p className="text-xs text-text-muted mb-3 line-clamp-2">{note.plain_text || 'No content'}</p>
                      <div className="flex items-center gap-2 flex-wrap">
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
                  onClick={() => { setPage(currentPage - 1); activeArchiveId && fetchByArchive(activeArchiveId, currentPage - 1) }}
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
                  onClick={() => { setPage(currentPage + 1); activeArchiveId && fetchByArchive(activeArchiveId, currentPage + 1) }}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function formatLinkLabel(value: string): string {
  try {
    const url = new URL(value)
    return url.hostname.replace(/^www\./, '')
  } catch {
    return value
  }
}
