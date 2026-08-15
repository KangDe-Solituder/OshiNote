import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { MOTION_EASING, useMotionTiming } from '../features/themes/uiMotion'
import { OVERLAY_Z_INDEX } from './overlay'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  contentClassName?: string
}

export function Modal({ open, onClose, title, children, contentClassName }: ModalProps) {
  const timing = useMotionTiming()

  useEffect(() => {
    if (open) {
      const handler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose()
      }
      window.addEventListener('keydown', handler)
      return () => window.removeEventListener('keydown', handler)
    }
  }, [open, onClose])

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
          <motion.div
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
              <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
              <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
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
