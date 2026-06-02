import { useRef, type PointerEvent } from 'react'
import clsx from 'clsx'
import { Calendar, Heart } from 'lucide-react'
import type { JournalItemWithNote } from '../../../types'
import { clampLayout, type JournalLayoutInput } from '../../../features/journal/journalLayout'

interface JournalStickerProps {
  item: JournalItemWithNote
  selected: boolean
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

export function JournalSticker({ item, selected, onSelect, onCommitLayout }: JournalStickerProps) {
  const dragRef = useRef<DragState | null>(null)

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
    const dx = e.clientX - drag.startClientX
    const dy = e.clientY - drag.startClientY
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
      x: drag.startLayout.x + e.clientX - drag.startClientX,
      y: drag.startLayout.y + e.clientY - drag.startClientY,
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
        'absolute text-left rounded-lg border shadow-md transition-shadow touch-none',
        'focus:outline-none focus:ring-2 focus:ring-accent-soft',
        selected ? 'ring-2 ring-accent shadow-xl' : 'hover:shadow-lg',
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
        backgroundColor: getStickerBackground(item.color),
        borderColor: selected ? 'var(--color-accent)' : 'rgba(120, 100, 120, 0.22)',
      }}
    >
      <div className="flex h-full flex-col p-4">
        <div className="mb-2 flex items-start gap-2">
          <h4 className="min-w-0 flex-1 text-sm font-semibold text-text-primary line-clamp-2">
            {item.note.title || 'Untitled'}
          </h4>
          {item.note.favorite && (
            <Heart size={15} className="shrink-0 text-pink-500" fill="currentColor" />
          )}
        </div>

        <p className="flex-1 text-xs leading-relaxed text-text-secondary line-clamp-4">
          {item.note.plain_text || 'No content yet'}
        </p>

        <div className="mt-3 flex items-center gap-1.5 overflow-hidden">
          {item.note.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="shrink-0 rounded-full bg-white/55 px-2 py-0.5 text-[11px] text-text-muted">
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-2 flex items-center gap-1 text-[11px] text-text-muted">
          <Calendar size={12} />
          {new Date(item.note.created_at).toLocaleDateString()}
        </div>
      </div>
    </button>
  )
}

function getStickerBackground(color: string | null): string {
  const paletteIndex = STICKER_PALETTE.indexOf(color || '#fff1f5')
  return paletteIndex >= 0 ? `var(--journal-sticker-${paletteIndex + 1})` : color || 'var(--journal-sticker-1)'
}

const STICKER_PALETTE = ['#fff1f5', '#eef6ff', '#fff7d6', '#f3f0ff', '#edf7ed']
