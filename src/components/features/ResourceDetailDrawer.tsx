import { useEffect, useId, useRef, type ReactNode } from 'react'
import { motion, useIsPresent } from 'framer-motion'
import { PackageOpen, X } from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'
import { useMotionTiming, MOTION_EASING } from './themes/uiMotion'
import { OVERLAY_Z_INDEX } from '../ui/overlay'
import { usePreviewDismiss } from './usePreviewDismiss'

export function ResourceDetailDrawer({ resourceId, title, category, onClose, children }: {
  resourceId: string; title: string; category: string; onClose: () => void; children: ReactNode
}) {
  const { locale } = useI18n()
  const titleId = useId()
  const closeButton = useRef<HTMLButtonElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const drawer = useRef<HTMLElement>(null)
  usePreviewDismiss(drawer, onClose)
  const timing = useMotionTiming()
  const present = useIsPresent()
  const closeLabel = locale === 'zh' ? '关闭预览' : locale === 'ja' ? 'プレビューを閉じる' : 'Close preview'
  useEffect(() => { content.current?.scrollTo(0, 0) }, [resourceId])
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    closeButton.current?.focus({ preventScroll: true })
    return () => {
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [onClose])
  return (
    <motion.aside ref={drawer} inert={!present} role="dialog" aria-modal="false" aria-labelledby={titleId}
      initial={{ opacity: 0, x: timing.viewEnter === 0 ? 0 : 28 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: timing.viewExit === 0 ? 0 : 28, pointerEvents: 'none', transition: { duration: timing.viewExit, ease: MOTION_EASING.exit } }}
      transition={{ duration: timing.viewEnter, ease: MOTION_EASING.enter }}
      className="resource-detail-drawer absolute right-0 top-0 flex h-full w-[min(440px,100%)] flex-col border-l border-border-color bg-bg-primary text-text-primary shadow-2xl"
      style={{ zIndex: OVERLAY_Z_INDEX.drawer }}>
      <header className="flex shrink-0 items-center gap-3 border-b border-border-color p-4">
        <span className="rounded-xl bg-accent-soft/25 p-2 text-accent"><PackageOpen size={20} /></span>
        <div className="min-w-0 flex-1"><p className="text-xs text-text-muted">{category}</p><h2 id={titleId} className="truncate font-semibold">{title}</h2></div>
        <button ref={closeButton} type="button" onClick={onClose} aria-label={closeLabel} title={closeLabel}
          className="rounded-lg p-2 text-text-muted hover:bg-bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><X size={20} /></button>
      </header>
      <div ref={content} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">{children}</div>
    </motion.aside>)
}
