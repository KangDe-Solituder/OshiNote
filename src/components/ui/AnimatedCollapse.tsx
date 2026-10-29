import { useId, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useIsPresent } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { MOTION_EASING, useMotionTiming } from '../features/themes/uiMotion'

export function AnimatedCollapse({ open, children, id }: { open: boolean; children: ReactNode; id?: string }) {
  return <AnimatePresence initial={false}>{open && <CollapseBody key="content" id={id}>{children}</CollapseBody>}</AnimatePresence>
}

function CollapseBody({ children, id }: { children: ReactNode; id?: string }) {
  const timing = useMotionTiming()
  const present = useIsPresent()
  return <motion.div id={id} inert={!present} className="overflow-hidden"
    initial={{ height: 0, opacity: 0 }}
    animate={{ height: 'auto', opacity: 1, transition: { duration: timing.viewEnter, ease: MOTION_EASING.enter } }}
    exit={{ height: 0, opacity: 0, transition: { duration: timing.viewExit, ease: MOTION_EASING.exit } }}>
    {children}
  </motion.div>
}

export function AnimatedDisclosure({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return <div className={className}>
    <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}
      className="flex items-center gap-2 rounded-md text-sm text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
      <ChevronDown aria-hidden="true" size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />{title}
    </button>
    <AnimatedCollapse open={open} id={id}>{children}</AnimatedCollapse>
  </div>
}
