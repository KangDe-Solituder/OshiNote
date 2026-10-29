import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { MOTION_EASING, useMotionTiming } from '../features/themes/uiMotion'
import { OVERLAY_Z_INDEX } from './overlay'

const openModals: string[] = []

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  contentClassName?: string
}

export function Modal({ open, onClose, title, children, contentClassName }: ModalProps) {
  const timing = useMotionTiming()
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose }, [onClose])

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    openModals.push(titleId)
    const focusables = () => Array.from(panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]') || []).filter(el => el.getClientRects().length && !el.closest('[inert]'))
    const frame = requestAnimationFrame(() => (focusables()[0] || panelRef.current)?.focus())
    const handler = (event: KeyboardEvent) => {
      if (openModals.at(-1) !== titleId || event.defaultPrevented) return
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); return }
      if (event.key !== 'Tab') return
      const items = focusables()
      const first = items[0]; const last = items.at(-1)
      if (!first) { event.preventDefault(); panelRef.current?.focus(); return }
      if (!panelRef.current?.contains(document.activeElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
        event.preventDefault(); (event.shiftKey ? last : first)?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => {
      cancelAnimationFrame(frame)
      openModals.splice(openModals.lastIndexOf(titleId), 1)
      window.removeEventListener('keydown', handler)
      if (previous?.isConnected) previous.focus()
    }
  }, [open, titleId])

  const modal = (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: OVERLAY_Z_INDEX.modal }}>
          <motion.div
            className="absolute inset-0 bg-black/30 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: timing.viewEnter, ease: MOTION_EASING.standard } }}
            exit={{ opacity: 0, transition: { duration: timing.viewExit, ease: MOTION_EASING.exit } }}
            onClick={onClose}
          />
          <motion.div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}
            className={`relative mx-4 max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-border-color bg-bg-primary p-6 shadow-e3 ${contentClassName || 'max-w-lg'}`}
            initial={{ opacity: 0, scale: timing.viewEnter === 0 ? 1 : 0.975, y: timing.viewEnter === 0 ? 0 : 8 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              transition: { duration: timing.viewEnter, ease: MOTION_EASING.enter },
            }}
            exit={{
              opacity: 0,
              scale: timing.viewExit === 0 ? 1 : 0.99,
              y: timing.viewExit === 0 ? 0 : 4,
              transition: { duration: timing.viewExit, ease: MOTION_EASING.exit },
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id={titleId} className="text-lg font-semibold text-text-primary">{title}</h2>
              <button aria-label="Close" onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
                <X size={20} />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )

  return typeof document === 'undefined' ? modal : createPortal(modal, document.body)
}
