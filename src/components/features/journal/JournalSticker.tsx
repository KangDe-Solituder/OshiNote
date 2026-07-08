import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import clsx from 'clsx'
import { Camera, Calendar, Flower2, Heart, ImageIcon, Music2, Sparkles, Star } from 'lucide-react'
import type { JournalItemWithNote, JournalPageOrientation } from '../../../types'
import { clampLayout, type JournalLayoutInput } from '../../../features/journal/journalLayout'
import { releaseMediaUrl, resolveMediaUrl } from '../../../services/media/illustrationMedia'
import { useI18n } from '../../../i18n/useI18n'
import { getJournalMaterialDefinition, parseMaterialStyle } from '../../../features/journal/journalMaterials'
import type { JournalPopoverAnchor } from './JournalCanvas'

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

type NoteCardStyle = {
  titleVisible: boolean
  titleText: string
  bodyText: string
  fontFamily: string
  fontSize: number
  fontWeight: number
  lineHeight: number
  textColor: string
  backgroundColor: string
  padding: number
  radius: number
  showTags: boolean
}

type ImageItemStyle = {
  fit: 'contain' | 'cover'
  frame: 'none' | 'simple' | 'paper' | 'polaroid'
  borderWidth: number
  borderColor: string
  radius: number
  shadow: number
  backgroundColor: string
}

export function JournalSticker({ item, selected, zoom, orientation = 'portrait', onSelect, onOpenPopover, onCommitLayout }: JournalStickerProps) {
  const { t } = useI18n()
  const dragRef = useRef<DragState | null>(null)
  const [imageSrc, setImageSrc] = useState('')
  const isTape = item.item_type === 'tape'
  const isMaterial = item.item_type === 'material'
  const material = isMaterial ? getJournalMaterialDefinition(item.material_id) : null
  const materialKind = material?.kind
  const noteCard = item.item_type === 'note' ? getNoteCardStyle(item, t('common.untitled'), t('common.noContent')) : null
  const imageStyle = item.item_type === 'illustration' ? getImageItemStyle(item) : null

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
    }, getLayoutConstraints(item, materialKind), orientation)
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
    }, getLayoutConstraints(item, materialKind), orientation)
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
      ) : isMaterial ? (
        <MaterialBody item={item} />
      ) : item.item_type === 'illustration' ? imageStyle ? (
        <div className="h-full w-full overflow-hidden" style={getImageFrameStyle(imageStyle)}>
          <div
            className="h-full w-full overflow-hidden"
            style={{
              padding: `${getImagePadding(imageStyle)}px ${getImagePadding(imageStyle)}px ${getImageBottomPadding(imageStyle)}px`,
              borderRadius: imageStyle.radius,
            }}
          >
            {imageSrc ? (
              <img src={imageSrc} alt={item.illustration?.title || ''} className="h-full w-full" style={{ objectFit: imageStyle.fit }} draggable={false} />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-text-muted">
                <ImageIcon size={28} />
              </div>
            )}
          </div>
        </div>
      ) : (
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
      ) : noteCard ? (
        <div
          className="flex h-full w-full flex-col overflow-hidden border border-black/10 shadow-sm"
          style={{
            backgroundColor: noteCard.backgroundColor,
            color: noteCard.textColor,
            padding: noteCard.padding,
            borderRadius: noteCard.radius,
            fontFamily: getFontFamily(noteCard.fontFamily),
            fontSize: noteCard.fontSize,
            fontWeight: noteCard.fontWeight,
            lineHeight: noteCard.lineHeight,
          }}
        >
          {noteCard.titleVisible && (
            <h4 className="mb-2 shrink-0 whitespace-pre-wrap break-words text-[1.08em] font-semibold leading-snug">
              {noteCard.titleText}
            </h4>
          )}
          <p className="min-h-0 flex-1 whitespace-pre-wrap break-words">
            {noteCard.bodyText}
          </p>
          {noteCard.showTags && item.note && item.note.tags.length > 0 && (
            <div className="mt-2 flex shrink-0 flex-wrap gap-1 overflow-hidden text-[0.78em]">
              {item.note.tags.slice(0, 3).map((tag) => <span key={tag} className="rounded-full bg-white/55 px-2 py-0.5 text-text-muted">{tag}</span>)}
            </div>
          )}
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

function MaterialBody({ item }: { item: JournalItemWithNote }) {
  const material = getJournalMaterialDefinition(item.material_id)
  const style = {
    ...(material?.defaultStyle || {}),
    ...parseMaterialStyle(item.style_payload),
  }
  const color = asString(style.color) || item.color || '#d9c4ff'
  const glassStrength = asNumber(style.glassStrength)
  const glassStyle = getMaterialGlassStyle(glassStrength, color)

  if (material?.kind === 'tape') {
    return <TapeShape color={color} styleId={asString(style.tapeStyle) || 'washi'} extraStyle={glassStyle} />
  }

  if (material?.kind === 'paper') {
    return (
      <span
        className="pointer-events-none relative block h-full w-full overflow-hidden rounded-lg border border-white/55 shadow-sm"
        style={{ backgroundColor: color, ...glassStyle }}
      >
        <span className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.35),transparent_48%,rgba(0,0,0,0.05))]" />
        {style.line === true && (
          <span className="absolute inset-x-3 top-7 bottom-3 bg-[linear-gradient(transparent_21px,rgba(100,110,140,0.18)_22px)] bg-[length:100%_22px]" />
        )}
      </span>
    )
  }

  if (material?.kind === 'label') {
    return (
      <span
        className={clsx(
          'pointer-events-none relative flex h-full w-full items-center justify-center overflow-hidden border border-black/10 px-3 shadow-sm',
          style.shape === 'ticket' ? 'rounded-md border-dashed' : 'rounded-full'
        )}
        style={{ backgroundColor: color, ...glassStyle }}
      >
        <span className="h-2 w-2 rounded-full bg-white/70 shadow-inner" />
        <span className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.26),transparent_50%,rgba(0,0,0,0.05))]" />
      </span>
    )
  }

  return (
    <span
        className={clsx(
          'pointer-events-none flex h-full w-full items-center justify-center rounded-full',
          glassStrength > 0 ? 'border border-white/60 shadow-sm' : 'border border-transparent bg-transparent shadow-none'
        )}
        style={{ color, ...glassStyle }}
    >
      <MaterialIcon icon={asString(style.icon)} />
    </span>
  )
}

