import clsx from 'clsx'
import { getPositionCoordinates } from '../../../features/stamps/stampService'
import type { Stamp, StampInput } from '../../../types'

export function StampOverlay({ stamp, className }: { stamp: Stamp | StampInput | null; className?: string }) {
  if (!stamp) return null
  const coordinates = getPositionCoordinates(stamp.position)
  const x = stamp.x ?? coordinates.x
  const y = stamp.y ?? coordinates.y
  const rotation = stamp.rotation ?? -8
  const size = stamp.size ?? 1
  const opacity = stamp.opacity ?? 0.92

  return (
    <div
      className={clsx('pointer-events-none absolute z-20 select-none', className)}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${size})`,
        opacity,
      }}
    >
      <div
        className="rounded-full border-[3px] bg-bg-primary/70 px-4 py-2 text-sm font-black uppercase tracking-[0.16em] shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-sm"
        style={{
          borderColor: stamp.color,
          color: stamp.color,
          boxShadow: `0 10px 24px color-mix(in srgb, ${stamp.color} 24%, transparent)`,
        }}
      >
        <span className="block rounded-full border px-3 py-1" style={{ borderColor: `${stamp.color}66` }}>
          {stamp.label}
        </span>
      </div>
    </div>
  )
}
