import { Link } from 'react-router-dom'
import { useRef, useState } from 'react'
import { ArrowUp, Edit3, ExternalLink, Heart, Minus, Plus, RotateCcw, Save, Trash2, X } from 'lucide-react'
import { Button } from '../../ui/Button'
import { TipTapEditor } from '../../editor/TipTapEditor'
import type { JournalItemStyle, JournalItemWithNote, JournalPageOrientation, JournalStickerStyle, JournalTapeStyle, UpdateNoteInput } from '../../../types'
import { clampLayout, getNextZIndex } from '../../../features/journal/journalLayout'
import { useI18n } from '../../../i18n/useI18n'
import type { TranslationKey } from '../../../i18n/translations'
import { getJournalMaterialDefinition, parseMaterialStyle } from '../../../features/journal/journalMaterials'

interface JournalInspectorProps {
  oshiId: string
  selectedItem: JournalItemWithNote | null
  items: JournalItemWithNote[]
  variant?: 'side' | 'popover'
  orientation?: JournalPageOrientation
  onUpdateLayout: (item: JournalItemWithNote, layout: {
    x: number
    y: number
    width: number
    height: number
    rotation: number
    z_index?: number
  }) => void
  onUpdateStyle: (itemId: string, style: {
    sticker_style?: JournalItemStyle
    color?: string | null
    border_style?: string | null
    style_payload?: string
  }) => void
  onRemove: (itemId: string) => void
  onToggleFavorite: (noteId: string) => void
  onUpdateNote: (noteId: string, input: UpdateNoteInput) => Promise<void>
  onClose?: () => void
}

