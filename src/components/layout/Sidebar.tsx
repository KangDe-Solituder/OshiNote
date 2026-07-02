import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { NavLink, useLocation, useParams } from 'react-router-dom'
import { ChevronDown, Download, FileText, Home, ImageIcon, Plus, Settings, Tag } from 'lucide-react'
import clsx from 'clsx'
import type { Oshi } from '../../types'
import { useI18n } from '../../i18n/useI18n'
import { useOshiStore } from '../../stores/oshiStore'
import { SIDEBAR_WIDTH, useSidebarStore } from '../../stores/sidebarStore'
import { useUiMotionSeconds } from '../features/themes/uiMotion'

interface OshiSpaceItem {
  to: string
  icon: typeof Home
  label: string
  end?: boolean
}

export function Sidebar() {
  const { t } = useI18n()
  const motionSeconds = useUiMotionSeconds()
  const location = useLocation()
  const { oshiId } = useParams<{ oshiId: string }>()
  const { oshis, fetchAll } = useOshiStore()
  const {
    collapsed,
    width,
    dragEnabled,
    setWidth,
    snapWidth,
  } = useSidebarStore()
  const [dragging, setDragging] = useState(false)
  const [oshiExpansionOverrides, setOshiExpansionOverrides] = useState<Record<string, boolean>>({})
  const dragStartRef = useRef<{ pointerX: number; width: number }>({ pointerX: 0, width: SIDEBAR_WIDTH.standard })

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  useEffect(() => {
    if (!dragging) return

    function handlePointerMove(event: PointerEvent) {
      const delta = event.clientX - dragStartRef.current.pointerX
      setWidth(dragStartRef.current.width + delta)
    }

    function handlePointerUp() {
      setDragging(false)
      snapWidth()
    }

    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [dragging, setWidth, snapWidth])

  const sidebarWidth = collapsed ? SIDEBAR_WIDTH.collapsed : width
  const compact = sidebarWidth < 132

  return (
    <motion.aside
      animate={{ width: sidebarWidth }}
      transition={{ duration: dragging ? 0 : motionSeconds, ease: 'easeOut' }}
      className="relative flex h-full shrink-0 flex-col overflow-hidden border-r bg-bg-primary/40 backdrop-blur-md [border-color:var(--color-shell-border)]"
    >
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-4">
        <SidebarSection title={t('nav.myOshis')} compact={compact}>
          {oshis.map((oshi) => {
            const expanded = oshiExpansionOverrides[oshi.id] ?? oshiId === oshi.id
            return (
              <OshiNavGroup
                key={oshi.id}
                oshi={oshi}
                compact={compact}
                expanded={expanded}
                items={createOshiSpaceItems(oshi.id, t)}
                pathname={location.pathname}
                onToggle={() => {
                  setOshiExpansionOverrides((overrides) => ({ ...overrides, [oshi.id]: !expanded }))
                }}
              />
            )
          })}

          <SidebarLink to="/oshis" icon={Plus} label={t('nav.addOshi')} compact={compact} exactActive={location.pathname === '/oshis'} />
        </SidebarSection>
      </nav>

      <div className="shrink-0 px-2 py-2.5">
        <div className="mx-auto w-full max-w-[188px] space-y-1">
          <SidebarLink to="/" icon={Home} label={t('nav.home')} compact={compact} exactActive={location.pathname === '/'} />
          <SidebarLink to="/export" icon={Download} label={t('nav.export')} compact={compact} exactActive={location.pathname.startsWith('/export')} />
          <SidebarLink to="/settings" icon={Settings} label={t('nav.settings')} compact={compact} exactActive={location.pathname.startsWith('/settings')} />
        </div>
      </div>

      {dragEnabled && (
        <button
          type="button"
          className={clsx(
            'absolute right-0 top-0 h-full w-2 cursor-col-resize bg-transparent transition-colors hover:bg-accent/25',
            dragging && 'bg-accent/40'
          )}
          title={t('sidebar.resize')}
          aria-label={t('sidebar.resize')}
          onPointerDown={(event) => {
            event.preventDefault()
            dragStartRef.current = { pointerX: event.clientX, width: sidebarWidth }
            setDragging(true)
          }}
        />
      )}
    </motion.aside>
  )
}

function SidebarSection({ title, compact, children }: { title: string; compact: boolean; children: ReactNode }) {
  return (
    <section className="space-y-1">
      {!compact && (
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">{title}</p>
      )}
      <div className="space-y-1">{children}</div>
    </section>
  )
}

function OshiNavGroup({
  oshi,
  compact,
  expanded,
  items,
  pathname,
  onToggle,
}: {
  oshi: Oshi
  compact: boolean
  expanded: boolean
  items: OshiSpaceItem[]
  pathname: string
  onToggle: () => void
}) {
  const { t } = useI18n()
  const overviewActive = pathname === `/oshis/${oshi.id}`
  const toggleTitle = expanded ? t('nav.collapseSection', { title: oshi.name }) : t('nav.expandSection', { title: oshi.name })

  return (
    <div className={clsx('rounded-2xl', !compact && 'p-1', expanded && !compact && 'bg-bg-secondary/30')}>
      <div className="flex items-center gap-1">
        <NavLink
          to={`/oshis/${oshi.id}`}
          className={clsx(
            'flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 transition-colors',
            compact && 'justify-center px-2',
            overviewActive
              ? 'bg-accent/10 text-accent font-semibold'
              : expanded
                ? 'text-text-primary hover:bg-bg-secondary/40'
                : 'text-text-secondary hover:bg-bg-secondary/40 hover:text-text-primary'
          )}
          title={oshi.name}
        >
          <OshiAvatar name={oshi.name} avatar={oshi.avatar} color={oshi.color} />
          {!compact && <span className="truncate text-sm">{oshi.name}</span>}
        </NavLink>
        {!compact && (
          <button
            type="button"
            onClick={onToggle}
            className="flex h-9 w-8 shrink-0 items-center justify-center rounded-xl text-text-muted transition-colors hover:bg-bg-secondary/40 hover:text-text-primary"
            title={toggleTitle}
            aria-label={toggleTitle}
          >
            <ChevronDown size={14} className={clsx('transition-transform', !expanded && '-rotate-90')} />
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            className={clsx('mt-1 overflow-hidden', compact ? '' : 'pl-3')}
          >
            <div className="grid gap-1">
              {items.map((item) => {
                const isActive = pathname === item.to || (!item.end && pathname.startsWith(item.to))
                return (
                  <SidebarLink
                    key={item.to}
                    to={item.to}
                    icon={item.icon}
                    label={item.label}
                    compact={compact}
                    exactActive={isActive}
                    iconSize={compact ? 20 : 18}
                  />
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SidebarLink({
  to,
  icon: Icon,
  label,
  compact,
  exactActive,
  iconSize = 20,
}: {
  to: string
  icon: typeof Home
  label: string
  compact: boolean
  exactActive: boolean
  iconSize?: number
}) {
  return (
    <NavLink
      to={to}
      className={clsx(
        'flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
        compact && 'justify-center px-2',
        exactActive
          ? 'bg-accent/10 text-accent font-semibold'
          : 'text-text-secondary hover:bg-bg-secondary/40 hover:text-text-primary'
      )}
      title={label}
    >
      <Icon size={iconSize} className="shrink-0" />
      {!compact && <span className="truncate">{label}</span>}
    </NavLink>
  )
}

function createOshiSpaceItems(oshiId: string, t: ReturnType<typeof useI18n>['t']): OshiSpaceItem[] {
  return [
    { to: `/oshis/${oshiId}`, icon: Home, label: t('nav.overview'), end: true },
    { to: `/oshis/${oshiId}/notes`, icon: FileText, label: t('nav.notes') },
    { to: `/oshis/${oshiId}/illustrations`, icon: ImageIcon, label: t('nav.illustrations') },
    { to: `/oshis/${oshiId}/tags`, icon: Tag, label: t('nav.tags') },
  ]
}

function OshiAvatar({ name, avatar, color }: { name: string; avatar?: string; color?: string }) {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white shadow-sm"
      style={{ backgroundColor: color || '#EC4899' }}
    >
      {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : name.charAt(0).toUpperCase()}
    </span>
  )
}
