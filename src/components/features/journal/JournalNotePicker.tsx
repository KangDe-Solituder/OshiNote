import { Search, StickyNote, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '../../ui/Button'
import type { Note } from '../../../types'
import { usePopoverTransition } from '../themes/uiMotion'
import { useI18n } from '../../../i18n/useI18n'
import { OVERLAY_Z_INDEX } from '../../ui/overlay'

interface JournalNotePickerProps {
  notes: Note[]
  onPlaceNote: (noteId: string) => void
  onClose: () => void
}

export function JournalNotePicker({ notes, onPlaceNote, onClose }: JournalNotePickerProps) {
  const { t } = useI18n()
  const popoverTransition = usePopoverTransition()
  const [query, setQuery] = useState('')
  const filteredNotes = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return notes
    return notes.filter((note) =>
      note.title.toLowerCase().includes(normalized) ||
      note.plain_text.toLowerCase().includes(normalized) ||
      note.tags.some((tag) => tag.toLowerCase().includes(normalized))
    )
  }, [notes, query])

  return (
    <motion.div
      {...popoverTransition}
      className="fixed right-5 top-24 flex max-h-[520px] w-[min(384px,calc(100vw-40px))] origin-top-right flex-col overflow-hidden rounded-2xl border border-border-color bg-bg-primary shadow-xl"
      style={{ zIndex: OVERLAY_Z_INDEX.popover }}
    >
      <div className="flex items-center gap-2 border-b border-border-color p-3">
        <StickyNote size={18} className="text-accent" />
        <h3 className="flex-1 text-sm font-semibold text-text-primary">{t('journalPicker.note.title')}</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-text-muted hover:bg-bg-tertiary hover:text-text-primary"
          title={t('common.cancel')}
        >
          <X size={16} />
        </button>
      </div>

      <div className="border-b border-border-color p-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-border-color bg-bg-secondary py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-soft"
            placeholder={t('journalPicker.note.search')}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {filteredNotes.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-text-muted">{t('journalPicker.note.empty')}</div>
        ) : (
          filteredNotes.map((note) => (
            <button
              key={note.id}
              type="button"
              onClick={() => onPlaceNote(note.id)}
              className="mb-2 w-full rounded-xl border border-border-color bg-bg-secondary/60 p-3 text-left transition-colors hover:border-accent hover:bg-accent-soft/30"
            >
              <p className="line-clamp-1 text-sm font-semibold text-text-primary">{note.title || t('common.untitled')}</p>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-muted">{note.plain_text || t('common.noContent')}</p>
              <div className="mt-2 flex items-center gap-1">
                {note.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="rounded-full bg-bg-tertiary px-2 py-0.5 text-[11px] text-text-muted">
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          ))
        )}
      </div>

      <div className="border-t border-border-color p-3">
        <Button variant="ghost" size="sm" className="w-full" onClick={onClose}>{t('common.done')}</Button>
      </div>
    </motion.div>
  )
}
