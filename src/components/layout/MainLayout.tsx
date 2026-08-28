import { useEffect, useLayoutEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useLocation, useNavigationType, useOutlet, type Location } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { useThemeStore } from '../../stores/themeStore'
import { MOTION_EASING, MOTION_TIMING } from '../features/themes/uiMotion'

const MAX_REMEMBERED_SCROLL_POSITIONS = 60
/** Stored against the scrollable distance so 1 always means the bottom edge. */
const scrollPositions = new Map<string, number>()

function scrollPositionKey(location: Location): string {
  return `${location.pathname}${location.search}`
}

function rememberScrollPosition(key: string, ratio: number) {
  if (scrollPositions.has(key)) scrollPositions.delete(key)
  scrollPositions.set(key, ratio)
  if (scrollPositions.size > MAX_REMEMBERED_SCROLL_POSITIONS) {
    const oldest = scrollPositions.keys().next().value
    if (oldest !== undefined) scrollPositions.delete(oldest)
  }
}

function scrollableDistance(element: HTMLElement): number {
  return Math.max(0, element.scrollHeight - element.clientHeight)
}

function readScrollRatio(element: HTMLElement): number {
  const distance = scrollableDistance(element)
  return distance > 0 ? element.scrollTop / distance : 0
}

function applyScrollRatio(element: HTMLElement, ratio: number) {
  element.scrollTop = Math.min(1, Math.max(0, ratio)) * scrollableDistance(element)
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
      let stopped = false
      let frame = 0
      let stopTimer = 0

      const restore = () => {
        if (!stopped && scrollPositions.get(positionKey) === saved) applyScrollRatio(el, saved)
      }
      const scheduleRestore = () => {
        if (stopped) return
        cancelAnimationFrame(frame)
        frame = requestAnimationFrame(restore)
      }
      const resizeObserver = new ResizeObserver(scheduleRestore)
      resizeObserver.observe(el)
      const content = el.firstElementChild
      if (content instanceof HTMLElement) resizeObserver.observe(content)
      const mutationObserver = new MutationObserver(scheduleRestore)
      mutationObserver.observe(el, { childList: true, characterData: true, subtree: true })

      const stopRestoring = () => {
        if (stopped) return
        stopped = true
        cancelAnimationFrame(frame)
        window.clearTimeout(stopTimer)
        resizeObserver.disconnect()
        mutationObserver.disconnect()
        el.removeEventListener('wheel', stopRestoring)
        el.removeEventListener('touchstart', stopRestoring)
        el.removeEventListener('pointerdown', stopRestoring)
        window.removeEventListener('keydown', stopRestoring)
      }

      el.addEventListener('wheel', stopRestoring, { passive: true })
      el.addEventListener('touchstart', stopRestoring, { passive: true })
      el.addEventListener('pointerdown', stopRestoring)
      window.addEventListener('keydown', stopRestoring)
      stopTimer = window.setTimeout(stopRestoring, 2_000)
      restore()
      scheduleRestore()
      return stopRestoring
    }
    el.scrollTop = 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionKey])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let frame = 0
    const remember = () => rememberScrollPosition(positionKey, readScrollRatio(el))
    const scheduleRemember = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(remember)
    }
    el.addEventListener('scroll', scheduleRemember, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener('scroll', scheduleRemember)
      remember()
    }

  }, [positionKey])

  return (
    <motion.div
      ref={scrollRef}
      className="absolute inset-0 z-10 overflow-y-auto overflow-x-hidden bg-bg-primary"
      initial={animateRoute ? { opacity: 0, y: timing.routeOffset, scale: 0.996 } : false}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
          opacity: { duration: timing.routeEnter, ease: MOTION_EASING.enter },
          y: { duration: timing.routeEnter, ease: MOTION_EASING.enter },
          scale: { duration: timing.routeEnter, ease: MOTION_EASING.enter },
        },
      }}
      exit={animateRoute ? {
        opacity: 0,
        y: -Math.max(2, timing.routeOffset * 0.4),
        scale: 0.998,
        // Non-animatable: applied immediately when the exit starts so the leaving page
        // can never swallow clicks or scrolls during the crossfade.
        pointerEvents: 'none',
        transition: {
          opacity: { duration: timing.routeExit, ease: MOTION_EASING.exit },
          y: { duration: timing.routeExit, ease: MOTION_EASING.exit },
          scale: { duration: timing.routeExit, ease: MOTION_EASING.exit },
        },
      } : undefined}
      style={{ contain: 'layout paint', backfaceVisibility: 'hidden', willChange: animateRoute ? 'opacity, transform' : 'auto' }}
    >
      {children}
    </motion.div>
  )
}
