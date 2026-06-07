import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { NavLink, useLocation, useParams } from 'react-router-dom'
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Home,
  ImageIcon,
  Plus,
  Settings,
  Tag,
} from 'lucide-react'
import { useSidebarStore } from '../../stores/sidebarStore'
import { useOshiStore } from '../../stores/oshiStore'
import appIconUrl from '../../assets/app-icon.svg'
import clsx from 'clsx'
import type { Oshi } from '../../types'
import { useUiMotionSeconds } from '../features/themes/uiMotion'

interface OshiSpaceItem {
  to: string
  icon: typeof BookOpen
  label: string
}

const libraryNavItems = [
  { to: '/notes', icon: FileText, label: 'All Notes' },
  { to: '/illustrations', icon: ImageIcon, label: 'Illustrations' },
  { to: '/tags', icon: Tag, label: 'Tags' },
]

const moreNavItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/export', icon: Download, label: 'Export' },
]

export function Sidebar() {
  const { collapsed, toggle } = useSidebarStore()
  const motionSeconds = useUiMotionSeconds()
  const { oshiId } = useParams<{ oshiId: string }>()
  const location = useLocation()
  const { oshis, fetchAll } = useOshiStore()
  const [openSections, setOpenSections] = useState({
    oshis: true,
    library: true,
    more: true,
  })
  const [expandedOshiIds, setExpandedOshiIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  useEffect(() => {
    if (!oshiId) return
    setExpandedOshiIds((ids) => {
      if (ids.has(oshiId)) return ids
      const next = new Set(ids)
      next.add(oshiId)
      return next
    })
  }, [oshiId])

  const createOshiSpaceItems = (id: string): OshiSpaceItem[] => [
    { to: `/oshis/${id}`, icon: Home, label: 'Overview' },
    { to: `/oshis/${id}/notes`, icon: FileText, label: 'Notes' },
    { to: `/oshis/${id}/journal`, icon: BookOpen, label: 'Journal' },
    { to: `/oshis/${id}/illustrations`, icon: ImageIcon, label: 'Illustrations' },
    { to: `/oshis/${id}/tags`, icon: Tag, label: 'Tags' },
  ]

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: motionSeconds, ease: 'easeOut' }}
      className="h-full flex flex-col border-r border-border-color bg-bg-secondary/50 backdrop-blur-md shrink-0 overflow-hidden"
    >
      <div
        className={clsx(
          'flex h-20 shrink-0 items-center border-b border-border-color bg-bg-primary/95',
          collapsed ? 'justify-center px-0' : 'gap-3 px-6'
        )}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={toggle}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl hover:bg-bg-tertiary focus:outline-none focus:ring-2 focus:ring-accent-soft"
            title="Expand sidebar"
          >
            <img src={appIconUrl} alt="OshiNote" className="block h-8 w-8 min-w-8 shrink-0 object-contain" />
          </button>
        ) : (
          <motion.div
            key="logo"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="flex items-center gap-2.5"
          >
            <img src={appIconUrl} alt="OshiNote" className="block h-7 w-7 min-w-7 shrink-0 object-contain" />
            <span className="text-lg font-bold text-accent truncate">OshiNote</span>
          </motion.div>
        )}
        {!collapsed && (
          <button
            onClick={toggle}
            className="ml-auto rounded-lg p-1.5 text-text-muted transition-colors hover:bg-bg-tertiary hover:text-text-primary"
            title="Collapse sidebar"
          >
            <ChevronLeft size={18} />
          </button>
        )}
      </div>

      <nav className="flex flex-1 flex-col overflow-y-auto px-2 py-4">
        <SidebarSection
          title="My Oshis"
          collapsed={collapsed}
          open={openSections.oshis}
          motionSeconds={motionSeconds}
          onToggle={() => setOpenSections((sections) => ({ ...sections, oshis: !sections.oshis }))}
        >
          {oshis.map((oshi) => (
            <OshiNavGroup
              key={oshi.id}
              oshi={oshi}
              collapsed={collapsed}
              expanded={expandedOshiIds.has(oshi.id)}
              items={createOshiSpaceItems(oshi.id)}
              pathname={location.pathname}
              onToggle={() => setExpandedOshiIds((ids) => {
                const next = new Set(ids)
                if (next.has(oshi.id)) {
                  next.delete(oshi.id)
                } else {
                  next.add(oshi.id)
                }
                return next
              })}
            />
          ))}

          <NavLink
            to="/oshis"
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200',
                collapsed && 'justify-center px-2',
                isActive && location.pathname === '/oshis'
                  ? 'bg-accent/10 text-accent font-semibold'
                  : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
              )
            }
          >
            <Plus size={20} className="shrink-0" />
            <SidebarLabel collapsed={collapsed}>Add Oshi</SidebarLabel>
          </NavLink>
        </SidebarSection>

        <SidebarSection
          title="Library"
          collapsed={collapsed}
          open={openSections.library}
          motionSeconds={motionSeconds}
          onToggle={() => setOpenSections((sections) => ({ ...sections, library: !sections.library }))}
          className="mt-auto"
        >
          {libraryNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group',
                  collapsed && 'justify-center px-2',
                  isActive
                    ? 'bg-accent/10 text-accent font-semibold'
                    : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
                )
              }
            >
              <item.icon size={20} className="shrink-0" />
              <SidebarLabel collapsed={collapsed}>{item.label}</SidebarLabel>
            </NavLink>
          ))}
        </SidebarSection>

        <SidebarSection
          title="More"
          collapsed={collapsed}
          open={openSections.more}
          motionSeconds={motionSeconds}
          onToggle={() => setOpenSections((sections) => ({ ...sections, more: !sections.more }))}
        >
          {moreNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group',
                  collapsed && 'justify-center px-2',
                  isActive
                    ? 'bg-accent/10 text-accent font-semibold'
                    : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
                )
              }
            >
              <item.icon size={20} className="shrink-0" />
              <SidebarLabel collapsed={collapsed}>{item.label}</SidebarLabel>
            </NavLink>
          ))}
        </SidebarSection>
      </nav>

      <div className="px-2 pb-3">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
              collapsed && 'justify-center px-2',
              isActive
                ? 'bg-accent/10 text-accent font-semibold'
                : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
            )
          }
        >
          <Settings size={20} className="shrink-0" />
          <AnimatePresence mode="wait">
            {!collapsed && (
              <motion.span
                key="label"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="text-sm truncate"
              >
                Settings
              </motion.span>
            )}
          </AnimatePresence>
        </NavLink>
      </div>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-4 pb-3"
          >
            <p className="text-xs text-text-muted">OshiNote v0.1.0</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  )
}

