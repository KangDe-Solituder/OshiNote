import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { NavLink, useLocation, useParams } from 'react-router-dom'
import {
  BookOpen,
  ChevronLeft,
  Download,
  FileText,
  Home,
  Plus,
  Settings,
  Tag,
  Wand2,
} from 'lucide-react'
import { useSidebarStore } from '../../stores/sidebarStore'
import { useOshiStore } from '../../stores/oshiStore'
import { useNoteStore } from '../../stores/noteStore'
import appIconUrl from '../../assets/app-icon.svg'
import clsx from 'clsx'
import type { ViewMode } from '../../types'
import { useUiMotionSeconds } from '../features/themes/uiMotion'

interface OshiSpaceItem {
  to: string
  icon: typeof BookOpen
  label: string
  mode?: ViewMode
}

const globalNavItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/notes', icon: FileText, label: 'All Notes' },
  { to: '/ai', icon: Wand2, label: 'AI Tools' },
  { to: '/export', icon: Download, label: 'Export' },
]

export function Sidebar() {
  const { collapsed, toggle } = useSidebarStore()
  const motionSeconds = useUiMotionSeconds()
  const { oshiId } = useParams<{ oshiId: string }>()
  const location = useLocation()
  const { oshis, fetchAll } = useOshiStore()
  const viewMode = useNoteStore((s) => s.viewMode)
  const setViewMode = useNoteStore((s) => s.setViewMode)
  const activeOshi = oshis.find((oshi) => oshi.id === oshiId) || oshis[0]
  const activeOshiId = oshiId || activeOshi?.id

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const oshiSpaceItems: OshiSpaceItem[] = activeOshiId ? [
    { to: `/oshis/${activeOshiId}`, icon: BookOpen, label: 'Journal', mode: 'journal' as const },
    { to: `/oshis/${activeOshiId}`, icon: FileText, label: 'Notes', mode: 'card' as const },
    { to: '/tags', icon: Tag, label: 'Tags' },
  ] : []

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: motionSeconds, ease: 'easeOut' }}
      className="h-full flex flex-col border-r border-border-color bg-bg-secondary/50 backdrop-blur-md shrink-0 overflow-hidden"
    >
      <div className="flex items-center h-14 px-4 border-b border-border-color shrink-0">
        {collapsed ? (
          <button
            type="button"
            onClick={toggle}
            className="mx-auto rounded-xl p-1 hover:bg-bg-tertiary focus:outline-none focus:ring-2 focus:ring-accent-soft"
            title="Expand sidebar"
          >
            <img src={appIconUrl} alt="OshiNote" className="w-8 h-8 shrink-0" />
          </button>
        ) : (
          <motion.div
            key="logo"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="flex items-center gap-2.5"
          >
            <img src={appIconUrl} alt="OshiNote" className="w-7 h-7 shrink-0" />
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

      <nav className="flex-1 overflow-y-auto px-2 py-4">
        <SidebarSection title="My Oshis" collapsed={collapsed}>
          {oshis.map((oshi) => (
            <NavLink
              key={oshi.id}
              to={`/oshis/${oshi.id}`}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200',
                  collapsed && 'justify-center px-2',
                  isActive
                    ? 'bg-accent/10 text-accent font-semibold'
                    : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
                )
              }
              title={oshi.name}
            >
              <OshiAvatar name={oshi.name} avatar={oshi.avatar} color={oshi.color} />
              <SidebarLabel collapsed={collapsed}>{oshi.name}</SidebarLabel>
            </NavLink>
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

        <SidebarSection title="Oshi Space" collapsed={collapsed}>
          {oshiSpaceItems.map((item) => {
            const isViewModeItem = item.mode !== undefined
            const isActive = isViewModeItem
              ? location.pathname === item.to && viewMode === item.mode
              : location.pathname.startsWith(item.to)

            return (
              <NavLink
                key={`${item.to}-${item.label}`}
                to={item.to}
                onClick={() => {
                  if (item.mode) setViewMode(item.mode)
                }}
                className={clsx(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200',
                  collapsed && 'justify-center px-2',
                  isActive
                    ? 'bg-accent/10 text-accent font-semibold'
                    : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
                )}
              >
                <item.icon size={20} className="shrink-0" />
                <SidebarLabel collapsed={collapsed}>{item.label}</SidebarLabel>
              </NavLink>
            )
          })}
        </SidebarSection>

        <SidebarSection title="Tools" collapsed={collapsed}>
          {globalNavItems.map((item) => (
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
  children,
}: {
  title: string
  collapsed: boolean
  children: React.ReactNode
}) {
  return (
    <section className="mb-5 space-y-1">
      <AnimatePresence>
        {!collapsed && (
          <motion.p
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted"
          >
            {title}
          </motion.p>
        )}
      </AnimatePresence>
      {children}
    </section>
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
