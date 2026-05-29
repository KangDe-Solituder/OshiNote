import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useThemeStore } from '../../stores/themeStore'

const ROUTE_TRANSITION_SECONDS = {
  off: 0,
  fast: 0.08,
  normal: 0.16,
  slow: 0.28,
}

export function MainLayout() {
  const uiMotionDuration = useThemeStore((s) => s.uiMotionDuration)
  const duration = ROUTE_TRANSITION_SECONDS[uiMotionDuration]

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-hidden bg-bg-primary/60">
        <div
          className="h-full overflow-y-auto overflow-x-hidden"
          style={{ transitionDuration: `${duration}s` }}
        >
          <Outlet />
        </div>
      </main>
    </div>
  )
}
