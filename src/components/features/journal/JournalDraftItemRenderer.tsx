import { Camera, Flower2, Heart, ImageIcon, Music2, Sparkles, Star } from 'lucide-react'
import { useEffect, useState, type CSSProperties } from 'react'
import clsx from 'clsx'
import type { Illustration, JournalDraftItem, Note } from '../../../types'
import { useI18n } from '../../../i18n/useI18n'
import { getJournalMaterialDefinition } from '../../../features/journal/journalMaterials'
import {
  getDraftImageItemStyle,
  getDraftNoteCardStyle,
  getFontFamily,
  getImageBottomPadding,
  getImageFrameStyle,
  getImagePadding,
  getMaterialGlassStyle,
  getMaterialStylePayload,
} from '../../../features/journal/journalItemStyles'
import { releaseMediaUrl, resolveMediaUrlWithFallback } from '../../../services/media/illustrationMedia'
import { asNumber, asString } from '../../../utils/safeJson'

export function JournalDraftItemRenderer({ item, note, illustration }: { item: JournalDraftItem; note?: Note; illustration?: Illustration }) {
  const material = item.itemType === 'material' ? getJournalMaterialDefinition(item.materialId) : null
  const stylePayload = getMaterialStylePayload(item.stylePayload, material?.id)
  if (item.itemType === 'note') return <DraftNoteBody item={item} note={note} />
  if (item.itemType === 'illustration') return <DraftIllustrationBody item={item} illustration={illustration} />
  if (material) return <DraftMaterialBody materialId={material.id} stylePayload={stylePayload} />
  return null
}

function DraftNoteBody({ item, note }: { item: JournalDraftItem; note?: Note }) {
  const { t } = useI18n()
  const noteCard = getDraftNoteCardStyle(item, note, t('common.untitled'), t('common.noContent'))
  const tags = noteCard.showTags ? (note?.tags || []).slice(0, 3) : []
  return (
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
      {noteCard.titleVisible && <h4 className="mb-2 shrink-0 whitespace-pre-wrap break-words text-[1.08em] font-semibold leading-snug">{noteCard.titleText}</h4>}
      <p className="min-h-0 flex-1 whitespace-pre-wrap break-words">{noteCard.bodyText}</p>
      {tags.length > 0 && (
        <div className="mt-2 flex shrink-0 flex-wrap gap-1 overflow-hidden text-[0.78em]">
          {tags.map((tag) => <span key={tag} className="rounded-full bg-white/55 px-2 py-0.5 text-text-muted">{tag}</span>)}
        </div>
      )}
    </div>
  )
}

function DraftIllustrationBody({ item, illustration }: { item: JournalDraftItem; illustration?: Illustration }) {
  const [imageSrc, setImageSrc] = useState('')
  const imageStyle = getDraftImageItemStyle(item)

  useEffect(() => {
    let alive = true
    let currentUrl = ''
    if (!illustration) {
      setImageSrc('')
      return
    }
    resolveMediaUrlWithFallback(illustration.thumbnail_path || illustration.original_path, illustration.original_path)
      .then((url) => {
        currentUrl = url
        if (alive) setImageSrc(url)
        else releaseMediaUrl(url)
      })
      .catch(() => { if (alive) setImageSrc('') })
    return () => {
      alive = false
      releaseMediaUrl(currentUrl)
    }
  }, [illustration])

  const imagePadding = getImagePadding(imageStyle)
  const bottomPadding = getImageBottomPadding(imageStyle)
  return (
    <div className="h-full w-full overflow-hidden" style={getImageFrameStyle(imageStyle)}>
      <div className="h-full w-full overflow-hidden" style={{ padding: `${imagePadding}px ${imagePadding}px ${bottomPadding}px`, borderRadius: imageStyle.radius }}>
        {imageSrc ? (
          <img src={imageSrc} alt={illustration?.title || ''} className="h-full w-full" style={{ objectFit: imageStyle.fit }} draggable={false} />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-text-muted"><ImageIcon size={28} /></div>
        )}
      </div>
    </div>
  )
}