function SidebarSection({
  title,
  collapsed,
  open,
  motionSeconds,
  onToggle,
  className,
  children,
}: {
  title: string
  collapsed: boolean
  open: boolean
  motionSeconds: number
  onToggle?: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={clsx('mb-5 space-y-1', className)}>
      <AnimatePresence>
        {!collapsed && (
          <motion.button
            type="button"
            onClick={onToggle}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="flex w-full items-center justify-between rounded-lg px-3 pb-1 pt-1 text-left text-[11px] font-semibold uppercase tracking-wide text-text-muted transition-colors hover:bg-bg-tertiary hover:text-text-secondary"
            title={open ? `Collapse ${title}` : `Expand ${title}`}
          >
            <span>{title}</span>
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </motion.button>
        )}
      </AnimatePresence>
      <div
        className="grid overflow-hidden"
        style={{
          gridTemplateRows: collapsed || open ? '1fr' : '0fr',
          transitionProperty: 'grid-template-rows',
          transitionDuration: `${motionSeconds}s`,
          transitionDelay: collapsed || open || motionSeconds === 0 ? '0s' : `${motionSeconds * 0.65}s`,
          transitionTimingFunction: 'ease-out',
        }}
      >
        <div
          className="min-h-0 overflow-hidden"
          style={{
            opacity: collapsed || open ? 1 : 0,
            transform: collapsed || open ? 'translateX(0)' : 'translateX(-8px)',
            transitionProperty: 'opacity, transform',
            transitionDuration: `${motionSeconds === 0 ? 0 : Math.max(0.08, motionSeconds * 0.55)}s`,
            transitionDelay: collapsed || open ? `${motionSeconds}s` : '0s',
            transitionTimingFunction: 'ease-out',
          }}
        >
          {children}
        </div>
      </div>
    </section>
  )
}

function OshiNavGroup({
  oshi,
  collapsed,
  expanded,
  items,
  pathname,
  onToggle,
}: {
  oshi: Oshi
  collapsed: boolean
  expanded: boolean
  items: OshiSpaceItem[]
  pathname: string
  onToggle: () => void
}) {
  return (
    <div className={clsx('rounded-2xl', expanded && !collapsed && 'bg-bg-tertiary/40 p-1')}>
      <div className="flex items-center gap-1">
        <NavLink
          to={`/oshis/${oshi.id}`}
          className={({ isActive }) =>
            clsx(
              'flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200',
              collapsed && 'justify-center px-2',
              isActive && pathname === `/oshis/${oshi.id}`
                ? 'bg-accent/10 text-accent font-semibold'
                : expanded
                  ? 'text-text-primary hover:bg-bg-secondary'
                  : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
            )
          }
          title={oshi.name}
        >
          <OshiAvatar name={oshi.name} avatar={oshi.avatar} color={oshi.color} />
          <SidebarLabel collapsed={collapsed}>{oshi.name}</SidebarLabel>
        </NavLink>
        {!collapsed && (
          <button
            type="button"
            onClick={onToggle}
            className="flex h-9 w-8 shrink-0 items-center justify-center rounded-xl text-text-muted transition-colors hover:bg-bg-secondary hover:text-text-primary"
            title={expanded ? `Collapse ${oshi.name}` : `Expand ${oshi.name}`}
          >
            <ChevronDown size={14} className={clsx('transition-transform', !expanded && '-rotate-90')} />
          </button>
        )}
      </div>

      {expanded && (
        <div className={clsx('mt-1 grid gap-1', collapsed ? '' : 'pl-3')}>
          {items.map((item) => {
            const isActive = pathname === item.to || (item.to !== `/oshis/${oshi.id}` && pathname.startsWith(item.to))
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={clsx(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200',
                  collapsed && 'justify-center px-2',
                  isActive
                    ? 'bg-accent/10 text-accent font-semibold'
                    : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
                )}
                title={item.label}
              >
                <item.icon size={collapsed ? 20 : 18} className="shrink-0" />
                <SidebarLabel collapsed={collapsed}>{item.label}</SidebarLabel>
              </NavLink>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SidebarLabel({ collapsed, children }: { collapsed: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence mode="wait">
      {!collapsed && (
        <motion.span
          key="label"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          className="text-sm truncate"
        >
          {children}
        </motion.span>
      )}
    </AnimatePresence>
  )
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
