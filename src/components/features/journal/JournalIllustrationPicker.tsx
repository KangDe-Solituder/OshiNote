import { Search, ImageIcon, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '../../ui/Button'
import type { Illustration } from '../../../types'
import { usePopoverTransition } from '../themes/uiMotion'
import { releaseMediaUrl, resolveMediaUrl } from '../../../services/media/illustrationMedia'

interface JournalIllustrationPickerProps {
  illustrations: Illustration[]
  onPlaceIllustration: (illustrationId: string) => void
  onClose: () => void
}

export function JournalIllustrationPicker({ illustrations, onPlaceIllustration, onClose }: JournalIllustrationPickerProps) {
  const popoverTransition = usePopoverTransition()
  const [query, setQuery] = useState('')
  const filteredIllustrations = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return illustrations
    return illustrations.filter((illustration) =>
      illustration.title.toLowerCase().includes(normalized) ||
      illustration.artist.toLowerCase().includes(normalized) ||
      illustration.tags.some((tag) => tag.toLowerCase().includes(normalized))
    )
  }, [illustrations, query])

  return (
    <motion.div
      {...popoverTransition}
      className="absolute right-5 top-16 z-50 flex max-h-[560px] w-[420px] origin-top-right flex-col overflow-hidden rounded-2xl border border-border-color bg-bg-primary shadow-xl"
    >
      <div className="flex items-center gap-2 border-b border-border-color p-3">
        <ImageIcon size={18} className="text-accent" />
        <h3 className="flex-1 text-sm font-semibold text-text-primary">Place an illustration</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-text-muted hover:bg-bg-tertiary hover:text-text-primary"
          title="Close"
        >
          <X size={16} />
        </button>
      </div>

      <div className="border-b border-border-color p-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded-xl border border-border-color bg-bg-secondary py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-soft"
            placeholder="Search title, artist, tags..."
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {filteredIllustrations.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-text-muted">No unplaced illustrations found.</div>
        ) : (
          filteredIllustrations.map((illustration) => (
            <button
              key={illustration.id}
              type="button"
              onClick={() => onPlaceIllustration(illustration.id)}
              className="mb-2 flex w-full gap-3 rounded-xl border border-border-color bg-bg-secondary/60 p-2 text-left transition-colors hover:border-accent hover:bg-accent-soft/30"
            >
              <PickerImage illustration={illustration} />
              <div className="min-w-0 flex-1 py-1">
                <p className="line-clamp-1 text-sm font-semibold text-text-primary">{illustration.title || 'Untitled'}</p>
                <p className="mt-1 line-clamp-1 text-xs text-text-muted">{illustration.artist || 'Unknown artist'}</p>
                <div className="mt-2 flex items-center gap-1">
                  {illustration.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="rounded-full bg-bg-tertiary px-2 py-0.5 text-[11px] text-text-muted">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      <div className="border-t border-border-color p-3">
        <Button variant="ghost" size="sm" className="w-full" onClick={onClose}>Done</Button>
      </div>
    </motion.div>
  )
}

function PickerImage({ illustration }: { illustration: Illustration }) {
  const [src, setSrc] = useState('')

  useEffect(() => {
    let alive = true
    let currentUrl = ''
    resolveMediaUrl(illustration.thumbnail_path || illustration.original_path)
      .then((url) => {
        currentUrl = url
        if (alive) setSrc(url)
        else releaseMediaUrl(url)
      })
      .catch(() => {
        if (alive && illustration.thumbnail_path) {
          resolveMediaUrl(illustration.original_path).then((url) => {
            currentUrl = url
            if (alive) setSrc(url)
            else releaseMediaUrl(url)
          }).catch(() => {
            if (alive) setSrc('')
          })
        }
      })
    return () => {
      alive = false
      releaseMediaUrl(currentUrl)
    }
  }, [illustration.original_path, illustration.thumbnail_path])

  return (
    <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-bg-tertiary text-text-muted">
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <ImageIcon size={22} />}
    </span>
  )
}
