// Version 1 renderer: preserve for existing pages when adding new material styles.
import type { CSSProperties } from 'react'
import clsx from 'clsx'
import type { JournalMaterialDefinition } from '../../../../../features/journal/journalMaterials'
import { getFontFamily, getMaterialGlassStyle } from '../../../../../features/journal/journalItemStyles'
import { asNumber, asString, isRecord } from '../../../../../utils/safeJson'
import { JournalStickerArt } from './JournalStickerArt'

export function DraftMaterialBody({ material, stylePayload, emptyText }: { material: JournalMaterialDefinition; stylePayload: Record<string, unknown>; emptyText: string }) {
  if (!material) return null
  const color = asString(stylePayload.color) || '#d9c4ff'
  const glassStrength = asNumber(stylePayload.glassStrength, 0)
  const glassStyle = getMaterialGlassStyle(glassStrength, color)
  if (material.kind === 'tape') return <TapeShape color={color} styleId={asString(stylePayload.tapeStyle) || 'washi'} extraStyle={glassStyle} />
  if (material.kind === 'paper') {
    const transparent = stylePayload.transparent === true
    const noteCard = isRecord(stylePayload.noteCard) ? stylePayload.noteCard : null
    const legacyText = isRecord(stylePayload.text) ? stylePayload.text : null
    const title = (noteCard ? asString(noteCard.titleText) : '') || (legacyText ? asString(legacyText.title) : '') || ''
    const body = (noteCard ? asString(noteCard.bodyText) : '') || (legacyText ? asString(legacyText.body) : '') || ''
    const hasText = Boolean(title || body)
    const fontFamily = getFontFamily((noteCard && asString(noteCard.fontFamily)) || 'casual')
    const fontSize = noteCard ? asNumber(noteCard.fontSize, 13) : 13
    const fontWeight = noteCard ? asNumber(noteCard.fontWeight, 400) : 400
    const lineHeight = noteCard ? asNumber(noteCard.lineHeight, 1.5) : 1.5
    const textColor = (noteCard && asString(noteCard.textColor)) || (transparent ? 'var(--color-text-primary)' : '#5a4a3f')
    return (
      <span
        className={clsx('pointer-events-none relative block h-full w-full overflow-hidden', !transparent && 'border border-black/10 shadow-sm')}
        style={{ backgroundColor: transparent ? 'transparent' : color, borderRadius: 10, ...glassStyle }}
      >
        {stylePayload.line === true && !transparent && !hasText && <span className="absolute inset-x-4 bottom-4 top-7 bg-[linear-gradient(transparent_21px,rgba(100,110,140,0.18)_22px)] bg-[length:100%_22px]" />}
        {hasText ? (
          <span
            className="flex h-full w-full flex-col overflow-hidden px-3.5 py-2.5"
            style={{ color: textColor, fontFamily, fontSize, fontWeight, lineHeight }}
          >
            {title && <strong className="mb-1 shrink-0 whitespace-pre-wrap break-words" style={{ fontWeight: Math.min(800, fontWeight + 200) }}>{title}</strong>}
            <span className="whitespace-pre-wrap break-words">{body}</span>
          </span>
        ) : noteCard ? (<span data-journal-placeholder="true" className="block p-4 text-sm text-text-muted/60">{emptyText}</span>) : transparent ? (
          <span className="absolute inset-0 rounded-[10px] border border-dashed border-text-muted/40" />
        ) : null}
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
        <JournalStickerArt icon={asString(stylePayload.icon)} size="88%" color={color} outline={stylePayload.outline === true} />
      </span>
    </span>
  )
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
