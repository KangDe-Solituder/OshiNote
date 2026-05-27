import { motion, AnimatePresence } from 'framer-motion'
import { NavLink } from 'react-router-dom'
import { Home, Heart, Tag, Wand2, Download, Settings, ChevronLeft, ChevronRight } from 'lucide-react'
import { useSidebarStore } from '../../stores/sidebarStore'
import appIconUrl from '../../assets/app-icon.svg'
import clsx from 'clsx'

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/oshis', icon: Heart, label: 'Oshis' },
  { to: '/tags', icon: Tag, label: 'Tags' },
  { to: '/ai', icon: Wand2, label: 'AI Tools' },
  { to: '/export', icon: Download, label: 'Export' },
]

export function Sidebar() {
  const { collapsed, toggle } = useSidebarStore()

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="h-full flex flex-col border-r border-border-color bg-bg-secondary/50 backdrop-blur-md shrink-0 overflow-hidden"
    >
      <div className="flex items-center h-14 px-4 border-b border-border-color shrink-0">
        {collapsed ? (
          <img src={appIconUrl} alt="OshiNote" className="w-8 h-8 shrink-0" />
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
        <button
          onClick={toggle}
          className={clsx(
            'p-1.5 rounded-lg hover:bg-bg-tertiary text-text-muted hover:text-text-primary transition-colors',
            collapsed ? 'mx-auto' : 'ml-auto'
          )}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
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
            <AnimatePresence mode="wait">
              {!collapsed && (
                <motion.span
                  key="label"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="text-sm truncate"
                >
                  {item.label}
                </motion.span>
              )}
            </AnimatePresence>
          </NavLink>
        ))}
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
