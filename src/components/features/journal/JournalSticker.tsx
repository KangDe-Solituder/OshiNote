import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import clsx from 'clsx'
import { Calendar, Heart, ImageIcon } from 'lucide-react'
import type { JournalItemWithNote, JournalPageOrientation } from '../../../types'
import { clampLayout, type JournalLayoutInput } from '../../../features/journal/journalLayout'
import { releaseMediaUrl, resolveMediaUrl } from '../../../services/media/illustrationMedia'
import { useI18n } from '../../../i18n/useI18n'
import type { JournalPopoverAnchor } from './JournalCanvas'
import {
  getJournalImageItemStyle,
  getJournalNoteCardStyle,
} from '../../../features/journal/journalItemStyles'
import { getJournalItemConstraints } from '../../../features/journal/journalItemSizing'
import { journalItemToDraftItem } from '../../../features/journal/journalDraftAdapters'
import { JournalDraftItemRenderer } from './JournalDraftItemRenderer'

interface JournalStickerProps {
  item: JournalItemWithNote
  selected: boolean
  zoom: number
  orientation?: JournalPageOrientation
  onSelect: (item: JournalItemWithNote) => void
  onOpenPopover?: (item: JournalItemWithNote, anchor: JournalPopoverAnchor) => void
  onCommitLayout: (itemId: string, layout: JournalLayoutInput) => void
}

interface DragState {
  pointerId: number
  startClientX: number
  startClientY: number
  startLayout: JournalLayoutInput
  moved: boolean
}

