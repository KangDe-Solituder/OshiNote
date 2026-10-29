import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { MOTION_EASING, useMotionTiming } from '../features/themes/uiMotion'

/** Only replay when the displayed collection/view changes, never on selection or typing in an editor. */
export function ContentTransition({ changeKey, className, children }: {
  changeKey: string | number; className?: string; children: ReactNode
}) {
  const timing = useMotionTiming()
  return <AnimatePresence initial={false}><motion.div key={changeKey} className={className}
    initial={timing.viewEnter ? { opacity: 0.65, y: 3 } : false}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: timing.viewEnter, ease: MOTION_EASING.enter }}>
    {children}
  </motion.div></AnimatePresence>
}
