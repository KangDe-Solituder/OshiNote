import { useEffect, type RefObject } from 'react'

/** Keep floating menus and confirmation/fullscreen layers usable above a preview. */
export function usePreviewDismiss(ref: RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    const hasOverlay = () => document.querySelector('[aria-modal="true"], [data-preview-overlay]') !== null
    const onClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element) || ref.current?.contains(target) || hasOverlay()) return
      if (target.closest('[role="listbox"], [role="menu"], .menu-scroll')) return
      onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !hasOverlay() && !document.querySelector('[role="listbox"], [role="menu"]')) onClose()
    }
    document.addEventListener('click', onClick, true)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [ref, onClose])
}
