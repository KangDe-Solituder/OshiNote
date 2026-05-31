import { motion } from 'framer-motion'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useThemeStore } from '../../stores/themeStore'
import { UI_MOTION_SECONDS } from '../features/themes/uiMotion'

export function MainLayout() {
  const location = useLocation()
  const uiMotionDuration = useThemeStore((s) => s.uiMotionDuration)
  const duration = UI_MOTION_SECONDS[uiMotionDuration]
  const animateRoute = duration > 0

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-hidden bg-bg-primary/60">
        <motion.div
          key={location.pathname}
          className="h-full overflow-y-auto overflow-x-hidden"
          initial={animateRoute ? { opacity: 0, y: 6 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration, ease: 'easeOut' }}
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  )
}
