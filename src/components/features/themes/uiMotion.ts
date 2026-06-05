import { useThemeStore } from '../../../stores/themeStore'
import type { UiMotionDuration } from '../../../types'

export const UI_MOTION_SECONDS: Record<UiMotionDuration, number> = {
  off: 0,
  fast: 0.1,
  normal: 0.18,
  slow: 0.34,
}

export function useUiMotionSeconds(): number {
  const uiMotionDuration = useThemeStore((s) => s.uiMotionDuration)
  return UI_MOTION_SECONDS[uiMotionDuration]
}

export function usePageTransition() {
  const duration = useUiMotionSeconds()
  return {
    initial: { opacity: 0, y: duration === 0 ? 0 : 3 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: duration === 0 ? 0 : -2 },
    transition: { duration, ease: 'easeOut' as const },
  }
}

export function usePanelTransition() {
  const duration = useUiMotionSeconds()
  return {
    initial: { opacity: 0, y: duration === 0 ? 0 : -6, height: 0 },
    animate: { opacity: 1, y: 0, height: 'auto' },
    exit: { opacity: 0, y: duration === 0 ? 0 : -6, height: 0 },
    transition: { duration, ease: 'easeOut' as const },
  }
}

export function usePopoverTransition() {
  const duration = useUiMotionSeconds()
  return {
    initial: { opacity: 0, scale: duration === 0 ? 1 : 0.98 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: duration === 0 ? 1 : 0.98 },
    transition: { duration, ease: 'easeOut' as const },
  }
}