function DraftMaterialBody({ materialId, stylePayload }: { materialId: string; stylePayload: Record<string, unknown> }) {
  const material = getJournalMaterialDefinition(materialId)
  if (!material) return null
  const color = asString(stylePayload.color) || '#d9c4ff'
  const glassStrength = asNumber(stylePayload.glassStrength, 0)
  const glassStyle = getMaterialGlassStyle(glassStrength, color)
  if (material.kind === 'tape') return <TapeShape color={color} styleId={asString(stylePayload.tapeStyle) || 'washi'} extraStyle={glassStyle} />
  if (material.kind === 'paper') {
    return (
      <span className="pointer-events-none relative block h-full w-full overflow-hidden border border-black/10 shadow-sm" style={{ backgroundColor: color, borderRadius: 10, ...glassStyle }}>
        {stylePayload.line === true && <span className="absolute inset-x-4 bottom-4 top-7 bg-[linear-gradient(transparent_21px,rgba(100,110,140,0.18)_22px)] bg-[length:100%_22px]" />}
      </span>
    )
  }
  if (material.kind === 'label') {
    return <span className={clsx('pointer-events-none relative block h-full w-full border border-black/10 shadow-sm', stylePayload.shape === 'ticket' ? 'rounded-md border-dashed' : 'rounded-full')} style={{ backgroundColor: color, ...glassStyle }} />
  }
  const backing = stylePayload.backing === true
  const backingShape = asString(stylePayload.backingShape) || 'circle'
  return (
    <span className="pointer-events-none flex h-full w-full items-center justify-center" style={{ color }}>
      <span className={clsx('flex h-full w-full items-center justify-center', backing && (backingShape === 'square' ? 'rounded-xl border border-black/10 bg-white/75 shadow-sm' : 'rounded-full border border-black/10 bg-white/75 shadow-sm'))} style={backing ? glassStyle : undefined}>
        <MaterialIcon icon={asString(stylePayload.icon)} size={58} />
      </span>
    </span>
  )
}

function MaterialIcon({ icon, size = 42 }: { icon: string; size?: number }) {
  if (icon === 'heart') return <Heart size={size} fill="currentColor" />
  if (icon === 'star') return <Star size={size} fill="currentColor" />
  if (icon === 'flower') return <Flower2 size={size} />
  if (icon === 'music') return <Music2 size={size} />
  if (icon === 'camera') return <Camera size={size} />
  return <Sparkles size={size} />
}

function TapeShape({ color, styleId, extraStyle }: { color: string; styleId: string; extraStyle?: CSSProperties }) {
  const style = isTapeStyleId(styleId) ? styleId : 'washi'
  return (
    <span
      className={clsx('pointer-events-none relative block h-full w-full overflow-hidden border border-white/20', style === 'torn' ? 'rounded-[5px]' : 'rounded-md')}
      style={{
        backgroundColor: color,
        ...getTapePattern(style, color),
        ...extraStyle,
        clipPath: style === 'torn' ? 'polygon(0 9%, 4% 0, 9% 8%, 14% 0, 20% 10%, 27% 0, 34% 8%, 42% 0, 51% 9%, 60% 0, 69% 8%, 78% 0, 87% 9%, 94% 0, 100% 8%, 98% 91%, 94% 100%, 87% 92%, 78% 100%, 70% 91%, 60% 100%, 52% 92%, 43% 100%, 35% 91%, 27% 100%, 19% 92%, 11% 100%, 4% 91%, 0 100%)' : undefined,
      }}
    >
      <span className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.18),rgba(255,255,255,0.03)_28%,rgba(0,0,0,0.05)_70%,rgba(255,255,255,0.12))]" />
      <span className="absolute inset-0 opacity-35 mix-blend-soft-light bg-[radial-gradient(circle_at_18%_35%,rgba(255,255,255,0.9)_0_1px,transparent_1.5px),radial-gradient(circle_at_72%_64%,rgba(0,0,0,0.45)_0_1px,transparent_1.5px)] bg-[length:18px_14px,22px_16px]" />
    </span>
  )
}

function getTapePattern(style: string, color: string): CSSProperties {
  if (style === 'grid') return { backgroundImage: `linear-gradient(rgba(255,255,255,0.28) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.28) 1px, transparent 1px), linear-gradient(${color}, ${color})`, backgroundSize: '20px 20px, 20px 20px, auto' }
  if (style === 'dots') return { backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.5) 0 2px, transparent 2.5px), linear-gradient(${color}, ${color})`, backgroundSize: '18px 18px, auto' }
  if (style === 'stripe') return { backgroundImage: `repeating-linear-gradient(135deg, rgba(255,255,255,0.32) 0 8px, transparent 8px 18px), linear-gradient(${color}, ${color})` }
  return { backgroundImage: `linear-gradient(90deg, rgba(255,255,255,0.2), transparent 34%, rgba(0,0,0,0.05) 74%, rgba(255,255,255,0.12)), linear-gradient(${color}, ${color})` }
}

function isTapeStyleId(value: string) {
  return value === 'washi' || value === 'grid' || value === 'dots' || value === 'stripe' || value === 'torn'
}
