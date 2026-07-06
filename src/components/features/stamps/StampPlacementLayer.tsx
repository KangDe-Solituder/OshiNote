import { useEffect, useState, type PointerEvent } from 'react'
import {
  clampStampCoordinate,
  getPresetPositionFromCoordinates,
  normalizeStampInput,
} from '../../../features/stamps/stampService'
import { playStampTapSound } from '../../../features/stamps/stampSound'
import type { Stamp, StampInput } from '../../../types'
import { useI18n } from '../../../i18n/useI18n'
import { StampOverlay } from './StampOverlay'

interface GhostPoint {
  x: number
  y: number
}

export function StampPlacementLayer({
  active,
  stamp,
  soundEnabled,
  onPlace,
  onComplete,
  onCancel,
}: {
  active: boolean
  stamp: Stamp | StampInput | null
  soundEnabled: boolean
  onPlace: (stamp: StampInput) => void
  onComplete: () => void
  onCancel?: () => void
}) {
  const { t } = useI18n()
  const [ghost, setGhost] = useState<GhostPoint | null>(null)
  const [placedStamp, setPlacedStamp] = useState<StampInput | null>(null)

  useEffect(() => {
    if (!active) {
      setGhost(null)
      setPlacedStamp(null)
      return
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [active, onCancel])

  if (!active || !stamp) return null

  const normalized = normalizeStampInput(stamp)

  function getPoint(event: PointerEvent<HTMLDivElement>): GhostPoint | null {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null
    return {
      x: Number(clampStampCoordinate(((event.clientX - rect.left) / rect.width) * 100).toFixed(2)),
      y: Number(clampStampCoordinate(((event.clientY - rect.top) / rect.height) * 100).toFixed(2)),
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (placedStamp) return
    const point = getPoint(event)
    if (point) setGhost(point)
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    if (placedStamp) return
    const point = getPoint(event)
    if (!point) return
    const nextStamp: StampInput = {
      ...normalized,
      x: point.x,
      y: point.y,
      position: getPresetPositionFromCoordinates(point.x, point.y),
    }
    setGhost(point)
    setPlacedStamp(nextStamp)
    onPlace(nextStamp)
    playStampTapSound(soundEnabled)
    window.setTimeout(onComplete, 460)
  }

  const ghostStamp = ghost ? { ...normalized, x: ghost.x, y: ghost.y, position: getPresetPositionFromCoordinates(ghost.x, ghost.y) } : null

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-40 cursor-crosshair touch-none"
      onPointerEnter={handlePointerMove}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setGhost(null)}
      onPointerDown={handlePointerDown}
    >
      <div className="pointer-events-none absolute inset-0 rounded-inherit stamp-placement-surface" />
      <div className="pointer-events-none absolute left-1/2 top-3 z-50 -translate-x-1/2 rounded-full border border-border-color bg-bg-primary/86 px-3 py-1.5 text-xs font-medium text-text-secondary shadow-lg shadow-black/10 backdrop-blur-md">
        {t('stamps.placementInstruction')}
      </div>
      {ghostStamp && !placedStamp && <StampOverlay stamp={ghostStamp} mode="ghost" className="z-50" />}
      {placedStamp && <StampOverlay stamp={placedStamp} mode="placed" className="z-50" />}
    </div>
  )
}
