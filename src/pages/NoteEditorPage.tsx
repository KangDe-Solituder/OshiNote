import { useEffect, useState, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Trash2, Star, Loader2 } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { useNoteStore } from '../stores/noteStore'
import { useArchiveStore } from '../stores/archiveStore'
import { useEditorStore } from '../stores/editorStore'
import { fetchNoteById } from '../features/notes/noteService'
import type { Note } from '../types'

export function NoteEditorPage() {
  const { oshiId, noteId } = useParams<{ oshiId: string; noteId: string }>()
  const navigate = useNavigate()
  const isNew = !noteId || noteId === 'new'

  const [title, setTitle] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [note, setNote] = useState<Note | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [favorite, setFavorite] = useState(false)

  const editorRef = useRef<{ json: object; text: string }>({ json: {}, text: '' })
  const { createNote, updateNote, deleteNote, toggleFavorite } = useNoteStore()
  const { archives, fetchByOshi } = useArchiveStore()
  const isDirty = useEditorStore((s) => s.isDirty)
  const markSaved = useEditorStore((s) => s.markSaved)

  useEffect(() => {
    if (oshiId) fetchByOshi(oshiId)
  }, [oshiId, fetchByOshi])

  useEffect(() => {
    if (isNew) {
      setLoading(false)
      return
    }
    if (!noteId) return
    setLoading(true)
    fetchNoteById(noteId).then((n) => {
      if (n) {
        setNote(n)
        setTitle(n.title)
        setTags(n.tags)
        setFavorite(n.favorite)
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [noteId, isNew])

  async function handleSave() {
    if (!oshiId) return
    setSaving(true)
    try {
      const { json, text } = editorRef.current
      const firstArchiveId = archives[0]?.id || ''
      if (!firstArchiveId) return

      if (isNew) {
        const newNote = await createNote({
          oshi_id: oshiId,
          archive_id: firstArchiveId,
          title: title || 'Untitled',
          content: JSON.stringify(json),
          plain_text: text,
          tags,
        })
        markSaved()
        navigate(`/oshis/${oshiId}/notes/${newNote.id}`, { replace: true })
      } else if (note) {
        await updateNote(note.id, {
          title: title || 'Untitled',
          content: JSON.stringify(json),
          plain_text: text,
          tags,
        })
        markSaved()
        setNote({ ...note, title, content: JSON.stringify(json), plain_text: text, tags })
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!note || !oshiId) return
    if (!confirm('Delete this note?')) return
    await deleteNote(note.id)
    navigate(`/oshis/${oshiId}`)
  }

  async function handleToggleFavorite() {
    if (isNew) { setFavorite(!favorite); return }
    if (!note) return
    await toggleFavorite(note.id)
    setFavorite(!favorite)
  }

  function handleAddTag(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault()
      const newTag = tagInput.trim()
      if (!tags.includes(newTag)) setTags([...tags, newTag])
      setTagInput('')
    }
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag))
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [oshiId, title, tags, note, isNew])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={32} className="animate-spin text-accent" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border-color bg-bg-secondary/30 flex items-center gap-4 shrink-0">
        <Link to={`/oshis/${oshiId}`} className="text-text-muted hover:text-text-primary transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <input
          placeholder="Note title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 bg-transparent text-xl font-semibold text-text-primary placeholder:text-text-muted focus:outline-none"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleFavorite}
            className={`p-2 rounded-lg transition-colors ${
              favorite ? 'text-yellow-500 bg-yellow-50' : 'text-text-muted hover:bg-bg-tertiary'
            }`}
            title="Favorite"
          >
            <Star size={18} fill={favorite ? 'currentColor' : 'none'} />
          </button>
          {!isNew && (
            <button
              onClick={handleDelete}
              className="p-2 rounded-lg hover:bg-red-50 text-text-muted hover:text-red-500 transition-colors"
              title="Delete"
            >
              <Trash2 size={18} />
            </button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Tags row */}
      <div className="px-4 py-2 border-b border-border-color bg-bg-secondary/10 flex items-center gap-2 flex-wrap shrink-0">
        {tags.map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5 rounded-full text-xs bg-accent-soft text-accent flex items-center gap-1"
          >
            {tag}
            <button onClick={() => removeTag(tag)} className="hover:text-red-500">&times;</button>
          </span>
        ))}
        <input
          placeholder="Add tag..."
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={handleAddTag}
          className="px-2 py-1 text-xs bg-transparent text-text-secondary placeholder:text-text-muted focus:outline-none border border-dashed border-border-color rounded-full w-20"
        />
        {isDirty && <span className="text-xs text-text-muted ml-auto">Unsaved</span>}
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <textarea
          className="w-full h-full bg-transparent text-text-primary placeholder:text-text-muted focus:outline-none resize-none p-4 text-base leading-relaxed"
          placeholder="Write your thoughts about your oshi..."
          onChange={(e) => editorRef.current = { json: {}, text: e.target.value }}
        />
      </div>
    </div>
  )
}