function MaterialIcon({ icon }: { icon: string }) {
  const size = 42
  if (icon === 'heart') return <Heart size={size} fill="currentColor" />
  if (icon === 'star') return <Star size={size} fill="currentColor" />
  if (icon === 'flower') return <Flower2 size={size} />
  if (icon === 'music') return <Music2 size={size} />
  if (icon === 'camera') return <Camera size={size} />
  return <Sparkles size={size} />
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

function getNoteCardStyle(item: JournalItemWithNote, untitled: string, empty: string): NoteCardStyle | null {
  const payload = parseMaterialStyle(item.style_payload)
  if (!isRecord(payload.noteCard)) return null
  const raw = payload.noteCard
  return {
    titleVisible: raw.titleVisible !== false,
    titleText: asString(raw.titleText) || item.note?.title || untitled,
    bodyText: (asString(raw.bodyText) || item.note?.plain_text || empty).slice(0, 200),
    fontFamily: asString(raw.fontFamily) || 'system',
    fontSize: asNumberWithDefault(raw.fontSize, 14),
    fontWeight: asNumberWithDefault(raw.fontWeight, 500),
    lineHeight: asNumberWithDefault(raw.lineHeight, 1.45),
    textColor: asString(raw.textColor) || '#1f2f4d',
    backgroundColor: asString(raw.backgroundColor) || '#fff7d6',
    padding: asNumberWithDefault(raw.padding, 16),
    radius: asNumberWithDefault(raw.radius, 16),
    showTags: raw.showTags !== false,
  }
}

function getImageItemStyle(item: JournalItemWithNote): ImageItemStyle | null {
  const payload = parseMaterialStyle(item.style_payload)
  if (!isRecord(payload.imageStyle)) return null
  const raw = payload.imageStyle
  const fit = raw.fit === 'cover' ? 'cover' : 'contain'
  const frame = raw.frame === 'simple' || raw.frame === 'paper' || raw.frame === 'polaroid' ? raw.frame : 'none'
  return {
    fit,
    frame,
    borderWidth: asNumberWithDefault(raw.borderWidth, frame === 'none' ? 0 : 2),
    borderColor: asString(raw.borderColor) || '#ffffff',
    radius: asNumberWithDefault(raw.radius, 12),
    shadow: asNumberWithDefault(raw.shadow, frame === 'none' ? 0 : 16),
    backgroundColor: asString(raw.backgroundColor) || (frame === 'none' ? 'transparent' : '#ffffff'),
  }
}

function getImageFrameStyle(style: ImageItemStyle): CSSProperties {
  return {
    borderRadius: style.radius,
    border: style.borderWidth > 0 ? `${style.borderWidth}px solid ${style.borderColor}` : '0 solid transparent',
    backgroundColor: style.backgroundColor,
    boxShadow: style.shadow > 0 ? `0 ${Math.round(style.shadow / 2)}px ${style.shadow}px rgba(31,47,77,0.22)` : 'none',
  }
}

function getImagePadding(style: ImageItemStyle) {
  return style.frame === 'paper' ? 8 : style.frame === 'polaroid' ? 10 : 0
}

function getImageBottomPadding(style: ImageItemStyle) {
  return style.frame === 'polaroid' ? 30 : getImagePadding(style)
}

function getFontFamily(value: string) {
  if (value === 'serif') return 'Georgia, "Times New Roman", serif'
  if (value === 'sans') return 'Arial, "Helvetica Neue", sans-serif'
  if (value === 'mono') return '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
  if (value === 'casual') return '"Comic Sans MS", "Segoe Print", cursive'
  return 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

const STICKER_PALETTE = ['#fff1f5', '#eef6ff', '#fff7d6', '#f3f0ff', '#edf7ed']
const TAPE_LAYOUT_CONSTRAINTS = { minWidth: 90, minHeight: 18 }
const STICKER_LAYOUT_CONSTRAINTS = { minWidth: 42, minHeight: 42 }

function getLayoutConstraints(item: JournalItemWithNote, materialKind?: string) {
  if (item.item_type === 'tape' || materialKind === 'tape') return TAPE_LAYOUT_CONSTRAINTS
  if (materialKind === 'sticker') return STICKER_LAYOUT_CONSTRAINTS
  return undefined
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asNumber(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? Math.min(100, Math.max(0, number)) : 0
}

function asNumberWithDefault(value: unknown, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : fallback
}

function getMaterialGlassStyle(strength: number, color: string): CSSProperties | undefined {
  if (strength <= 0) return undefined
  const alpha = Math.min(0.42, strength / 240)
  return {
    backgroundColor: `color-mix(in srgb, ${color} ${Math.max(34, 100 - strength)}%, rgba(255,255,255,${alpha}))`,
    backdropFilter: `blur(${Math.round(strength / 14)}px) saturate(${100 + Math.round(strength * 0.45)}%)`,
  }
}

function isTapeStyleId(value: string): value is JournalItemWithNote['sticker_style'] {
  return value === 'washi' || value === 'grid' || value === 'dots' || value === 'stripe' || value === 'torn'
}
