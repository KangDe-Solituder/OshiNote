import { useEffect, useMemo, useState } from 'react'
import { FileText, Heart, LayoutGrid, List, Loader2, Plus, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { PAGE_CONTENT_CLASS, PAGE_HEADER_CLASS } from '../components/layout/pageShell'
import { fetchAllNotes, getAllTags } from '../features/notes/noteService'
import { fetchAllArchives } from '../features/oshis/archiveService'
import { fetchAllOshis } from '../features/oshis/oshiService'
import type { Archive, NoteLibraryItem, NoteOwnershipFilter, NoteSort, Oshi } from '../types'

const PAGE_SIZE = 20

export function NotesPage() {
  const [notes, setNotes] = useState<NoteLibraryItem[]>([])
  const [oshis, setOshis] = useState<Oshi[]>([])
  const [archives, setArchives] = useState<Archive[]>([])
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([])
  const [query, setQuery] = useState('')
  const [oshiId, setOshiId] = useState('')
  const [archiveId, setArchiveId] = useState('')
  const [tag, setTag] = useState('')
  const [ownership, setOwnership] = useState<NoteOwnershipFilter>('all')
  const [sort, setSort] = useState<NoteSort>('newest')
  const [favorite, setFavorite] = useState(false)
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchAllOshis(), fetchAllArchives(), getAllTags()])
      .then(([oshiRows, archiveRows, tagRows]) => {
        setOshis(oshiRows)
        setArchives(archiveRows)
        setTags(tagRows)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchAllNotes({
      query,
      oshiId: oshiId || undefined,
      archiveId: archiveId || undefined,
      tag: tag || undefined,
      ownership,
      favorite: favorite || undefined,
      sort,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((result) => {
        setNotes(result.notes)
        setTotal(result.total)
      })
      .catch(() => {
        setNotes([])
        setTotal(0)
      })
      .finally(() => setLoading(false))
  }, [archiveId, favorite, oshiId, ownership, page, query, sort, tag])

  const visibleArchives = useMemo(
    () => oshiId ? archives.filter((archive) => archive.oshi_id === oshiId) : archives,
    [archives, oshiId]
  )
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function resetPage() {
    setPage(1)
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg-primary">
      <header className={PAGE_HEADER_CLASS}>
        <div className="flex w-full items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">All Notes</h1>
          <p className="mt-1 text-text-secondary">Your full memory library, including notes that still need sorting.</p>
        </div>
        <Link to="/notes/new">
          <Button>
            <Plus size={16} />
            New Note
          </Button>
        </Link>
        </div>
      </header>

      <main className={PAGE_CONTENT_CLASS}>
        <div className="mx-auto max-w-6xl">

      <div className="mb-5 space-y-3 border-y border-border-color py-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); resetPage() }}
              placeholder="Search title, content, or tags..."
              className="w-full rounded-xl border border-border-color bg-bg-secondary py-2.5 pl-9 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-soft"
            />
          </div>
          <div className="flex rounded-xl bg-bg-secondary p-1">
            <IconToggle active={viewMode === 'card'} title="Card view" onClick={() => setViewMode('card')}><LayoutGrid size={17} /></IconToggle>
            <IconToggle active={viewMode === 'list'} title="List view" onClick={() => setViewMode('list')}><List size={17} /></IconToggle>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect value={oshiId} onChange={(value) => { setOshiId(value); setArchiveId(''); resetPage() }}>
            <option value="">All Oshis</option>
            {oshis.map((oshi) => <option key={oshi.id} value={oshi.id}>{oshi.name}</option>)}
          </FilterSelect>
          <FilterSelect value={archiveId} onChange={(value) => { setArchiveId(value); resetPage() }}>
            <option value="">All Archives</option>
            {visibleArchives.map((archive) => <option key={archive.id} value={archive.id}>{archive.name}</option>)}
          </FilterSelect>
          <FilterSelect value={tag} onChange={(value) => { setTag(value); resetPage() }}>
            <option value="">All Tags</option>
            {tags.map((item) => <option key={item.tag} value={item.tag}>#{item.tag}</option>)}
          </FilterSelect>
          <FilterSelect value={ownership} onChange={(value) => { setOwnership(value as NoteOwnershipFilter); resetPage() }}>
            <option value="all">Any Status</option>
            <option value="unassigned">Unassigned Oshi</option>
            <option value="unfiled">Unfiled Archive</option>
            <option value="untagged">No Tags</option>
            <option value="needs-sorting">Needs Sorting</option>
          </FilterSelect>
          <FilterSelect value={sort} onChange={(value) => { setSort(value as NoteSort); resetPage() }}>
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="updated">Recently Updated</option>
          </FilterSelect>
          <label className="inline-flex items-center gap-2 rounded-lg border border-border-color bg-bg-secondary px-3 py-2 text-sm text-text-secondary">
            <input type="checkbox" checked={favorite} onChange={(e) => { setFavorite(e.target.checked); resetPage() }} />
            Favorites
          </label>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center"><Loader2 size={28} className="mx-auto animate-spin text-accent" /></div>
      ) : notes.length === 0 ? (
        <div className="py-20 text-center">
          <FileText size={46} className="mx-auto mb-4 text-accent-soft" />
          <h2 className="text-lg font-semibold text-text-primary">No matching notes</h2>
          <p className="mt-1 text-sm text-text-muted">Try another filter or write a new memory.</p>
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {notes.map((note) => <NoteCard key={note.id} note={note} />)}
        </div>
      ) : (
        <div className="space-y-1">
          {notes.map((note) => <NoteRow key={note.id} note={note} />)}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
          <span className="text-sm text-text-muted">{page} / {totalPages}</span>
          <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
        </div>
      </main>
    </div>
  )
}

function NoteCard({ note }: { note: NoteLibraryItem }) {
  return (
    <Link to={`/notes/${note.id}`} className="block rounded-lg border border-border-color bg-bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start gap-3">
        <OshiAvatar note={note} />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-1 font-semibold text-text-primary">{note.title || 'Untitled'}</h3>
          <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-text-muted">{note.plain_text || 'No content'}</p>
        </div>
        {note.favorite && <Heart size={15} className="shrink-0 text-pink-500" fill="currentColor" />}
      </div>
      <NoteMeta note={note} />
    </Link>
  )
}

function NoteRow({ note }: { note: NoteLibraryItem }) {
  return (
    <Link to={`/notes/${note.id}`} className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-bg-secondary">
      <OshiAvatar note={note} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">{note.title || 'Untitled'}</span>
      <span className="text-xs text-text-muted">{note.oshi_name || 'Unassigned'}</span>
      <span className="text-xs text-text-muted">{note.archive_name || 'Unfiled'}</span>
      <span className="w-20 text-right text-xs text-text-muted">{new Date(note.created_at).toLocaleDateString()}</span>
    </Link>
  )
}

function NoteMeta({ note }: { note: NoteLibraryItem }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[11px] text-text-muted">
      <span className="rounded-full bg-bg-tertiary px-2 py-0.5">{note.oshi_name || 'Unassigned'}</span>
      <span className="rounded-full bg-bg-tertiary px-2 py-0.5">{note.archive_name || 'Unfiled'}</span>
      {note.tags.slice(0, 2).map((tag) => <span key={tag} className="rounded-full bg-accent-soft px-2 py-0.5 text-accent">#{tag}</span>)}
      <span className="ml-auto">{new Date(note.created_at).toLocaleDateString()}</span>
    </div>
  )
}

function OshiAvatar({ note }: { note: NoteLibraryItem }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold text-white" style={{ backgroundColor: note.oshi_color || '#A78BFA' }}>
      {note.oshi_avatar ? <img src={note.oshi_avatar} alt="" className="h-full w-full object-cover" /> : (note.oshi_name?.charAt(0).toUpperCase() || '?')}
    </span>
  )
}

function FilterSelect({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-border-color bg-bg-secondary px-3 py-2 text-sm text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-soft">
      {children}
    </select>
  )
}

function IconToggle({ active, title, onClick, children }: { active: boolean; title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" title={title} onClick={onClick} className={`rounded-lg p-2 transition-colors ${active ? 'bg-bg-primary text-accent shadow-sm' : 'text-text-muted hover:text-text-primary'}`}>
      {children}
    </button>
  )
}
