import clsx from 'clsx'
import { GripHorizontal, GripVertical, Pin, PinOff } from 'lucide-react'
import { useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { useI18n } from '../../../i18n/useI18n'
import type { JournalDrawerDock } from './journalCreationTypes'

export function JournalEdgeDrawer({
  open,
  pinned,
  dock,
  motionSeconds,
  label,
  children,
  onPinnedChange,
  onDockChange,
  onHoverChange,
}: {
  open: boolean
  pinned: boolean
  dock: JournalDrawerDock
  motionSeconds: number
  label: string
  children: ReactNode
  onPinnedChange: (value: boolean) => void
  onDockChange: (value: JournalDrawerDock) => void
  onHoverChange: (value: boolean) => void
}) {
  const { t } = useI18n()
  const dragRef = useRef<{ x: number; y: number; dragging: boolean } | null>(null)
  const [dockHint, setDockHint] = useState<JournalDrawerDock | null>(null)
  const horizontal = dock === 'top' || dock === 'bottom'
  const animated = motionSeconds > 0
  // Same easing family as the work board tray so both drawers feel identical.
  const panelTransition = { duration: motionSeconds + 0.16, ease: [0.16, 1, 0.3, 1] as const }
  const closedOffset = dock === 'left' || dock === 'top' ? '-100%' : '100%'
  const panelAnimate = open
    ? { opacity: 1, ...(horizontal ? { y: 0 } : { x: 0 }) }
    : { opacity: 0, ...(horizontal ? { y: closedOffset } : { x: closedOffset }) }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { x: event.clientX, y: event.clientY, dragging: false }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag) return
    if (Math.abs(event.clientX - drag.x) + Math.abs(event.clientY - drag.y) > 8) {
      drag.dragging = true
      setDockHint(getDockFromPoint(event.clientX, event.clientY))
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    dragRef.current = null
    setDockHint(null)
    event.currentTarget.releasePointerCapture(event.pointerId)
    if (!drag?.dragging) return
    const nextDock = getDockFromPoint(event.clientX, event.clientY)
    if (nextDock) onDockChange(nextDock)
  }

  return (
    <aside
      className={clsx('pointer-events-none absolute z-[60]', getDrawerOuterClass(dock))}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      <motion.div
        initial={false}
        animate={animated ? panelAnimate : open ? { opacity: 1, ...(horizontal ? { y: 0 } : { x: 0 }) } : { opacity: 0, ...(horizontal ? { y: closedOffset } : { x: closedOffset }) }}
        transition={panelTransition}
        className={clsx(
          'isolate overflow-hidden border-border-color bg-bg-primary shadow-xl',
          open ? 'pointer-events-auto' : 'pointer-events-none',
          getDrawerPanelPositionClass(dock),
          horizontal ? 'h-[300px] max-h-[45vh] w-full border-b' : 'h-full w-80 border-r',
          dock === 'right' && 'border-l border-r-0',
          dock === 'bottom' && 'border-t border-b-0'
        )}
      >
        <div
          className="flex h-14 cursor-grab touch-none items-center justify-between gap-3 border-b border-border-color px-4 active:cursor-grabbing"
          title={t('journalCreate.drawer.drag')}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            dragRef.current = null
            setDockHint(null)
          }}
        >
          <span className="text-text-muted">{horizontal ? <GripHorizontal size={17} /> : <GripVertical size={17} />}</span>
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary">{label}</h2>
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onPinnedChange(!pinned)}
            className={clsx('rounded-lg p-2 transition-colors hover:bg-bg-secondary hover:text-accent', pinned ? 'text-accent' : 'text-text-muted')}
            title={pinned ? t('journalCreate.drawer.unpin') : t('journalCreate.drawer.pin')}
          >
            {pinned ? <PinOff size={16} /> : <Pin size={16} />}
          </button>
        </div>
        <div className="h-[calc(100%-3.5rem)] min-w-0 overflow-x-hidden overflow-y-auto p-3">{children}</div>
      </motion.div>
      {!open && <button type="button" aria-label={label} onFocus={() => onHoverChange(true)} onMouseEnter={() => onHoverChange(true)} className={clsx('pointer-events-auto absolute opacity-0', horizontal ? 'left-0 right-0 h-2' : 'bottom-0 top-0 w-2', dock === 'right' ? 'right-0' : dock === 'bottom' ? 'bottom-0' : dock === 'top' ? 'top-0' : 'left-0')} />}
      {dockHint ? <div className={clsx('pointer-events-none absolute rounded-2xl border-2 border-accent/70 bg-accent-soft/25 transition-opacity', getDockHintClass(dockHint))} /> : null}
    </aside>
  )
}

function getDrawerOuterClass(dock: JournalDrawerDock): string {
  if (dock === 'left') return 'bottom-0 left-0 top-0 md:left-20'
  if (dock === 'right') return 'bottom-0 right-0 top-0'
  if (dock === 'top') return 'left-0 right-0 top-0 md:left-20'
  return 'bottom-0 left-0 right-0 md:left-20'
}

function getDrawerPanelPositionClass(dock: JournalDrawerDock): string {
  if (dock === 'left') return 'absolute bottom-0 left-0 top-0'
  if (dock === 'right') return 'absolute bottom-0 right-0 top-0'
  if (dock === 'top') return 'absolute left-0 right-0 top-0'
  return 'absolute bottom-0 left-0 right-0'
}

function getDockHintClass(dock: JournalDrawerDock): string {
  if (dock === 'left') return 'bottom-4 left-4 top-4 w-10'
  if (dock === 'right') return 'bottom-4 right-4 top-4 w-10'
  if (dock === 'top') return 'left-4 right-4 top-4 h-10'
  return 'bottom-4 left-4 right-4 h-10'
}

function getDockFromPoint(clientX: number, clientY: number): JournalDrawerDock | null {
  const width = window.innerWidth || 1
  const height = window.innerHeight || 1
  const xRatio = clientX / width
  const yRatio = clientY / height
  if (xRatio <= 0.2) return 'left'
  if (xRatio >= 0.8) return 'right'
  if (yRatio <= 0.2) return 'top'
  if (yRatio >= 0.8) return 'bottom'
  return null
}
