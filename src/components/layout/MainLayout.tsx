import { AnimatePresence, motion } from 'framer-motion'
import { useLocation, useOutlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { useThemeStore } from '../../stores/themeStore'
import { MOTION_EASING, MOTION_TIMING } from '../features/themes/uiMotion'

export function MainLayout() {
  const location = useLocation()
  const outlet = useOutlet()
  const uiMotionDuration = useThemeStore((s) => s.uiMotionDuration)
  const timing = MOTION_TIMING[uiMotionDuration]
  const animateRoute = timing.routeEnter > 0

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-bg-primary/60">
      <TopBar />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar />
        <main className="app-main-container relative isolate min-h-0 flex-1 overflow-hidden">
          <AnimatePresence mode="sync" initial={false}>
            <motion.div
              key={location.pathname}
              className="absolute inset-0 overflow-y-auto overflow-x-hidden bg-bg-primary"
              initial={animateRoute ? { opacity: 0, y: timing.routeOffset } : false}
              animate={{
                opacity: 1,
                y: 0,
                transition: {
                  opacity: { duration: timing.routeEnter, delay: timing.routeExit, ease: MOTION_EASING.enter },
                  y: { duration: timing.routeEnter, delay: timing.routeExit, ease: MOTION_EASING.enter },
                },
              }}
              exit={animateRoute ? {
                opacity: 0,
                y: -3,
                transition: {
                  opacity: { duration: timing.routeExit, ease: MOTION_EASING.exit },
                  y: { duration: timing.routeExit, ease: MOTION_EASING.exit },
                },
              } : undefined}
              style={animateRoute ? { willChange: 'opacity, transform' } : undefined}
            >
              {outlet}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
