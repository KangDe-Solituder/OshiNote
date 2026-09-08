import { useCallback } from 'react'

/**
 * Attach to a scrollable element styled with the `.scroll-fade` class: the
 * Reveal the scrollbar on pointer/wheel activity, then hide it after 900ms of
 * inactivity, even if the pointer stays over the element. An optional ancestor
 * selector extends the activity area to the whole card.
 */
export function useAutoHideScroll<T extends HTMLElement>(activitySelector?: string) {
  return useCallback((el: T | null) => {
    if (!el) return
    const scrollElement = el
    const activityArea = activitySelector ? el.closest(activitySelector) || el : el
    let timer: number | null = null
    let pointerDown = false

    function reveal() {
      scrollElement.classList.add('is-scroll-active')
      if (timer !== null) window.clearTimeout(timer)
      timer = pointerDown ? null : window.setTimeout(() => scrollElement.classList.remove('is-scroll-active'), 900)
    }

    function startPointer() {
      pointerDown = true
      reveal()
    }

    function endPointer() {
      if (!pointerDown) return
      pointerDown = false
      reveal()
    }

    el.addEventListener('scroll', reveal, { passive: true })
    activityArea.addEventListener('wheel', reveal, { passive: true })
    activityArea.addEventListener('pointerenter', reveal, { passive: true })
    activityArea.addEventListener('pointermove', reveal, { passive: true })
    activityArea.addEventListener('pointerdown', startPointer, { passive: true })
    window.addEventListener('pointerup', endPointer)
    window.addEventListener('pointercancel', endPointer)
    window.addEventListener('blur', endPointer)
    return () => {
      el.removeEventListener('scroll', reveal)
      activityArea.removeEventListener('wheel', reveal)
      activityArea.removeEventListener('pointerenter', reveal)
      activityArea.removeEventListener('pointermove', reveal)
      activityArea.removeEventListener('pointerdown', startPointer)
      window.removeEventListener('pointerup', endPointer)
      window.removeEventListener('pointercancel', endPointer)
      window.removeEventListener('blur', endPointer)
      if (timer !== null) window.clearTimeout(timer)
      el.classList.remove('is-scroll-active')
    }
  }, [activitySelector])
}
