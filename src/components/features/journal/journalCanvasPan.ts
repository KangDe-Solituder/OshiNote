import { useRef, useState, type MouseEvent, type PointerEvent, type RefObject } from 'react'

interface PanSession {
  pointerId: number
  startX: number
  startY: number
  scrollLeft: number
  scrollTop: number
  moved: boolean
}

/**
 * Canva-style left-drag panning for journal canvases: pressing on empty
 * canvas/page space scrolls the viewport. Item frames (buttons, [data-journal-item-frame]),
 * floating toolbars ([data-journal-canvas-ui]) and form controls keep their own
 * pointer behavior. A pan that moved swallows its trailing click so it is not
 * misread as a deselect click.
 */
export function useJournalDragPan(viewportRef: RefObject<HTMLDivElement | null>, disabled = false) {
  const panRef = useRef<PanSession | null>(null)
  const suppressClickRef = useRef(false)
  const [panning, setPanning] = useState(false)

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (disabled) return
    if (event.button !== 0 || event.pointerType === 'touch') return
    const target = event.target as HTMLElement | null
    if (!target) return
    if (target.closest('[data-journal-item-frame], [data-journal-canvas-ui], button, a, input, textarea, select, aside, [role="dialog"], [data-journal-workboard="true"]')) return
    const viewport = viewportRef.current
    if (!viewport) return
    event.preventDefault()
    panRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, scrollLeft: viewport.scrollLeft, scrollTop: viewport.scrollTop, moved: false }
    viewport.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const pan = panRef.current
    if (!pan || pan.pointerId !== event.pointerId) return
    const viewport = viewportRef.current
    if (!viewport) return
    const dx = event.clientX - pan.startX
    const dy = event.clientY - pan.startY
    if (!pan.moved) {
      if (Math.abs(dx) + Math.abs(dy) < 5) return
      pan.moved = true
      setPanning(true)
    }
    viewport.scrollLeft = pan.scrollLeft - dx
    viewport.scrollTop = pan.scrollTop - dy
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const pan = panRef.current
    if (!pan || pan.pointerId !== event.pointerId) return
    panRef.current = null
    setPanning(false)
    if (viewportRef.current?.hasPointerCapture(event.pointerId)) viewportRef.current.releasePointerCapture(event.pointerId)
    if (pan.moved) {
      suppressClickRef.current = true
      window.setTimeout(() => { suppressClickRef.current = false }, 0)
    }
  }

  function handleClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (!suppressClickRef.current) return
    event.preventDefault()
    event.stopPropagation()
  }

  return {
    panning,
    panHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
      onClickCapture: handleClickCapture,
    },
  }
}
