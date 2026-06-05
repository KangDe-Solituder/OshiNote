import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { invoke } from '@tauri-apps/api/core'
import {
  ArrowLeft,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Check,
  ExternalLink,
  FolderOpen,
  ImagePlus,
  Link2,
  Loader2,
  Plus,
  Save,
  Star,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { TipTapEditor } from '../components/editor/TipTapEditor'
import { PAGE_CONTENT_CLASS, PAGE_HEADER_CLASS } from '../components/layout/pageShell'
import { useEditorStore } from '../stores/editorStore'
import { useNoteStore } from '../stores/noteStore'
import { fetchNoteById, fetchNoteImages, replaceNoteImages } from '../features/notes/noteService'
import { createArchive as createArchiveRecord, fetchArchivesByOshi } from '../features/oshis/archiveService'
import { fetchAllOshis } from '../features/oshis/oshiService'
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
  const [showAddArchive, setShowAddArchive] = useState(false)
  const [newArchiveName, setNewArchiveName] = useState('')
  const [archiveError, setArchiveError] = useState('')
  const [oshis, setOshis] = useState<Oshi[]>([])
  const [createdAt, setCreatedAt] = useState(toDateTimeLocalValue(new Date()))
  const [sourceUrl, setSourceUrl] = useState('')
  const [editorContent, setEditorContent] = useState<object | undefined>(undefined)
  const [images, setImages] = useState<string[]>([])
  const [imageError, setImageError] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(false)

  const editorRef = useRef<{ json: object; text: string }>({ json: createEmptyDoc(), text: '' })
  const imageInputRef = useRef<HTMLInputElement>(null)
  const { createNote, updateNote, deleteNote, toggleFavorite } = useNoteStore()
  const isDirty = useEditorStore((s) => s.isDirty)
  const markSaved = useEditorStore((s) => s.markSaved)
  const markDirty = useEditorStore((s) => s.markDirty)

  const selectedOshi = oshis.find((oshi) => oshi.id === selectedOshiId)
  const selectedArchive = archives.find((archive) => archive.id === archiveId)
  const openedUrl = normalizeWebUrl(sourceUrl)

  useEffect(() => {
    fetchAllOshis().then(setOshis).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedOshiId) {
      setArchives([])
      return
    }
    fetchArchivesByOshi(selectedOshiId).then(setArchives).catch(() => setArchives([]))
  }, [selectedOshiId])

  useEffect(() => {
    if (isNew) {
      markSaved()
      setLoading(false)
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
        setSourceUrl(n.source_url || '')
        setEditorContent(parsedContent)
        editorRef.current = { json: parsedContent, text: n.plain_text }
        setImages(savedImages.map((image) => image.data_url))
      }
      markSaved()
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [noteId, isNew, markSaved])

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
          source_url: sourceUrl.trim(),
          tags,
          created_at: noteDate,
        })
        await replaceNoteImages(newNote.id, images)
        markSaved()
        navigate(selectedOshiId ? `/oshis/${selectedOshiId}/notes/${newNote.id}` : `/notes/${newNote.id}`, { replace: true })
      } else if (note) {
        await updateNote(note.id, {
          title: title || 'Untitled',
          content: JSON.stringify(json),
          plain_text: text,
          source_url: sourceUrl.trim(),
          tags,
          oshi_id: selectedOshiId || null,
          archive_id: archiveId || null,
          created_at: noteDate,
        })
        await replaceNoteImages(note.id, images)
        markSaved()
        setNote({
          ...note,
          title,
          content: JSON.stringify(json),
          plain_text: text,
          source_url: sourceUrl.trim(),
          tags,
          oshi_id: selectedOshiId || null,
          archive_id: archiveId || null,
          created_at: noteDate,
        })
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!note) return
    if (!confirm('Delete this note?')) return
    await deleteNote(note.id)
    navigate(oshiId ? `/oshis/${oshiId}/notes` : '/notes')
  }

  async function handleToggleFavorite() {
    if (isNew) {
      setFavorite(!favorite)
      markDirty()
      return
    }
    if (!note) return
    await toggleFavorite(note.id)
    setFavorite(!favorite)
  }

  async function handleCreateArchive(event?: React.FormEvent) {
    event?.preventDefault()
    if (!selectedOshiId) {
      setArchiveError('Select an oshi first.')
      return
    }
    const name = newArchiveName.trim()
    if (!name) return

    setArchiveError('')
    const archive = await createArchiveRecord(selectedOshiId, name)
    setArchives((current) => [...current, archive])
    setArchiveId(archive.id)
    setNewArchiveName('')
    setShowAddArchive(false)
    markDirty()
  }

  async function handleOpenSourceUrl() {
    if (!openedUrl) return
    try {
      await invoke('open_external_url', { url: openedUrl })
    } catch {
      window.open(openedUrl, '_blank', 'noopener,noreferrer')
    }
  }

  function handleAddTag(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault()
      const newTag = tagInput.trim()
      if (!tags.includes(newTag)) {
        setTags([...tags, newTag])
        markDirty()
      }
      setTagInput('')
    }
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag))
    markDirty()
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

  function updateOshi(value: string) {
    setSelectedOshiId(value)
    setArchiveId('')
    setShowAddArchive(false)
    setArchiveError('')
    markDirty()
  }

  function updateArchive(value: string) {
    setArchiveId(value)
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
  }, [oshiId, title, tags, note, isNew, selectedOshiId, archiveId, createdAt, sourceUrl, images])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={32} className="animate-spin text-accent" />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg-primary">
      <header className={`${PAGE_HEADER_CLASS} gap-4`}>
        <Link
          to={oshiId ? `/oshis/${oshiId}/notes` : '/notes'}
          className="rounded-lg p-2 text-text-muted transition-colors hover:bg-bg-secondary hover:text-text-primary"
          title="Back"
        >
          <ArrowLeft size={22} />
        </Link>

        <div className="min-w-0 flex-1">
          <input
            placeholder="Note title..."
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              markDirty()
            }}
            className="w-full bg-transparent text-3xl font-bold leading-tight text-text-primary placeholder:text-text-muted focus:outline-none"
          />
        </div>

        {isDirty && <span className="hidden text-xs text-text-muted sm:inline">Unsaved</span>}
        <button
          onClick={handleToggleFavorite}
          className={`rounded-xl p-2.5 transition-colors ${
            favorite ? 'bg-yellow-500/15 text-yellow-400' : 'text-text-muted hover:bg-bg-secondary hover:text-text-primary'
          }`}
          title="Favorite"
        >
          <Star size={20} fill={favorite ? 'currentColor' : 'none'} />
        </button>
        {!isNew && (
          <button
            onClick={handleDelete}
            className="rounded-xl p-2.5 text-text-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
            title="Delete"
          >
            <Trash2 size={20} />
          </button>
        )}
        <Button onClick={handleSave} disabled={saving} className="rounded-2xl px-5">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </header>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <main className={`min-w-0 ${PAGE_CONTENT_CLASS} transition-[padding] duration-300 ease-out`}>
          <div className="mx-auto max-w-5xl">
            {images.length > 0 && (
              <section className="mb-7 overflow-hidden rounded-2xl border border-border-color bg-bg-secondary/25">
                <div className="relative aspect-[16/6] min-h-52 overflow-hidden bg-bg-tertiary">
                  <img src={images[0]} alt="Note visual lead" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-xl border border-white/30 bg-black/45 px-3 py-2 text-sm text-white backdrop-blur transition-colors hover:bg-black/60"
                  >
                    <ImagePlus size={16} />
                    Add image
                  </button>
                </div>
              </section>
            )}

            <section className="overflow-hidden rounded-2xl border border-border-color bg-bg-primary/70 shadow-sm shadow-black/5">
              <div className="h-[calc(100vh-184px)] min-h-[560px]">
                <TipTapEditor
                  key={isNew ? 'new' : note?.id}
                  content={editorContent}
                  afterToolbar={(
                    <div className="border-b border-border-color bg-bg-secondary/10 px-4 py-3">
                      <MetaSummary
                        createdAt={createdAt}
                        oshiName={selectedOshi?.name || 'No Oshi'}
                        archiveName={selectedArchive?.name || 'Unfiled'}
                        sourceUrl={sourceUrl}
                        hasSourceUrl={Boolean(openedUrl)}
                      />
                    </div>
                  )}
                  onUpdate={(json, text) => {
                    editorRef.current = { json, text }
                  }}
                />
              </div>
            </section>
          </div>
        </main>

        <aside
          className={`relative min-h-0 shrink-0 border-l border-border-color bg-bg-secondary/20 transition-[width] duration-300 ease-out ${
            detailsOpen ? 'w-[360px]' : 'w-0'
          }`}
        >
          <button
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
            className="absolute left-0 top-7 z-20 flex h-11 w-8 -translate-x-full items-center justify-center rounded-l-2xl border border-r-0 border-border-color bg-bg-primary text-text-muted shadow-sm transition-colors hover:text-accent"
            title={detailsOpen ? 'Hide details' : 'Show details'}
            aria-label={detailsOpen ? 'Hide details' : 'Show details'}
          >
            {detailsOpen ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>

          <div className="h-full w-[360px] overflow-y-auto p-7">
            <div className="space-y-4">
              <DetailsPanel
                selectedOshiId={selectedOshiId}
                archiveId={archiveId}
                createdAt={createdAt}
                sourceUrl={sourceUrl}
                oshis={oshis}
                archives={archives}
                openedUrl={openedUrl}
                showAddArchive={showAddArchive}
                newArchiveName={newArchiveName}
                archiveError={archiveError}
                onOshiChange={updateOshi}
                onArchiveChange={updateArchive}
                onCreatedAtChange={(value) => {
                  setCreatedAt(value)
                  markDirty()
                }}
                onSourceUrlChange={(value) => {
                  setSourceUrl(value)
                  markDirty()
                }}
                onOpenSourceUrl={handleOpenSourceUrl}
                onShowAddArchive={() => setShowAddArchive(true)}
                onNewArchiveNameChange={(value) => {
                  setNewArchiveName(value)
                  setArchiveError('')
                }}
                onCreateArchive={handleCreateArchive}
                onCancelCreateArchive={() => {
                  setShowAddArchive(false)
                  setNewArchiveName('')
                  setArchiveError('')
                }}
              />

              <TagsPanel
                tags={tags}
                tagInput={tagInput}
                onTagInputChange={setTagInput}
                onAddTag={handleAddTag}
                onRemoveTag={removeTag}
              />

              <AttachmentsPanel
                images={images}
                imageError={imageError}
                imageInputRef={imageInputRef}
                onAddImages={handleAddImages}
                onRemoveImage={removeImage}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

interface MetaSummaryProps {
  createdAt: string
  oshiName: string
  archiveName: string
  sourceUrl: string
  hasSourceUrl: boolean
}

function MetaSummary({ createdAt, oshiName, archiveName, sourceUrl, hasSourceUrl }: MetaSummaryProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
      <MetaChip icon={<CalendarClock size={15} />} label={formatDateTimeChip(createdAt)} />
      <MetaChip icon={<FolderOpen size={15} />} label={archiveName} />
      <MetaChip icon={<UserRound size={15} />} label={oshiName} />
      {sourceUrl && <MetaChip icon={<Link2 size={15} />} label={hasSourceUrl ? formatUrlHost(sourceUrl) : 'Invalid URL'} />}
    </div>
  )
}

function MetaChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-border-color bg-bg-secondary/50 px-3 py-1.5 text-text-secondary">
      <span className="shrink-0 text-text-muted">{icon}</span>
      <span className="truncate">{label}</span>
    </span>
  )
}

interface DetailsPanelProps {
  selectedOshiId: string
  archiveId: string
  createdAt: string
  sourceUrl: string
  oshis: Oshi[]
  archives: Archive[]
  openedUrl: string | null
  showAddArchive: boolean
  newArchiveName: string
  archiveError: string
  onOshiChange: (value: string) => void
  onArchiveChange: (value: string) => void
  onCreatedAtChange: (value: string) => void
  onSourceUrlChange: (value: string) => void
  onOpenSourceUrl: () => void
  onShowAddArchive: () => void
  onNewArchiveNameChange: (value: string) => void
  onCreateArchive: (event?: React.FormEvent) => void
  onCancelCreateArchive: () => void
}

function DetailsPanel(props: DetailsPanelProps) {
  return (
    <Panel title="Details">
      <FieldLabel icon={<UserRound size={15} />} label="Oshi">
        <select
          value={props.selectedOshiId}
          onChange={(e) => props.onOshiChange(e.target.value)}
          className={fieldClassName}
        >
          <option value="">No Oshi</option>
          {props.oshis.map((oshi) => (
            <option key={oshi.id} value={oshi.id}>{oshi.name}</option>
          ))}
        </select>
      </FieldLabel>

      <FieldLabel icon={<FolderOpen size={15} />} label="Archive">
        <div className="flex gap-2">
          <select
            value={props.archiveId}
            onChange={(e) => props.onArchiveChange(e.target.value)}
            disabled={!props.selectedOshiId}
            className={fieldClassName}
          >
            <option value="">Unfiled</option>
            {props.archives.map((archive) => (
              <option key={archive.id} value={archive.id}>{archive.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={props.onShowAddArchive}
            disabled={!props.selectedOshiId}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border-color text-text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
            title="Add archive"
          >
            <Plus size={16} />
          </button>
        </div>
      </FieldLabel>

      {props.showAddArchive && (
        <form onSubmit={props.onCreateArchive} className="flex gap-2">
          <input
            value={props.newArchiveName}
            onChange={(e) => props.onNewArchiveNameChange(e.target.value)}
            placeholder="New archive..."
            autoFocus
            className={fieldClassName}
          />
          <button type="submit" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border-color text-text-muted hover:text-accent" title="Create archive">
            <Check size={16} />
          </button>
          <button type="button" onClick={props.onCancelCreateArchive} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border-color text-text-muted hover:text-text-primary" title="Cancel">
            <X size={16} />
          </button>
        </form>
      )}
      {props.archiveError && <p className="-mt-1 text-xs text-red-400">{props.archiveError}</p>}

      <FieldLabel icon={<CalendarClock size={15} />} label="Date">
        <input
          type="datetime-local"
          value={props.createdAt}
          onChange={(e) => props.onCreatedAtChange(e.target.value)}
          className={fieldClassName}
        />
      </FieldLabel>

      <FieldLabel icon={<Link2 size={15} />} label="Stream URL">
        <div className="flex gap-2">
          <input
            type="url"
            value={props.sourceUrl}
            onChange={(e) => props.onSourceUrlChange(e.target.value)}
            placeholder="Stream URL..."
            className={fieldClassName}
          />
          <button
            type="button"
            onClick={props.onOpenSourceUrl}
            disabled={!props.openedUrl}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border-color text-text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
            title="Open stream URL"
          >
            <ExternalLink size={16} />
          </button>
        </div>
      </FieldLabel>
    </Panel>
  )
}

interface TagsPanelProps {
  tags: string[]
  tagInput: string
  onTagInputChange: (value: string) => void
  onAddTag: (event: React.KeyboardEvent) => void
  onRemoveTag: (tag: string) => void
}

function TagsPanel({ tags, tagInput, onTagInputChange, onAddTag, onRemoveTag }: TagsPanelProps) {
  return (
    <Panel title="Tags">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span key={tag} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs text-accent">
            <span className="truncate">{tag}</span>
            <button type="button" onClick={() => onRemoveTag(tag)} className="rounded-full p-0.5 hover:bg-accent/10" title={`Remove ${tag}`}>
              <X size={12} />
            </button>
          </span>
        ))}
        {tags.length === 0 && <p className="text-sm text-text-muted">No tags yet.</p>}
      </div>
      <input
        placeholder="Add tag and press Enter..."
        value={tagInput}
        onChange={(e) => onTagInputChange(e.target.value)}
        onKeyDown={onAddTag}
        className={`${fieldClassName} border-dashed`}
      />
    </Panel>
  )
}

interface AttachmentsPanelProps {
  images: string[]
  imageError: string
  imageInputRef: React.RefObject<HTMLInputElement | null>
  onAddImages: (files: FileList | null) => void
  onRemoveImage: (index: number) => void
}

function AttachmentsPanel({ images, imageError, imageInputRef, onAddImages, onRemoveImage }: AttachmentsPanelProps) {
  return (
    <Panel title="Attachments">
      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(event) => onAddImages(event.target.files)}
      />
      <div className="grid grid-cols-3 gap-2">
        {images.map((image, index) => (
          <div key={`${image.slice(0, 48)}-${index}`} className="group relative aspect-square overflow-hidden rounded-xl border border-border-color bg-bg-tertiary">
            <img src={image} alt={`Note attachment ${index + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onRemoveImage(index)}
              className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
              title="Remove image"
            >
              <X size={13} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-color text-sm text-text-muted transition-colors hover:border-accent hover:text-accent"
        >
          <ImagePlus size={20} />
          Add
        </button>
      </div>
      {imageError && <p className="text-xs text-red-400">{imageError}</p>}
    </Panel>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border-color bg-bg-primary/75 p-4 shadow-sm shadow-black/5">
      <h2 className="mb-4 text-sm font-semibold text-text-primary">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function FieldLabel({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-text-muted">
      <span className="inline-flex items-center gap-2">
        {icon}
        {label}
      </span>
      {children}
    </label>
  )
}

const fieldClassName = 'min-w-0 flex-1 rounded-xl border border-border-color bg-bg-secondary px-3 py-2 text-sm text-text-secondary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-soft disabled:opacity-50'

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

function formatDateTimeChip(value: string): string {
  return value.replace('T', ' ')
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

function formatUrlHost(value: string): string {
  const url = normalizeWebUrl(value)
  if (!url) return value
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return value
  }
}
