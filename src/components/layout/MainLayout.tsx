import { useEffect, useLayoutEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useLocation, useNavigationType, useOutlet, type Location } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { useThemeStore } from '../../stores/themeStore'
import { MOTION_EASING, MOTION_TIMING } from '../features/themes/uiMotion'

const MAX_REMEMBERED_SCROLL_POSITIONS = 60
const scrollPositions = new Map<string, number>()

function scrollPositionKey(location: Location): string {
  return `${location.pathname}${location.search}`
}

function rememberScrollPosition(key: string, top: number) {
  if (scrollPositions.has(key)) scrollPositions.delete(key)
  scrollPositions.set(key, top)
  if (scrollPositions.size > MAX_REMEMBERED_SCROLL_POSITIONS) {
    const oldest = scrollPositions.keys().next().value
    if (oldest !== undefined) scrollPositions.delete(oldest)
  }
}

export function MainLayout() {
  const location = useLocation()
  const navigationType = useNavigationType()
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
          <AnimatePresence initial={false}>
            <RouteView
              key={location.pathname}
              location={location}
              navigationType={navigationType}
              animateRoute={animateRoute}
              timing={timing}
            >
              {outlet}
            </RouteView>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}

function RouteView({
  location,
  navigationType,
  animateRoute,
  timing,
  children,
}: {
  location: Location
  navigationType: ReturnType<typeof useNavigationType>
  animateRoute: boolean
  timing: (typeof MOTION_TIMING)[keyof typeof MOTION_TIMING]
  children: React.ReactNode
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const positionKey = scrollPositionKey(location)

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const saved = navigationType === 'POP' ? scrollPositions.get(positionKey) : undefined
    if (saved != null && saved > 0) {
      el.scrollTop = saved
      // Content may settle after fonts/data arrive; re-apply once on the next frame.
      const frame = requestAnimationFrame(() => {
        if (scrollRef.current && scrollPositions.get(positionKey) === saved) {
          scrollRef.current.scrollTop = saved
        }
      })
      return () => cancelAnimationFrame(frame)
    }
    el.scrollTop = 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionKey])

  useEffect(() => {
    const el = scrollRef.current
    return () => {
      if (el) rememberScrollPosition(positionKey, el.scrollTop)
    }
     
  }, [positionKey])

  return (
    <motion.div
      ref={scrollRef}
      className="absolute inset-0 z-10 overflow-y-auto overflow-x-hidden bg-bg-primary"
      initial={animateRoute ? { opacity: 0, y: timing.routeOffset } : false}
      animate={{
        opacity: 1,
        y: 0,
        transition: {
          opacity: { duration: timing.routeEnter, ease: MOTION_EASING.enter },
          y: { duration: timing.routeEnter, ease: MOTION_EASING.enter },
        },
      }}
      exit={animateRoute ? {
        opacity: 0,
        transition: {
          opacity: { duration: timing.routeExit, ease: MOTION_EASING.exit },
        },
      } : undefined}
      style={{ contain: 'layout paint', backfaceVisibility: 'hidden' }}
    >
      {children}
    </motion.div>
  )
}
