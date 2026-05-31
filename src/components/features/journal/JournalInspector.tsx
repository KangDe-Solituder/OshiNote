import { Link } from 'react-router-dom'
import { useRef, useState } from 'react'
import { ArrowUp, Edit3, ExternalLink, Heart, Minus, Plus, RotateCcw, Save, Trash2, X } from 'lucide-react'
import { Button } from '../../ui/Button'
import { TipTapEditor } from '../../editor/TipTapEditor'
import type { JournalItemWithNote, JournalStickerStyle, UpdateNoteInput } from '../../../types'
import { clampLayout, getNextZIndex } from '../../../features/journal/journalLayout'

interface JournalInspectorProps {
  oshiId: string
  selectedItem: JournalItemWithNote | null
  items: JournalItemWithNote[]
  variant?: 'side' | 'popover'
  onUpdateLayout: (item: JournalItemWithNote, layout: {
    x: number
    y: number
    width: number
    height: number
    rotation: number
    z_index?: number
  }) => void
  onUpdateStyle: (itemId: string, style: {
    sticker_style?: JournalStickerStyle
    color?: string | null
    border_style?: string | null
  }) => void
  onRemove: (itemId: string) => void
  onToggleFavorite: (noteId: string) => void
  onUpdateNote: (noteId: string, input: UpdateNoteInput) => Promise<void>
}

const COLORS = ['#fff1f5', '#eef6ff', '#fff7d6', '#f3f0ff', '#edf7ed', '#fffdf8']
const STYLES: { id: JournalStickerStyle; label: string }[] = [
  { id: 'sticky', label: 'Sticky' },
  { id: 'memo', label: 'Memo' },
  { id: 'ticket', label: 'Ticket' },
]