const COLORS = ['#fff1f5', '#eef6ff', '#fff7d6', '#f3f0ff', '#edf7ed', '#fffdf8']
const STYLES: { id: JournalStickerStyle; label: string }[] = [
  { id: 'sticky', label: 'Sticky' },
  { id: 'memo', label: 'Memo' },
  { id: 'ticket', label: 'Ticket' },
]
const TAPE_COLORS = ['#d9c4ff', '#f6b8d2', '#b8ddff', '#f8dfa0', '#b8ead8', '#f0c9ad']
const TAPE_STYLES: { id: JournalTapeStyle; labelKey: TranslationKey }[] = [
  { id: 'washi', labelKey: 'journalInspector.tape.washi' },
  { id: 'grid', labelKey: 'journalInspector.tape.grid' },
  { id: 'dots', labelKey: 'journalInspector.tape.dots' },
  { id: 'stripe', labelKey: 'journalInspector.tape.stripe' },
  { id: 'torn', labelKey: 'journalInspector.tape.torn' },
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
  onClose,
  variant = 'side',
  orientation = 'portrait',
}: JournalInspectorProps) {
  const { t } = useI18n()
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const editorRef = useRef<{ json: object; text: string }>({ json: createEmptyDoc(), text: '' })

  if (!selectedItem) {
    if (variant === 'popover') return null
    return (
      <aside className="w-full bg-bg-secondary/20 p-4">
        <h3 className="text-sm font-semibold text-text-primary">{t('journalInspector.page')}</h3>
        <p className="mt-2 text-xs leading-relaxed text-text-muted">{t('journalInspector.noSticker')}</p>
      </aside>
    )
  }

  const editing = editingItemId === selectedItem.id
  const activeItem = selectedItem

  function patchLayout(change: Partial<Pick<JournalItemWithNote, 'width' | 'height' | 'rotation'>>) {
    const activeMaterial = activeItem.item_type === 'material' ? getJournalMaterialDefinition(activeItem.material_id) : null
    onUpdateLayout(activeItem, clampLayout({
      x: activeItem.x,
      y: activeItem.y,
      width: change.width ?? activeItem.width,
      height: change.height ?? activeItem.height,
      rotation: change.rotation ?? activeItem.rotation,
    }, activeItem.item_type === 'tape' || activeMaterial?.kind === 'tape'
      ? { minWidth: 90, minHeight: 18 }
      : activeMaterial?.kind === 'sticker'
        ? { minWidth: 42, minHeight: 42 }
        : undefined,
      orientation))
  }

  if (selectedItem.item_type === 'illustration') {
    return (
      <aside className={variant === 'popover'
        ? 'max-h-[560px] w-80 overflow-y-auto rounded-2xl border border-border-color bg-bg-primary p-4 shadow-xl'
        : 'w-full overflow-y-auto bg-bg-secondary/20 p-4'}
      >
        <div className="mb-4">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wide text-text-muted">{t('journalInspector.selectedIllustration')}</p>
              <h3 className="mt-1 line-clamp-2 text-base font-semibold text-text-primary">
                {selectedItem.illustration?.title || t('journalInspector.untitled')}
              </h3>
            </div>
            {variant === 'popover' && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-text-muted hover:bg-bg-tertiary hover:text-text-primary"
                title="Close"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-text-secondary">
            {selectedItem.illustration?.artist ? t('common.byArtist', { artist: selectedItem.illustration.artist }) : t('journalInspector.unknownArtist')}
          </p>
        </div>

        <section className="mb-5">
          <h4 className="mb-2 text-xs font-semibold text-text-muted">{t('journalInspector.size')}</h4>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" size="sm" onClick={() => patchLayout({ width: selectedItem.width - 24 })}>
              <Minus size={14} />
              {t('journalInspector.width')}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => patchLayout({ width: selectedItem.width + 24 })}>
              <Plus size={14} />
              {t('journalInspector.width')}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => patchLayout({ height: selectedItem.height - 18 })}>
              <Minus size={14} />
              {t('journalInspector.height')}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => patchLayout({ height: selectedItem.height + 18 })}>
              <Plus size={14} />
              {t('journalInspector.height')}
            </Button>
          </div>
        </section>

        <section className="mb-5">
          <h4 className="mb-2 text-xs font-semibold text-text-muted">{t('journalInspector.rotation')}</h4>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="secondary" size="sm" onClick={() => patchLayout({ rotation: selectedItem.rotation - 3 })}>-3</Button>
            <Button variant="secondary" size="sm" onClick={() => patchLayout({ rotation: 0 })}>
              <RotateCcw size={14} />
            </Button>
            <Button variant="secondary" size="sm" onClick={() => patchLayout({ rotation: selectedItem.rotation + 3 })}>+3</Button>
          </div>
        </section>

        <section className="mb-5">
          <h4 className="mb-2 text-xs font-semibold text-text-muted">{t('journalInspector.layer')}</h4>
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
            {t('journalInspector.bringForward')}
          </Button>
        </section>

        <Button variant="ghost" size="sm" className="w-full text-red-500" onClick={() => onRemove(selectedItem.id)}>
          <Trash2 size={15} />
          {t('journalInspector.removeFromPage')}
        </Button>
      </aside>
    )
  }

  if (selectedItem.item_type === 'material') {
    const materialItem = selectedItem
    const material = getJournalMaterialDefinition(materialItem.material_id)
    const stylePayload = {
      ...(material?.defaultStyle || {}),
      ...parseMaterialStyle(materialItem.style_payload),
    }
    const materialColor = asString(stylePayload.color) || materialItem.color || '#d9c4ff'
    const isTapeMaterial = material?.kind === 'tape'

    function updateMaterialStyle(change: Record<string, unknown>) {
      const nextPayload = { ...stylePayload, ...change }
      onUpdateStyle(materialItem.id, {
        color: typeof nextPayload.color === 'string' ? nextPayload.color : materialItem.color,
        style_payload: JSON.stringify(nextPayload),
      })
    }

    return (
      <aside className={variant === 'popover'
        ? 'max-h-[560px] w-80 overflow-y-auto rounded-2xl border border-border-color bg-bg-primary p-4 shadow-xl'
        : 'w-full overflow-y-auto bg-bg-secondary/20 p-4'}
      >
        <div className="mb-4">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wide text-text-muted">{t('journalInspector.selectedMaterial')}</p>
              <h3 className="mt-1 text-base font-semibold text-text-primary">
                {material ? t(material.nameKey) : t('journalInspector.selectedMaterial')}
              </h3>
            </div>
            {variant === 'popover' && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-text-muted hover:bg-bg-tertiary hover:text-text-primary"
                title="Close"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {isTapeMaterial && (
          <section className="mb-5">
            <h4 className="mb-2 text-xs font-semibold text-text-muted">{t('journalInspector.tapeStyle')}</h4>
            <div className="grid grid-cols-2 gap-2">
              {TAPE_STYLES.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => updateMaterialStyle({ tapeStyle: style.id })}
                  className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                    stylePayload.tapeStyle === style.id
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-border-color bg-bg-primary text-text-secondary hover:border-border-hover'
                  }`}
                >
                  {t(style.labelKey)}
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="mb-5">
          <h4 className="mb-2 text-xs font-semibold text-text-muted">{t('journalInspector.color')}</h4>
          <div className="flex flex-wrap gap-2">
            {(isTapeMaterial ? TAPE_COLORS : COLORS).map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => updateMaterialStyle({ color })}
                className={`h-7 w-7 rounded-full border shadow-sm transition-transform hover:scale-105 ${
                  materialColor === color ? 'border-accent ring-2 ring-accent-soft' : 'border-border-color'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </section>

        <section className="mb-5">
          <h4 className="mb-2 text-xs font-semibold text-text-muted">{isTapeMaterial ? t('journalInspector.length') : t('journalInspector.size')}</h4>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" size="sm" onClick={() => patchLayout({ width: selectedItem.width - (isTapeMaterial ? 32 : 18) })}>
              <Minus size={14} />
              {isTapeMaterial ? t('journalInspector.length') : t('journalInspector.width')}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => patchLayout({ width: selectedItem.width + (isTapeMaterial ? 32 : 18) })}>
              <Plus size={14} />
              {isTapeMaterial ? t('journalInspector.length') : t('journalInspector.width')}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => patchLayout({ height: selectedItem.height - (isTapeMaterial ? 6 : 18) })}>
              <Minus size={14} />
              {isTapeMaterial ? t('journalInspector.thickness') : t('journalInspector.height')}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => patchLayout({ height: selectedItem.height + (isTapeMaterial ? 6 : 18) })}>
              <Plus size={14} />
              {isTapeMaterial ? t('journalInspector.thickness') : t('journalInspector.height')}
            </Button>
          </div>
        </section>

        <section className="mb-5">
          <h4 className="mb-2 text-xs font-semibold text-text-muted">{t('journalInspector.rotation')}</h4>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="secondary" size="sm" onClick={() => patchLayout({ rotation: selectedItem.rotation - 3 })}>-3</Button>
            <Button variant="secondary" size="sm" onClick={() => patchLayout({ rotation: 0 })}>
              <RotateCcw size={14} />
            </Button>
            <Button variant="secondary" size="sm" onClick={() => patchLayout({ rotation: selectedItem.rotation + 3 })}>+3</Button>
          </div>
        </section>

        <section className="mb-5">
          <h4 className="mb-2 text-xs font-semibold text-text-muted">{t('journalInspector.layer')}</h4>
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
            {t('journalInspector.bringForward')}
          </Button>
        </section>

        <Button variant="ghost" size="sm" className="w-full text-red-500" onClick={() => onRemove(selectedItem.id)}>
          <Trash2 size={15} />
          {t('journalInspector.removeFromPage')}
        </Button>
      </aside>
    )
  }

  if (selectedItem.item_type === 'tape') {
    return (
      <aside className={variant === 'popover'
        ? 'max-h-[560px] w-80 overflow-y-auto rounded-2xl border border-border-color bg-bg-primary p-4 shadow-xl'
        : 'w-full overflow-y-auto bg-bg-secondary/20 p-4'}
      >
        <div className="mb-4">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wide text-text-muted">{t('journalInspector.selectedTape')}</p>
              <h3 className="mt-1 text-base font-semibold text-text-primary">{t('journalEditor.addTape')}</h3>
            </div>
            {variant === 'popover' && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-text-muted hover:bg-bg-tertiary hover:text-text-primary"
                title="Close"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        <section className="mb-5">
          <h4 className="mb-2 text-xs font-semibold text-text-muted">{t('journalInspector.tapeStyle')}</h4>
          <div className="grid grid-cols-2 gap-2">
            {TAPE_STYLES.map((style) => (
              <button
                key={style.id}
                type="button"
                onClick={() => onUpdateStyle(selectedItem.id, { sticker_style: style.id })}
                className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                  selectedItem.sticker_style === style.id
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-border-color bg-bg-primary text-text-secondary hover:border-border-hover'
                }`}
              >
                {t(style.labelKey)}
              </button>
            ))}
          </div>
        </section>

        <section className="mb-5">
          <h4 className="mb-2 text-xs font-semibold text-text-muted">{t('journalInspector.color')}</h4>
          <div className="flex flex-wrap gap-2">
            {TAPE_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => onUpdateStyle(selectedItem.id, { color })}
                className={`h-7 w-7 rounded-full border shadow-sm transition-transform hover:scale-105 ${
                  selectedItem.color === color ? 'border-accent ring-2 ring-accent-soft' : 'border-border-color'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </section>

        <section className="mb-5">
          <h4 className="mb-2 text-xs font-semibold text-text-muted">{t('journalInspector.length')}</h4>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" size="sm" onClick={() => patchLayout({ width: selectedItem.width - 32 })}>
              <Minus size={14} />
              {t('journalInspector.length')}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => patchLayout({ width: selectedItem.width + 32 })}>
              <Plus size={14} />
              {t('journalInspector.length')}
            </Button>
          </div>
        </section>

        <section className="mb-5">
          <h4 className="mb-2 text-xs font-semibold text-text-muted">{t('journalInspector.thickness')}</h4>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" size="sm" onClick={() => patchLayout({ height: selectedItem.height - 6 })}>
              <Minus size={14} />
              {t('journalInspector.thickness')}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => patchLayout({ height: selectedItem.height + 6 })}>
              <Plus size={14} />
              {t('journalInspector.thickness')}
            </Button>
          </div>
        </section>

        <section className="mb-5">
          <h4 className="mb-2 text-xs font-semibold text-text-muted">{t('journalInspector.rotation')}</h4>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="secondary" size="sm" onClick={() => patchLayout({ rotation: selectedItem.rotation - 3 })}>-3</Button>
            <Button variant="secondary" size="sm" onClick={() => patchLayout({ rotation: 0 })}>
              <RotateCcw size={14} />
            </Button>
            <Button variant="secondary" size="sm" onClick={() => patchLayout({ rotation: selectedItem.rotation + 3 })}>+3</Button>
          </div>
        </section>

        <section className="mb-5">
          <h4 className="mb-2 text-xs font-semibold text-text-muted">{t('journalInspector.layer')}</h4>
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
            {t('journalInspector.bringForward')}
          </Button>
        </section>

        <Button variant="ghost" size="sm" className="w-full text-red-500" onClick={() => onRemove(selectedItem.id)}>
          <Trash2 size={15} />
          {t('journalInspector.removeFromPage')}
        </Button>
      </aside>
    )
  }

  const note = activeItem.note
  if (!note) return null
  const noteId = note.id
  const noteTitle = note.title
  const noteContent = note.content
  const notePlainText = note.plain_text
  const noteFavorite = note.favorite

  async function handleSaveNote() {
    setSaving(true)
    try {
      const { json, text } = editorRef.current
      await onUpdateNote(noteId, {
        title: title || t('common.untitled'),
        content: JSON.stringify(json),
        plain_text: text,
      })
      setEditingItemId(null)
    } finally {
      setSaving(false)
    }
  }

  function handleStartEditing() {
    setTitle(noteTitle)
    editorRef.current = {
      json: parseNoteContent(noteContent),
      text: notePlainText,
    }
    setEditingItemId(activeItem.id)
  }

  return (
    <aside className={variant === 'popover'
      ? 'max-h-[560px] w-80 overflow-y-auto rounded-2xl border border-border-color bg-bg-primary p-4 shadow-xl'
      : 'w-full overflow-y-auto bg-bg-secondary/20 p-4'}
    >
      <div className="mb-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wide text-text-muted">{t('journalInspector.selectedSticker')}</p>
            <h3 className="mt-1 line-clamp-2 text-base font-semibold text-text-primary">
              {noteTitle || t('journalInspector.untitled')}
            </h3>
          </div>
          {variant === 'popover' && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-text-muted hover:bg-bg-tertiary hover:text-text-primary"
              title="Close"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <p className="mt-2 line-clamp-4 text-xs leading-relaxed text-text-secondary">
          {notePlainText || t('common.noContent')}
        </p>
      </div>

      <div className="mb-5 flex gap-2">
        <button
          type="button"
          onClick={() => onToggleFavorite(noteId)}
          className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
            noteFavorite
              ? 'border-pink-200 bg-pink-50 text-pink-500'
              : 'border-border-color bg-bg-primary text-text-muted hover:text-pink-500'
          }`}
          title="Favorite"
        >
          <Heart size={16} fill={noteFavorite ? 'currentColor' : 'none'} />
        </button>
        <Link to={`/oshis/${oshiId}/notes/${noteId}`} className="flex-1">
          <Button variant="secondary" size="sm" className="w-full">
            <ExternalLink size={15} />
            {t('journalInspector.fullEditor')}
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
                key={noteId}
                content={parseNoteContent(noteContent)}
                onUpdate={(json, textValue) => {
                  editorRef.current = { json, text: textValue }
                }}
              />
            </div>
            <div className="border-t border-border-color p-2">
              <Button size="sm" className="w-full" onClick={handleSaveNote} disabled={saving}>
                <Save size={15} />
                {saving ? t('journalInspector.saving') : t('journalInspector.saveNote')}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" size="sm" className="w-full" onClick={handleStartEditing}>
            <Edit3 size={15} />
            {t('journalInspector.editOnPage')}
          </Button>
        )}
      </section>

      <section className="mb-5">
        <h4 className="mb-2 text-xs font-semibold text-text-muted">{t('journalInspector.style')}</h4>
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
        <h4 className="mb-2 text-xs font-semibold text-text-muted">{t('journalInspector.color')}</h4>
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
        <h4 className="mb-2 text-xs font-semibold text-text-muted">{t('journalInspector.size')}</h4>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" size="sm" onClick={() => patchLayout({ width: selectedItem.width - 24 })}>
            <Minus size={14} />
            {t('journalInspector.width')}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => patchLayout({ width: selectedItem.width + 24 })}>
            <Plus size={14} />
            {t('journalInspector.width')}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => patchLayout({ height: selectedItem.height - 18 })}>
            <Minus size={14} />
            {t('journalInspector.height')}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => patchLayout({ height: selectedItem.height + 18 })}>
            <Plus size={14} />
            {t('journalInspector.height')}
          </Button>
        </div>
      </section>

      <section className="mb-5">
        <h4 className="mb-2 text-xs font-semibold text-text-muted">{t('journalInspector.rotation')}</h4>
        <div className="grid grid-cols-3 gap-2">
          <Button variant="secondary" size="sm" onClick={() => patchLayout({ rotation: selectedItem.rotation - 3 })}>-3</Button>
          <Button variant="secondary" size="sm" onClick={() => patchLayout({ rotation: 0 })}>
            <RotateCcw size={14} />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => patchLayout({ rotation: selectedItem.rotation + 3 })}>+3</Button>
        </div>
      </section>

      <section className="mb-5">
        <h4 className="mb-2 text-xs font-semibold text-text-muted">{t('journalInspector.layer')}</h4>
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
          {t('journalInspector.bringForward')}
        </Button>
      </section>

      <Button variant="ghost" size="sm" className="w-full text-red-500" onClick={() => onRemove(selectedItem.id)}>
        <Trash2 size={15} />
        {t('journalInspector.removeFromPage')}
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

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