export function JournalSticker({ item, selected, zoom, orientation = 'portrait', onSelect, onOpenPopover, onCommitLayout }: JournalStickerProps) {
  const { t } = useI18n()
  const dragRef = useRef<DragState | null>(null)
  const [imageSrc, setImageSrc] = useState('')
  const isTape = item.item_type === 'tape'
  const isMaterial = item.item_type === 'material'
  const noteCard = item.item_type === 'note' ? getJournalNoteCardStyle(item, t('common.untitled'), t('common.noContent')) : null
  const imageStyle = item.item_type === 'illustration' ? getJournalImageItemStyle(item) : null
  const sharedDraftItem = isMaterial || noteCard || imageStyle ? journalItemToDraftItem(item)[0] : null

  useEffect(() => {
    if (item.item_type !== 'illustration' || imageStyle) return
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
  }, [imageStyle, item.illustration?.original_path, item.illustration?.thumbnail_path, item.item_type])

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
    }, getJournalItemConstraints(item), orientation)
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
    }, getJournalItemConstraints(item), orientation)
    onCommitLayout(item.id, layout)
  }

  return (
    <button
      type="button"
      data-journal-item-id={item.id}
      onClick={() => onSelect(item)}
      onContextMenu={(event) => {
        event.preventDefault()
        onSelect(item)
        onOpenPopover?.(item, { clientX: event.clientX, clientY: event.clientY })
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { dragRef.current = null }}
      className={clsx(
        'absolute text-left touch-none',
        'focus:outline-none focus:ring-2 focus:ring-accent-soft',
        isTape
          ? 'overflow-visible rounded-md border-0 shadow-none transition-[filter]'
          : isMaterial
            ? 'overflow-visible rounded-lg border-0 shadow-sm transition-[filter,box-shadow]'
          : 'overflow-hidden rounded-lg border shadow-md transition-shadow',
        selected
          ? isTape ? 'ring-2 ring-accent/80' : 'ring-2 ring-accent shadow-xl'
          : isTape || isMaterial ? 'hover:brightness-105' : 'hover:shadow-lg',
        item.item_type === 'illustration' && !imageStyle && 'bg-bg-card',
        !isTape && item.sticker_style === 'memo' && 'bg-[linear-gradient(#0000_23px,rgba(120,130,180,0.18)_24px)] bg-[length:100%_24px]',
        !isTape && item.sticker_style === 'ticket' && 'border-dashed',
      )}
      style={{
        left: item.x,
        top: item.y,
        width: item.width,
        height: item.height,
        zIndex: item.z_index,
        transform: `rotate(${item.rotation}deg)`,
        backgroundColor: isTape || isMaterial || imageStyle ? 'transparent' : item.item_type === 'illustration' ? 'var(--color-bg-card)' : getStickerBackground(item.color),
        borderColor: selected ? 'var(--color-accent)' : 'rgba(120, 100, 120, 0.22)',
      }}
    >
      {isTape ? (
        <TapeBody item={item} />
      ) : sharedDraftItem ? (
        <JournalDraftItemRenderer item={sharedDraftItem} note={item.note || undefined} illustration={item.illustration || undefined} />
      ) : item.item_type === 'illustration' ? (
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
                {item.illustration?.title || t('common.untitled')}
              </h4>
              {item.illustration?.favorite && (
                <Heart size={15} className="shrink-0 text-pink-500" fill="currentColor" />
              )}
            </div>
            <p className="mt-1 line-clamp-1 text-[11px] text-text-muted">
              {item.illustration?.artist ? t('common.byArtist', { artist: item.illustration.artist }) : t('common.unknownArtist')}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex h-full flex-col p-4">
          <div className="mb-2 flex items-start gap-2">
            <h4 className="min-w-0 flex-1 text-sm font-semibold text-text-primary line-clamp-2">
              {item.note?.title || t('common.untitled')}
            </h4>
            {item.note?.favorite && (
              <Heart size={15} className="shrink-0 text-pink-500" fill="currentColor" />
            )}
          </div>

          <p className="flex-1 text-xs leading-relaxed text-text-secondary line-clamp-4">
            {item.note?.plain_text || t('common.noContent')}
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

function TapeBody({ item }: { item: JournalItemWithNote }) {
  const color = item.color || '#d9c4ff'
  const style = item.sticker_style
  return <TapeShape color={color} styleId={style} />
}

function TapeShape({ color, styleId, extraStyle }: { color: string; styleId: string; extraStyle?: CSSProperties }) {
  const style = isTapeStyleId(styleId) ? styleId : 'washi'
  const tapeStyle: CSSProperties = {
    backgroundColor: color,
    ...getTapePattern(style, color),
    ...extraStyle,
    clipPath: style === 'torn'
      ? 'polygon(0 9%, 4% 0, 9% 8%, 14% 0, 20% 10%, 27% 0, 34% 8%, 42% 0, 51% 9%, 60% 0, 69% 8%, 78% 0, 87% 9%, 94% 0, 100% 8%, 98% 91%, 94% 100%, 87% 92%, 78% 100%, 70% 91%, 60% 100%, 52% 92%, 43% 100%, 35% 91%, 27% 100%, 19% 92%, 11% 100%, 4% 91%, 0 100%)'
      : undefined,
  }

  return (
    <span
      className={clsx(
        'pointer-events-none relative block h-full w-full overflow-hidden border border-white/25',
        style === 'torn' ? 'rounded-[5px]' : 'rounded-md'
      )}
      style={tapeStyle}
    >
      <span className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.18),rgba(255,255,255,0.03)_28%,rgba(0,0,0,0.05)_70%,rgba(255,255,255,0.12))]" />
      <span className="absolute inset-0 opacity-35 mix-blend-soft-light bg-[radial-gradient(circle_at_18%_35%,rgba(255,255,255,0.9)_0_1px,transparent_1.5px),radial-gradient(circle_at_72%_64%,rgba(0,0,0,0.45)_0_1px,transparent_1.5px)] bg-[length:18px_14px,22px_16px]" />
      <span className="absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-white/20" />
    </span>
  )
}

function getTapePattern(style: JournalItemWithNote['sticker_style'], color: string): CSSProperties {
  switch (style) {
    case 'grid':
      return {
        backgroundImage: `linear-gradient(rgba(255,255,255,0.28) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.28) 1px, transparent 1px), linear-gradient(${color}, ${color})`,
        backgroundSize: '20px 20px, 20px 20px, auto',
      }
    case 'dots':
      return {
        backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.5) 0 2px, transparent 2.5px), linear-gradient(${color}, ${color})`,
        backgroundSize: '18px 18px, auto',
      }
    case 'stripe':
      return {
        backgroundImage: `repeating-linear-gradient(135deg, rgba(255,255,255,0.32) 0 8px, transparent 8px 18px), linear-gradient(${color}, ${color})`,
      }
    case 'torn':
      return {
        backgroundImage: `linear-gradient(90deg, rgba(255,255,255,0.24), transparent 24%, rgba(0,0,0,0.06) 70%, rgba(255,255,255,0.16)), linear-gradient(${color}, ${color})`,
      }
    default:
      return {
        backgroundImage: `linear-gradient(90deg, rgba(255,255,255,0.2), transparent 34%, rgba(0,0,0,0.05) 74%, rgba(255,255,255,0.12)), linear-gradient(${color}, ${color})`,
      }
  }
}

function getStickerBackground(color: string | null): string {
  const paletteIndex = STICKER_PALETTE.indexOf(color || '#fff1f5')
  return paletteIndex >= 0 ? `var(--journal-sticker-${paletteIndex + 1})` : color || 'var(--journal-sticker-1)'
}

const STICKER_PALETTE = ['#fff1f5', '#eef6ff', '#fff7d6', '#f3f0ff', '#edf7ed']

function isTapeStyleId(value: string): value is JournalItemWithNote['sticker_style'] {
  return value === 'washi' || value === 'grid' || value === 'dots' || value === 'stripe' || value === 'torn'
}
