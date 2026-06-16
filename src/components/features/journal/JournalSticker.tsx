import { useEffect, useRef, useState, type PointerEvent } from 'react'
import clsx from 'clsx'
import { Calendar, Heart, ImageIcon } from 'lucide-react'
import type { JournalItemWithNote } from '../../../types'
import { clampLayout, type JournalLayoutInput } from '../../../features/journal/journalLayout'
import { releaseMediaUrl, resolveMediaUrl } from '../../../services/media/illustrationMedia'

interface JournalStickerProps {
  item: JournalItemWithNote
  selected: boolean
  zoom: number
  onSelect: (item: JournalItemWithNote) => void
  onCommitLayout: (itemId: string, layout: JournalLayoutInput) => void
}

interface DragState {
  pointerId: number
  startClientX: number
  startClientY: number
  startLayout: JournalLayoutInput
  moved: boolean
}

export function JournalSticker({ item, selected, zoom, onSelect, onCommitLayout }: JournalStickerProps) {
  const dragRef = useRef<DragState | null>(null)
  const [imageSrc, setImageSrc] = useState('')

  useEffect(() => {
    if (item.item_type !== 'illustration') return
    let alive = true
    let currentUrl = ''
    const originalPath = item.illustration?.original_path || null
    const primaryPath = item.illustration?.thumbnail_path || originalPath
    resolveMediaUrl(primaryPath)
      .then((url) => {
        currentUrl = url
        if (alive) setImageSrc(url)
        else releaseMediaUrl(url)
      })
      .catch(() => {
        if (!alive || !item.illustration?.thumbnail_path || !originalPath) return
        resolveMediaUrl(originalPath)
          .then((url) => {
            currentUrl = url
            if (alive) setImageSrc(url)
            else releaseMediaUrl(url)
          })
          .catch(() => {
            if (alive) setImageSrc('')
          })
      })
    return () => {
      alive = false
      releaseMediaUrl(currentUrl)
    }
  }, [item.illustration?.original_path, item.illustration?.thumbnail_path, item.item_type])

  function handlePointerDown(e: PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return
    onSelect(item)
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startLayout: {
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        rotation: item.rotation,
      },
      moved: false,
    }
  }

  function handlePointerMove(e: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const dx = (e.clientX - drag.startClientX) / zoom
    const dy = (e.clientY - drag.startClientY) / zoom
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true

    const layout = clampLayout({
      ...drag.startLayout,
      x: drag.startLayout.x + dx,
      y: drag.startLayout.y + dy,
    })
    e.currentTarget.style.left = `${layout.x}px`
    e.currentTarget.style.top = `${layout.y}px`
  }

  function handlePointerUp(e: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    dragRef.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)

    if (!drag.moved) return
    const layout = clampLayout({
      ...drag.startLayout,
      x: drag.startLayout.x + (e.clientX - drag.startClientX) / zoom,
      y: drag.startLayout.y + (e.clientY - drag.startClientY) / zoom,
    })
    onCommitLayout(item.id, layout)
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { dragRef.current = null }}
      className={clsx(
        'absolute overflow-hidden text-left rounded-lg border shadow-md transition-shadow touch-none',
        'focus:outline-none focus:ring-2 focus:ring-accent-soft',
        selected ? 'ring-2 ring-accent shadow-xl' : 'hover:shadow-lg',
        item.item_type === 'illustration' && 'bg-bg-card',
        item.sticker_style === 'memo' && 'bg-[linear-gradient(#0000_23px,rgba(120,130,180,0.18)_24px)] bg-[length:100%_24px]',
        item.sticker_style === 'ticket' && 'border-dashed',
      )}
      style={{
        left: item.x,
        top: item.y,
        width: item.width,
        height: item.height,
        zIndex: item.z_index,
        transform: `rotate(${item.rotation}deg)`,
        backgroundColor: item.item_type === 'illustration' ? 'var(--color-bg-card)' : getStickerBackground(item.color),
        borderColor: selected ? 'var(--color-accent)' : 'rgba(120, 100, 120, 0.22)',
      }}
    >
      {item.item_type === 'illustration' ? (
        <div className="flex h-full flex-col">
          <div className="min-h-0 flex-1 bg-bg-tertiary">
            {imageSrc ? (
              <img src={imageSrc} alt={item.illustration?.title || ''} className="h-full w-full object-cover" draggable={false} />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-text-muted">
                <ImageIcon size={28} />
              </div>
            )}
          </div>
          <div className="shrink-0 p-3">
            <div className="flex items-start gap-2">
              <h4 className="min-w-0 flex-1 text-sm font-semibold text-text-primary line-clamp-1">
                {item.illustration?.title || 'Untitled'}
              </h4>
              {item.illustration?.favorite && (
                <Heart size={15} className="shrink-0 text-pink-500" fill="currentColor" />
              )}
            </div>
            <p className="mt-1 line-clamp-1 text-[11px] text-text-muted">
              {item.illustration?.artist ? `by ${item.illustration.artist}` : 'Unknown artist'}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex h-full flex-col p-4">
          <div className="mb-2 flex items-start gap-2">
            <h4 className="min-w-0 flex-1 text-sm font-semibold text-text-primary line-clamp-2">
              {item.note?.title || 'Untitled'}
            </h4>
            {item.note?.favorite && (
              <Heart size={15} className="shrink-0 text-pink-500" fill="currentColor" />
            )}
          </div>

          <p className="flex-1 text-xs leading-relaxed text-text-secondary line-clamp-4">
            {item.note?.plain_text || 'No content yet'}
          </p>

          <div className="mt-3 flex items-center gap-1.5 overflow-hidden">
            {item.note?.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="shrink-0 rounded-full bg-white/55 px-2 py-0.5 text-[11px] text-text-muted">
                {tag}
              </span>
            ))}
          </div>

          <div className="mt-2 flex items-center gap-1 text-[11px] text-text-muted">
            <Calendar size={12} />
            {item.note?.created_at ? new Date(item.note.created_at).toLocaleDateString() : ''}
          </div>
        </div>
      )}
    </button>
  )
}

function getStickerBackground(color: string | null): string {
  const paletteIndex = STICKER_PALETTE.indexOf(color || '#fff1f5')
  return paletteIndex >= 0 ? `var(--journal-sticker-${paletteIndex + 1})` : color || 'var(--journal-sticker-1)'
}

const STICKER_PALETTE = ['#fff1f5', '#eef6ff', '#fff7d6', '#f3f0ff', '#edf7ed']
