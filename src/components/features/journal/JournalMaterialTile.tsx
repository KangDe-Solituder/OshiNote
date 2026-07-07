import { Camera, Flower2, Heart, Music2, Sparkles, Star } from 'lucide-react'
import clsx from 'clsx'
import type { CSSProperties } from 'react'
import type { JournalMaterialDefinition } from '../../../features/journal/journalMaterials'

interface JournalMaterialTileProps {
  material: JournalMaterialDefinition
  compact?: boolean
  fill?: boolean
  selected?: boolean
}

export function JournalMaterialTile({ material, compact = false, fill = false, selected = false }: JournalMaterialTileProps) {
  const style = material.defaultStyle
  const color = typeof style.color === 'string' ? style.color : '#d9c4ff'
  const glassStrength = clampNumber(style.glassStrength, 0, 100)
  const glassStyle = fill ? getGlassStyle(glassStrength, color) : undefined

  return (
    <span
      className={clsx(
        'relative flex items-center justify-center overflow-hidden rounded-lg',
        fill ? 'border border-transparent bg-transparent' : 'border border-border-color bg-bg-primary',
        fill ? 'h-full w-full' : compact ? 'h-24' : 'h-32',
        selected && 'border-accent ring-2 ring-accent-soft'
      )}
    >
      {material.kind === 'tape' ? (
        <span
          className={clsx('block rounded-md border border-white/25 shadow-sm', fill ? 'h-full w-full' : 'h-9 w-32 rotate-[-6deg]')}
          style={{
            backgroundColor: color,
            backgroundImage: getTapePreviewPattern(typeof style.tapeStyle === 'string' ? style.tapeStyle : 'washi', color),
            ...glassStyle,
          }}
        />
      ) : material.kind === 'paper' ? (
        <span className={clsx('block rounded-lg border border-white/60 shadow-sm', fill ? 'h-full w-full' : 'h-20 w-24 rotate-[-3deg]')} style={{ backgroundColor: color, ...glassStyle }}>
          {style.line === true && <span className={clsx('block bg-[linear-gradient(transparent_13px,rgba(100,110,140,0.18)_14px)] bg-[length:100%_14px]', fill ? 'mt-[20%] h-[52%]' : 'mt-5 h-10')} />}
        </span>
      ) : material.kind === 'label' ? (
        <span
          className={clsx('block border border-black/10 shadow-sm', fill ? 'h-full w-full' : 'h-11 w-28 rotate-[-4deg]', style.shape === 'ticket' ? 'rounded-md border-dashed' : 'rounded-full')}
          style={{ backgroundColor: color, ...glassStyle }}
        />
      ) : (
        <span
          className={clsx('flex items-center justify-center rounded-full', fill ? 'h-full w-full bg-transparent shadow-none' : 'h-16 w-16 bg-white/60 shadow-sm')}
          style={{ color, ...glassStyle }}
        >
          <MaterialIcon icon={typeof style.icon === 'string' ? style.icon : ''} size={compact ? 30 : 36} />
        </span>
      )}
    </span>
  )
}

function MaterialIcon({ icon, size }: { icon: string; size: number }) {
  if (icon === 'heart') return <Heart size={size} fill="currentColor" />
  if (icon === 'star') return <Star size={size} fill="currentColor" />
  if (icon === 'flower') return <Flower2 size={size} />
  if (icon === 'music') return <Music2 size={size} />
  if (icon === 'camera') return <Camera size={size} />
  return <Sparkles size={size} />
}

function getTapePreviewPattern(style: string, color: string): string {
  if (style === 'grid') return `linear-gradient(rgba(255,255,255,0.32) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.32) 1px, transparent 1px), linear-gradient(${color}, ${color})`
  if (style === 'dots') return `radial-gradient(circle, rgba(255,255,255,0.52) 0 2px, transparent 2.5px), linear-gradient(${color}, ${color})`
  if (style === 'stripe') return `repeating-linear-gradient(135deg, rgba(255,255,255,0.34) 0 8px, transparent 8px 18px), linear-gradient(${color}, ${color})`
  return `linear-gradient(90deg, rgba(255,255,255,0.24), transparent 34%, rgba(0,0,0,0.05) 74%, rgba(255,255,255,0.14)), linear-gradient(${color}, ${color})`
}

function clampNumber(value: unknown, min: number, max: number): number {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : min
}

function getGlassStyle(strength: number, color: string): CSSProperties | undefined {
  if (strength <= 0) return undefined
  const alpha = Math.min(0.42, strength / 240)
  return {
    backgroundColor: `color-mix(in srgb, ${color} ${Math.max(34, 100 - strength)}%, rgba(255,255,255,${alpha}))`,
    backdropFilter: `blur(${Math.round(strength / 14)}px) saturate(${100 + Math.round(strength * 0.45)}%)`,
  }
}
