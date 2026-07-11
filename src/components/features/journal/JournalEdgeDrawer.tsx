import clsx from 'clsx'
import { GripHorizontal, GripVertical, Pin, PinOff } from 'lucide-react'
import { useRef, useState, type PointerEvent, type ReactNode } from 'react'
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
      className={clsx('pointer-events-none absolute z-[60] transition-[inset,opacity] duration-200', getDrawerOuterClass(dock))}
      style={{ transitionDuration: `${motionSeconds}s` }}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      <div
        className={clsx(
          'pointer-events-auto border-border-color bg-bg-card/95 shadow-xl backdrop-blur transition-[opacity,transform] duration-200 ease-out',
          getDrawerPanelPositionClass(dock),
          horizontal ? 'h-[300px] max-h-[45vh] w-full border-b' : 'h-full w-80 border-r',
          dock === 'right' && 'border-l border-r-0',
          dock === 'bottom' && 'border-t border-b-0',
          open ? 'translate-x-0 translate-y-0 opacity-100' : getDrawerClosedClass(dock)
        )}
        style={{ transitionDuration: `${motionSeconds}s` }}
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
        <div className="h-[calc(100%-3.5rem)] overflow-y-auto p-3">{children}</div>
      </div>
      <button
        type="button"
        onClick={() => onPinnedChange(!pinned)}
        className={clsx(
          'pointer-events-auto flex items-center justify-center border-border-color bg-bg-card text-xs font-semibold text-accent shadow-sm transition-transform duration-200',
          open && 'pointer-events-none opacity-0',
          getDrawerHandleClass(dock)
        )}
        style={{ transitionDuration: `${motionSeconds}s` }}
      >
        <span className={horizontal ? '' : '[writing-mode:vertical-rl]'}>{label}</span>
      </button>
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

function getDrawerClosedClass(dock: JournalDrawerDock): string {
  if (dock === 'left') return '-translate-x-full opacity-0'
  if (dock === 'right') return 'translate-x-full opacity-0'
  if (dock === 'top') return '-translate-y-full opacity-0'
  return 'translate-y-full opacity-0'
}

function getDrawerHandleClass(dock: JournalDrawerDock): string {
  if (dock === 'left') return 'absolute left-0 top-20 h-28 w-8 rounded-r-xl border-y border-r'
  if (dock === 'right') return 'absolute right-0 top-20 h-28 w-8 rounded-l-xl border-y border-l'
  if (dock === 'top') return 'absolute left-1/2 top-0 h-8 w-28 -translate-x-1/2 rounded-b-xl border-x border-b'
  return 'absolute bottom-0 left-1/2 h-8 w-28 -translate-x-1/2 rounded-t-xl border-x border-t'
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
