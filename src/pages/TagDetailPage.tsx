import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Loader2, StickyNote } from 'lucide-react'
import { fetchNotesByTag } from '../features/notes/noteService'
import type { Note } from '../types'

export function TagDetailPage() {
  const { tagName } = useParams()
  const decodedTagName = tagName ? decodeURIComponent(tagName) : ''
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!decodedTagName) return
    fetchNotesByTag(decodedTagName)
      .then(setNotes)
      .finally(() => setLoading(false))
  }, [decodedTagName])

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link to="/tags" className="inline-flex items-center gap-2 text-text-muted hover:text-text-primary mb-6 transition-colors">
        <ArrowLeft size={18} />
        Back to Tags
      </Link>
      <h1 className="text-3xl font-bold text-text-primary mb-2">#{decodedTagName}</h1>
      <p className="text-text-secondary mb-8">{notes.length} notes with this tag.</p>

      {loading ? (
        <div className="text-center py-12">
          <Loader2 size={24} className="mx-auto text-accent animate-spin" />
        </div>
      ) : notes.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          No notes found with tag "{decodedTagName}".
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <Link
              key={note.id}
              to={`/oshis/${note.oshi_id}/notes/${note.id}`}
              className="flex items-start gap-3 p-4 rounded-xl border border-border-color bg-bg-card hover:shadow-md transition-all"
            >
              <StickyNote size={18} className="mt-0.5 text-accent shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <h2 className="font-semibold text-text-primary truncate">{note.title || 'Untitled'}</h2>
                  <span className="text-xs text-text-muted shrink-0">
                    {new Date(note.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-text-muted line-clamp-2 mt-1">{note.plain_text || 'No content'}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
