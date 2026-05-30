import { useEffect, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Loader2, StickyNote, Search, ArrowUpDown } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { fetchNotesByTag, fetchNotesByTagPaginated } from '../features/notes/noteService'
import type { Note } from '../types'

const PAGE_SIZE = 20

export function TagDetailPage() {
  const { tagName } = useParams()
  const decodedTagName = tagName ? decodeURIComponent(tagName) : ''
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')
  const [localSearch, setLocalSearch] = useState('')
  const [usePaginated, setUsePaginated] = useState(true)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  useEffect(() => {
    if (!decodedTagName) return
    let cancelled = false

    async function loadNotes() {
      await Promise.resolve()
      if (cancelled) return
      setLoading(true)
      try {
        const { notes: n, total: t } = await fetchNotesByTagPaginated(decodedTagName, {
          page,
          pageSize: PAGE_SIZE,
          sort,
        })
        if (cancelled) return
        setNotes(n)
        setTotal(t)
        setUsePaginated(true)
      } catch {
        const n = await fetchNotesByTag(decodedTagName)
        if (cancelled) return
        setNotes(n)
        setTotal(n.length)
        setUsePaginated(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadNotes()
    return () => {
      cancelled = true
    }
  }, [decodedTagName, page, sort])

  // Client-side search within loaded results
  const filteredNotes = useMemo(() => {
    if (!localSearch.trim()) return notes
    const q = localSearch.trim().toLowerCase()
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.plain_text.toLowerCase().includes(q)
    )
  }, [notes, localSearch])

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link
        to="/tags"
        className="inline-flex items-center gap-2 text-text-muted hover:text-text-primary mb-6 transition-colors"
      >
        <ArrowLeft size={18} />
        Back to Tags
      </Link>
      <h1 className="text-3xl font-bold text-text-primary mb-2">#{decodedTagName}</h1>
      <p className="text-text-secondary mb-6">{total} notes with this tag.</p>

      {/* Tools row */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {/* Local search */}
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            placeholder="Filter results..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-border-color bg-bg-secondary text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-soft"
          />
        </div>

        {/* Sort toggle */}
        <button
          onClick={() => {
            setPage(1)
            setSort(sort === 'newest' ? 'oldest' : 'newest')
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border-color bg-bg-secondary text-sm text-text-secondary hover:text-text-primary hover:border-accent transition-colors"
        >
          <ArrowUpDown size={14} />
          {sort === 'newest' ? 'Newest first' : 'Oldest first'}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 size={24} className="mx-auto text-accent animate-spin" />
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="text-center py-20">
          <StickyNote size={48} className="mx-auto mb-4 text-accent-soft" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">
            {localSearch ? 'No matching notes' : 'No notes yet'}
          </h3>
          <p className="text-text-muted">
            {localSearch
              ? `No notes with tag "${decodedTagName}" match your filter.`
              : `No notes found with tag "${decodedTagName}".`}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {filteredNotes.map((note) => (
              <Link
                key={note.id}
                to={`/oshis/${note.oshi_id}/notes/${note.id}`}
                className="flex items-start gap-3 p-4 rounded-xl border border-border-color bg-bg-card hover:shadow-md transition-all"
              >
                <StickyNote size={18} className="mt-0.5 text-accent shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <h2 className="font-semibold text-text-primary truncate">
                      {note.title || 'Untitled'}
                    </h2>
                    <span className="text-xs text-text-muted shrink-0">
                      {new Date(note.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {note.plain_text ? (
                    <p className="text-sm text-text-muted line-clamp-2 mt-1">
                      {note.plain_text}
                    </p>
                  ) : (
                    <p className="text-sm text-text-muted italic mt-1">No content</p>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {usePaginated && totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Prev
              </Button>
              <span className="text-sm text-text-muted px-2">
                {page} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
