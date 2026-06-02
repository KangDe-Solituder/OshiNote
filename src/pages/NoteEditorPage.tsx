import { useEffect, useState, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, CalendarClock, FolderOpen, ImagePlus, Save, Trash2, Star, Loader2, UserRound, X } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { useNoteStore } from '../stores/noteStore'
import { useEditorStore } from '../stores/editorStore'
import { fetchNoteById, fetchNoteImages, replaceNoteImages } from '../features/notes/noteService'
import { fetchArchivesByOshi } from '../features/oshis/archiveService'
import { fetchAllOshis } from '../features/oshis/oshiService'
import { TipTapEditor } from '../components/editor/TipTapEditor'
import type { Archive, Note, Oshi } from '../types'

export function NoteEditorPage() {
  const { oshiId, noteId } = useParams<{ oshiId: string; noteId: string }>()
  const navigate = useNavigate()
  const isNew = !noteId || noteId === 'new'

  const [title, setTitle] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [note, setNote] = useState<Note | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [favorite, setFavorite] = useState(false)
  const [selectedOshiId, setSelectedOshiId] = useState(oshiId || '')
  const [archiveId, setArchiveId] = useState('')
  const [archives, setArchives] = useState<Archive[]>([])
  const [oshis, setOshis] = useState<Oshi[]>([])
  const [createdAt, setCreatedAt] = useState(toDateTimeLocalValue(new Date()))
  const [editorContent, setEditorContent] = useState<object | undefined>(undefined)
  const [images, setImages] = useState<string[]>([])
  const [imageError, setImageError] = useState('')

  const editorRef = useRef<{ json: object; text: string }>({ json: createEmptyDoc(), text: '' })
  const imageInputRef = useRef<HTMLInputElement>(null)
  const { createNote, updateNote, deleteNote, toggleFavorite } = useNoteStore()
  const isDirty = useEditorStore((s) => s.isDirty)
  const markSaved = useEditorStore((s) => s.markSaved)
  const markDirty = useEditorStore((s) => s.markDirty)

  useEffect(() => {
    fetchAllOshis().then(setOshis).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedOshiId) return
    fetchArchivesByOshi(selectedOshiId).then(setArchives).catch(() => setArchives([]))
  }, [selectedOshiId])

  useEffect(() => {
    if (isNew) {
      return
    }
    if (!noteId) return
    Promise.all([fetchNoteById(noteId), fetchNoteImages(noteId)]).then(([n, savedImages]) => {
      if (n) {
        const parsedContent = parseNoteContent(n.content)
        setNote(n)
        setTitle(n.title)
        setTags(n.tags)
        setFavorite(n.favorite)
        setSelectedOshiId(n.oshi_id || '')
        setArchiveId(n.archive_id || '')
        setCreatedAt(toDateTimeLocalValue(n.created_at))
        setEditorContent(parsedContent)
        editorRef.current = { json: parsedContent, text: n.plain_text }
        setImages(savedImages.map((image) => image.data_url))
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [noteId, isNew])

  async function handleSave() {
    setSaving(true)
    try {
      const { json, text } = editorRef.current
      const noteDate = fromDateTimeLocalValue(createdAt)

      if (isNew) {
        const newNote = await createNote({
          oshi_id: selectedOshiId || null,
          archive_id: archiveId || null,
          title: title || 'Untitled',
          content: JSON.stringify(json),
          plain_text: text,
          tags,
          created_at: noteDate,
        })
        await replaceNoteImages(newNote.id, images)
        markSaved()
        navigate(`/notes/${newNote.id}`, { replace: true })
      } else if (note) {
        await updateNote(note.id, {
          title: title || 'Untitled',
          content: JSON.stringify(json),
          plain_text: text,
          tags,
          oshi_id: selectedOshiId || null,
          archive_id: archiveId || null,
          created_at: noteDate,
        })
        await replaceNoteImages(note.id, images)
        markSaved()
        setNote({ ...note, title, content: JSON.stringify(json), plain_text: text, tags, oshi_id: selectedOshiId || null, archive_id: archiveId || null, created_at: noteDate })
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!note) return
    if (!confirm('Delete this note?')) return
    await deleteNote(note.id)
    navigate(oshiId ? `/oshis/${oshiId}` : '/notes')
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

  async function handleAddImages(files: FileList | null) {
    if (!files) return
    setImageError('')
    const availableSlots = MAX_NOTE_IMAGES - images.length
    const selectedFiles = Array.from(files).slice(0, availableSlots)
    if (selectedFiles.length < files.length) {
      setImageError(`A note can contain up to ${MAX_NOTE_IMAGES} images.`)
    }

    const validFiles = selectedFiles.filter((file) => {
      if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
        setImageError('Only JPEG, PNG, and WebP images are supported.')
        return false
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setImageError('Each image must be 5 MB or smaller.')
        return false
      }
      return true
    })

    const dataUrls = await Promise.all(validFiles.map(readFileAsDataUrl))
    if (dataUrls.length > 0) {
      setImages((current) => [...current, ...dataUrls])
      markDirty()
    }
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  function removeImage(index: number) {
    setImages((current) => current.filter((_, imageIndex) => imageIndex !== index))
    markDirty()
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oshiId, title, tags, note, isNew, selectedOshiId, archiveId, createdAt, images])

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
        <Link to={oshiId ? `/oshis/${oshiId}` : '/notes'} className="text-text-muted hover:text-text-primary transition-colors">
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
        <label className="inline-flex items-center gap-1.5 text-xs text-text-muted">
          <UserRound size={14} />
          <select
            value={selectedOshiId}
            onChange={(e) => {
              setSelectedOshiId(e.target.value)
              setArchiveId('')
            }}
            className="px-2 py-1 rounded-lg border border-border-color bg-bg-secondary text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-soft"
          >
            <option value="">No Oshi</option>
            {oshis.map((oshi) => (
              <option key={oshi.id} value={oshi.id}>{oshi.name}</option>
            ))}
          </select>
        </label>
        <label className="inline-flex items-center gap-1.5 text-xs text-text-muted">
          <FolderOpen size={14} />
          <select
            value={archiveId}
            onChange={(e) => setArchiveId(e.target.value)}
            disabled={!selectedOshiId}
            className="px-2 py-1 rounded-lg border border-border-color bg-bg-secondary text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-soft"
          >
            <option value="">Unfiled</option>
            {(selectedOshiId ? archives : []).map((archive) => (
              <option key={archive.id} value={archive.id}>{archive.name}</option>
            ))}
          </select>
        </label>
        <label className="inline-flex items-center gap-1.5 text-xs text-text-muted">
          <CalendarClock size={14} />
          <input
            type="datetime-local"
            value={createdAt}
            onChange={(e) => setCreatedAt(e.target.value)}
            className="px-2 py-1 rounded-lg border border-border-color bg-bg-secondary text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-soft"
          />
        </label>
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
      <div className="shrink-0 border-b border-border-color bg-bg-secondary/10 px-4 py-2">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="flex h-16 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border-color text-xs text-text-muted transition-colors hover:border-accent hover:text-accent"
          >
            <ImagePlus size={18} />
            Add image
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(event) => handleAddImages(event.target.files)}
          />
          {images.map((image, index) => (
            <div key={`${image.slice(0, 48)}-${index}`} className="group relative h-16 w-20 shrink-0 overflow-hidden rounded-lg border border-border-color bg-bg-tertiary">
              <img src={image} alt={`Note attachment ${index + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="absolute right-1 top-1 rounded-full bg-black/55 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                title="Remove image"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
        {imageError && <p className="mt-1 text-xs text-red-500">{imageError}</p>}
      </div>

      <div className="flex-1 overflow-hidden">
        <TipTapEditor
          key={isNew ? 'new' : note?.id}
          content={editorContent}
          onUpdate={(json, text) => {
            editorRef.current = { json, text }
          }}
        />
      </div>
    </div>
  )
}

const MAX_NOTE_IMAGES = 12
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function createEmptyDoc(): object {
  return { type: 'doc', content: [{ type: 'paragraph' }] }
}

function parseNoteContent(content: string): object {
  try {
    const parsed = JSON.parse(content)
    if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) return parsed
  } catch {
    // Old drafts may have invalid content; keep a blank editor instead.
  }
  return createEmptyDoc()
}

function toDateTimeLocalValue(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return toDateTimeLocalValue(new Date())
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromDateTimeLocalValue(value: string): string {
  if (!value) return fromDateTimeLocalValue(toDateTimeLocalValue(new Date()))
  const [date, time = '00:00'] = value.split('T')
  return `${date} ${time.length === 5 ? `${time}:00` : time}`
}
