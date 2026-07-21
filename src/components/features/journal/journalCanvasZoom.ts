import { useEffect, useRef } from 'react'

export const JOURNAL_ZOOM_MIN = 0.45
export const JOURNAL_ZOOM_MAX = 1.25

export function clampJournalZoom(zoom: number): number {
  return Math.min(JOURNAL_ZOOM_MAX, Math.max(JOURNAL_ZOOM_MIN, zoom))
}

export function getJournalWheelZoom(zoom: number, deltaY: number, deltaMode = 0): number {
  const deltaMultiplier = deltaMode === 1 ? 16 : deltaMode === 2 ? 120 : 1
  const normalizedDelta = Math.max(-120, Math.min(120, deltaY * deltaMultiplier))
  return clampJournalZoom(Number((zoom * Math.exp(-normalizedDelta * 0.0015)).toFixed(3)))
}

export function useJournalWheelZoom(zoom: number, onZoomChange: (zoom: number) => void) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const zoomRef = useRef(zoom)
  const onZoomChangeRef = useRef(onZoomChange)

  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  useEffect(() => {
    onZoomChangeRef.current = onZoomChange
  }, [onZoomChange])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    function handleWheel(event: WheelEvent) {
      if (event.deltaY === 0 || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
      const target = event.target
      if (target instanceof Element && target.closest('aside, input, textarea, select, [role="dialog"], [data-journal-wheel-scroll]')) return

      event.preventDefault()
      const nextZoom = getJournalWheelZoom(zoomRef.current, event.deltaY, event.deltaMode)
      if (nextZoom === zoomRef.current) return
      zoomRef.current = nextZoom
      onZoomChangeRef.current(nextZoom)
    }

    viewport.addEventListener('wheel', handleWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', handleWheel)
  }, [])

  return viewportRef
}