export function JournalInspector({
  oshiId,
  selectedItem,
  items,
  onUpdateLayout,
  onUpdateStyle,
  onRemove,
  onToggleFavorite,
  onUpdateNote,
  variant = 'side',
}: JournalInspectorProps) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const editorRef = useRef<{ json: object; text: string }>({ json: createEmptyDoc(), text: '' })

  if (!selectedItem) {
    if (variant === 'popover') return null
    return (
      <aside className="w-72 shrink-0 border-l border-border-color bg-bg-secondary/20 p-4">
        <h3 className="text-sm font-semibold text-text-primary">Journal Page</h3>
        <p className="mt-2 text-xs leading-relaxed text-text-muted">No sticker selected</p>
      </aside>
    )
  }

  const editing = editingItemId === selectedItem.id

  async function handleSaveNote() {
    if (!selectedItem) return
    setSaving(true)
    try {
      const { json, text } = editorRef.current
      await onUpdateNote(selectedItem.note.id, {
        title: title || 'Untitled',
        content: JSON.stringify(json),
        plain_text: text,
      })
      setEditingItemId(null)
    } finally {
      setSaving(false)
    }
  }

  function handleStartEditing() {
    if (!selectedItem) return
    setTitle(selectedItem.note.title)
    editorRef.current = {
      json: parseNoteContent(selectedItem.note.content),
      text: selectedItem.note.plain_text,
    }
    setEditingItemId(selectedItem.id)
  }

  function patchLayout(change: Partial<Pick<JournalItemWithNote, 'width' | 'height' | 'rotation'>>) {
    if (!selectedItem) return
    onUpdateLayout(selectedItem, clampLayout({
      x: selectedItem.x,
      y: selectedItem.y,
      width: change.width ?? selectedItem.width,
      height: change.height ?? selectedItem.height,
      rotation: change.rotation ?? selectedItem.rotation,
    }))
  }

  return (
    <aside className={variant === 'popover'
      ? 'max-h-[560px] w-80 overflow-y-auto rounded-2xl border border-border-color bg-bg-primary p-4 shadow-xl'
      : 'w-72 shrink-0 overflow-y-auto border-l border-border-color bg-bg-secondary/20 p-4'}
    >
      <div className="mb-4">
        <p className="text-xs uppercase tracking-wide text-text-muted">Selected sticker</p>
        <h3 className="mt-1 line-clamp-2 text-base font-semibold text-text-primary">
          {selectedItem.note.title || 'Untitled'}
        </h3>
        <p className="mt-2 line-clamp-4 text-xs leading-relaxed text-text-secondary">
          {selectedItem.note.plain_text || 'No content yet'}
        </p>
      </div>

      <div className="mb-5 flex gap-2">
        <button
          type="button"
          onClick={() => onToggleFavorite(selectedItem.note.id)}
          className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
            selectedItem.note.favorite
              ? 'border-pink-200 bg-pink-50 text-pink-500'
              : 'border-border-color bg-bg-primary text-text-muted hover:text-pink-500'
          }`}
          title="Favorite"
        >
          <Heart size={16} fill={selectedItem.note.favorite ? 'currentColor' : 'none'} />
        </button>
        <Link to={`/oshis/${oshiId}/notes/${selectedItem.note.id}`} className="flex-1">
          <Button variant="secondary" size="sm" className="w-full">
            <ExternalLink size={15} />
            Full editor
          </Button>
        </Link>
      </div>

      <section className="mb-5">
        {editing ? (
          <div className="overflow-hidden rounded-xl border border-border-color bg-bg-primary">
            <div className="flex items-center gap-2 border-b border-border-color p-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-text-primary focus:outline-none"
                placeholder="Note title..."
              />
              <button
                type="button"
                onClick={() => setEditingItemId(null)}
                className="rounded-md p-1 text-text-muted hover:bg-bg-tertiary hover:text-text-primary"
                title="Cancel"
              >
                <X size={15} />
              </button>
            </div>
            <div className="h-72 overflow-hidden">
              <TipTapEditor
                key={selectedItem.note.id}
                content={parseNoteContent(selectedItem.note.content)}
                onUpdate={(json, textValue) => {
                  editorRef.current = { json, text: textValue }
                }}
              />
            </div>
            <div className="border-t border-border-color p-2">
              <Button size="sm" className="w-full" onClick={handleSaveNote} disabled={saving}>
                <Save size={15} />
                {saving ? 'Saving...' : 'Save note'}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" size="sm" className="w-full" onClick={handleStartEditing}>
            <Edit3 size={15} />
            Edit on page
          </Button>
        )}
      </section>

      <section className="mb-5">
        <h4 className="mb-2 text-xs font-semibold text-text-muted">Style</h4>
        <div className="grid grid-cols-3 gap-1">
          {STYLES.map((style) => (
            <button
              key={style.id}
              type="button"
              onClick={() => onUpdateStyle(selectedItem.id, { sticker_style: style.id })}
              className={`rounded-lg border px-2 py-1.5 text-xs transition-colors ${
                selectedItem.sticker_style === style.id
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-border-color bg-bg-primary text-text-secondary hover:border-border-hover'
              }`}
            >
              {style.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-5">
        <h4 className="mb-2 text-xs font-semibold text-text-muted">Color</h4>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onUpdateStyle(selectedItem.id, { color })}
              className="h-7 w-7 rounded-full border border-border-color shadow-sm transition-transform hover:scale-105"
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
      </section>

      <section className="mb-5">
        <h4 className="mb-2 text-xs font-semibold text-text-muted">Size</h4>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" size="sm" onClick={() => patchLayout({ width: selectedItem.width - 24 })}>
            <Minus size={14} />
            Width
          </Button>
          <Button variant="secondary" size="sm" onClick={() => patchLayout({ width: selectedItem.width + 24 })}>
            <Plus size={14} />
            Width
          </Button>
          <Button variant="secondary" size="sm" onClick={() => patchLayout({ height: selectedItem.height - 18 })}>
            <Minus size={14} />
            Height
          </Button>
          <Button variant="secondary" size="sm" onClick={() => patchLayout({ height: selectedItem.height + 18 })}>
            <Plus size={14} />
            Height
          </Button>
        </div>
      </section>

      <section className="mb-5">
        <h4 className="mb-2 text-xs font-semibold text-text-muted">Rotation</h4>
        <div className="grid grid-cols-3 gap-2">
          <Button variant="secondary" size="sm" onClick={() => patchLayout({ rotation: selectedItem.rotation - 3 })}>-3</Button>
          <Button variant="secondary" size="sm" onClick={() => patchLayout({ rotation: 0 })}>
            <RotateCcw size={14} />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => patchLayout({ rotation: selectedItem.rotation + 3 })}>+3</Button>
        </div>
      </section>

      <section className="mb-5">
        <h4 className="mb-2 text-xs font-semibold text-text-muted">Layer</h4>
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={() => onUpdateLayout(selectedItem, {
            x: selectedItem.x,
            y: selectedItem.y,
            width: selectedItem.width,
            height: selectedItem.height,
            rotation: selectedItem.rotation,
            z_index: getNextZIndex(items),
          })}
        >
          <ArrowUp size={14} />
          Bring forward
        </Button>
      </section>

      <Button variant="ghost" size="sm" className="w-full text-red-500" onClick={() => onRemove(selectedItem.id)}>
        <Trash2 size={15} />
        Remove from page
      </Button>
    </aside>
  )
}

function createEmptyDoc(): object {
  return { type: 'doc', content: [{ type: 'paragraph' }] }
}

function parseNoteContent(content: string): object {
  try {
    const parsed = JSON.parse(content)
    if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) return parsed
  } catch {
    // Keep the inline editor usable even if an older note has invalid rich text JSON.
  }
  return createEmptyDoc()
}
