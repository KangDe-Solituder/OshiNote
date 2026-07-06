import { type CSSProperties } from 'react'
import clsx from 'clsx'
import {
  getPositionCoordinates,
  normalizeStampInput,
  parseStampSnapshot,
} from '../../../features/stamps/stampService'
import type { Stamp, StampInput, StampMaterialId } from '../../../types'

interface StampOverlayProps {
  stamp: Stamp | StampInput | null
  mode?: 'normal' | 'ghost' | 'placed'
  className?: string
}

export function StampOverlay({ stamp, mode = 'normal', className }: StampOverlayProps) {
  if (!stamp) return null

  const normalized = normalizeStampInput(stamp)
  const snapshot = parseStampSnapshot(normalized.template_snapshot, normalized.template_id)
  const coordinates = getPositionCoordinates(normalized.position)
  const x = normalized.x ?? coordinates.x
  const y = normalized.y ?? coordinates.y
  const rotation = normalized.rotation ?? -8
  const size = normalized.size ?? 1
  const opacity = normalized.opacity ?? 0.92

  return (
    <div
      className={clsx(
        'pointer-events-none absolute z-20 origin-center select-none whitespace-nowrap [contain:layout_paint]',
        mode === 'ghost' && 'stamp-ghost-preview',
        mode === 'placed' && 'stamp-placed-impact',
        className
      )}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${size})`,
        opacity: mode === 'ghost' ? opacity * 0.52 : opacity,
        color: normalized.color,
        '--stamp-rotation': `${rotation}deg`,
        '--stamp-scale': String(size),
      } as CSSProperties}
    >
      <StampMaterialBody stamp={normalized} materialId={snapshot.material_id} />
    </div>
  )
}

function StampMaterialBody({ stamp, materialId }: { stamp: StampInput; materialId: StampMaterialId }) {
  const color = stamp.color
  const commonStyle: CSSProperties = {
    borderColor: color,
    color,
    boxShadow: `0 10px 24px color-mix(in srgb, ${color} 22%, transparent)`,
  }

  if (materialId === 'oval') {
    return (
      <div
        className="inline-flex min-h-14 min-w-36 items-center justify-center rounded-full border-[3px] bg-bg-primary/70 px-5 py-2 text-sm font-black uppercase tracking-[0.18em] shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-sm"
        style={commonStyle}
      >
        <span className="block rounded-full border px-4 py-1 whitespace-nowrap" style={{ borderColor: `${color}66` }}>
          {stamp.label}
        </span>
      </div>
    )
  }

  if (materialId === 'date') {
    return (
      <div
        className="min-h-16 min-w-36 rounded-md border-[3px] bg-bg-primary/75 px-4 py-2 text-center font-mono text-xs font-black uppercase tracking-[0.16em] shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-sm"
        style={commonStyle}
      >
        <span className="mb-1 block border-b pb-1" style={{ borderColor: `${color}70` }} />
        <span>{stamp.label}</span>
        <span className="mt-1 block border-t pt-1" style={{ borderColor: `${color}70` }} />
      </div>
    )
  }

  if (materialId === 'ticket') {
    return (
      <div
        className="relative inline-flex min-h-14 min-w-36 items-center justify-center rounded-lg border-[3px] border-dashed bg-bg-primary/80 px-5 py-2 text-sm font-black uppercase tracking-[0.12em] shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-sm"
        style={commonStyle}
      >
        <span className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border bg-bg-primary" style={{ borderColor: color }} />
        <span className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border bg-bg-primary" style={{ borderColor: color }} />
        <span className="block border-y px-2 py-1 whitespace-nowrap" style={{ borderColor: `${color}66` }}>
          {stamp.label}
        </span>
      </div>
    )
  }

  if (materialId === 'wax') {
    return (
      <div
        className="flex h-24 w-24 items-center justify-center rounded-full border text-center text-[11px] font-black uppercase leading-tight tracking-[0.08em] text-white shadow-[0_12px_26px_rgba(0,0,0,0.22)]"
        style={{
          background: `radial-gradient(circle at 34% 28%, color-mix(in srgb, ${color} 72%, white), ${color} 58%, color-mix(in srgb, ${color} 76%, black))`,
          borderColor: `color-mix(in srgb, ${color} 82%, white)`,
          borderRadius: '47% 53% 44% 56% / 54% 45% 55% 46%',
          boxShadow: `0 14px 28px color-mix(in srgb, ${color} 32%, transparent), inset 0 3px 8px rgba(255,255,255,0.22), inset 0 -5px 10px rgba(0,0,0,0.18)`,
        }}
      >
        <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/42 px-2 text-center">
          {stamp.label}
        </span>
      </div>
    )
  }

  if (materialId === 'paper-label') {
    return (
      <div
        className="inline-flex min-h-12 min-w-32 items-center justify-center rounded-sm border-2 border-dashed bg-bg-primary/85 px-5 py-2 text-sm font-bold tracking-[0.08em] shadow-[0_10px_22px_rgba(0,0,0,0.12)] backdrop-blur-sm"
        style={{
          ...commonStyle,
          background: `linear-gradient(135deg, color-mix(in srgb, ${color} 9%, var(--color-bg-primary)), var(--color-bg-primary))`,
        }}
      >
        <span>{stamp.label}</span>
      </div>
    )
  }

  if (materialId === 'seal-script') {
    return (
      <div
        className="flex h-24 w-24 items-center justify-center rounded-[18px] border-[4px] bg-bg-primary/68 p-2 text-center text-sm font-black leading-none tracking-[0.08em] shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-sm"
        style={{
          ...commonStyle,
          background: `radial-gradient(circle at 30% 22%, color-mix(in srgb, ${color} 12%, var(--color-bg-primary)), var(--color-bg-primary) 72%)`,
          fontFamily: '"OshiNote CJK Brush", "Yuji Syuku", "Yuji Boku", "KaiTi", "STKaiti", serif',
        }}
      >
        <span className="flex h-full w-full items-center justify-center rounded-[12px] border-2 px-1.5 py-2" style={{ borderColor: `${color}70` }}>
          <SealScriptText label={stamp.label} />
        </span>
      </div>
    )
  }

  if (materialId === 'calligraphy') {
    const calligraphyLabel = stamp.label
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .join('\n')
    return (
      <div
        className="relative inline-flex min-h-20 min-w-36 items-center justify-center rounded-xl border-[3px] bg-bg-primary/66 px-5 py-3 text-center shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-sm"
        style={{
          ...commonStyle,
          fontFamily: '"OshiNote CJK Brush", "Yuji Syuku", "Yuji Boku", "KaiTi", "STKaiti", serif',
        }}
      >
        <span className="absolute inset-2 rounded-lg border" style={{ borderColor: `${color}50` }} />
        <span className="relative whitespace-pre-line text-[24px] font-normal leading-tight tracking-[0.04em]">
          {calligraphyLabel || stamp.label}
        </span>
      </div>
    )
  }

  if (materialId === 'running-script' || materialId === 'flourish') {
    const signatureLabel = stamp.label.replace(/\s*\r?\n\s*/g, ' ').trim()
    return (
      <div
        className="relative inline-flex min-h-16 min-w-44 items-center justify-center rounded-xl border-2 bg-bg-primary/62 px-8 py-3 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-sm"
        style={{
          ...commonStyle,
          fontFamily: '"OshiNote Great Vibes", "Great Vibes", "Brush Script MT", "Segoe Script", cursive',
        }}
      >
        <span className="absolute inset-2 rounded-lg border" style={{ borderColor: `${color}45` }} />
        <span className="absolute left-8 right-8 bottom-5 h-px" style={{ backgroundColor: `${color}66` }} />
        <span className="absolute left-5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full" style={{ backgroundColor: `${color}88` }} />
        <span className="absolute right-5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full" style={{ backgroundColor: `${color}88` }} />
        <span
          className="relative block whitespace-nowrap px-3 pb-1 text-[32px] font-normal leading-none tracking-normal"
          style={{ textShadow: `0 1px 10px color-mix(in srgb, ${color} 28%, transparent)` }}
        >
          {signatureLabel || stamp.label}
        </span>
      </div>
    )
  }

  return (
    <div
      className="inline-flex min-h-16 min-w-28 items-center justify-center rounded-full border-[3px] bg-bg-primary/70 px-4 py-2 text-sm font-black uppercase tracking-[0.16em] shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-sm"
      style={commonStyle}
    >
      <span className="block rounded-full border px-3 py-1 whitespace-nowrap" style={{ borderColor: `${color}66` }}>
        {stamp.label}
      </span>
    </div>
  )
}

function SealScriptText({ label }: { label: string }) {
  const manualColumns = label
    .split(/\r?\n/)
    .map((line) => Array.from(line.replace(/\s+/g, '')))
    .filter((line) => line.length > 0)
  const hasManualColumns = manualColumns.length > 1
  const characters = Array.from(label.replace(/\s+/g, '') || label)
  const automaticColumnCount = characters.length <= 3 ? 1 : characters.length <= 6 ? 2 : 3
  const automaticRowCount = Math.ceil(characters.length / automaticColumnCount)
  const columns = hasManualColumns
    ? manualColumns
    : Array.from({ length: automaticColumnCount }, (_, index) => (
      characters.slice(index * automaticRowCount, (index + 1) * automaticRowCount)
    ))
  const maxColumnLength = columns.reduce((max, column) => Math.max(max, column.length), 0)
  const fontSize = columns.length >= 3 || maxColumnLength >= 4
    ? 11
    : maxColumnLength >= 3
      ? 13
      : 15

  return (
    <span className="flex h-full w-full flex-row-reverse items-center justify-center gap-1">
      {columns.map((column, columnIndex) => (
        <span
          key={`${column.join('')}-${columnIndex}`}
          className="flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5"
          style={{ fontSize }}
        >
          {column.map((character, characterIndex) => (
            <span key={`${character}-${characterIndex}`} className="block leading-none">
              {character}
            </span>
          ))}
        </span>
      ))}
    </span>
  )
}
