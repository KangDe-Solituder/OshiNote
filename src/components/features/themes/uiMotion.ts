import { useThemeStore } from '../../../stores/themeStore'
import type { UiMotionDuration } from '../../../types'

export const MOTION_EASING = {
  enter: [0.16, 1, 0.3, 1] as const,
  exit: [0.4, 0, 1, 1] as const,
  standard: [0.2, 0, 0, 1] as const,
}

interface MotionTiming {
  micro: number
  viewEnter: number
  viewExit: number
  routeEnter: number
  routeExit: number
}

export const MOTION_TIMING: Record<UiMotionDuration, MotionTiming> = {
  off: { micro: 0, viewEnter: 0, viewExit: 0, routeEnter: 0, routeExit: 0 },
  fast: { micro: 0.07, viewEnter: 0.12, viewExit: 0.055, routeEnter: 0.14, routeExit: 0.055 },
  normal: { micro: 0.13, viewEnter: 0.18, viewExit: 0.075, routeEnter: 0.2, routeExit: 0.075 },
  slow: { micro: 0.2, viewEnter: 0.25, viewExit: 0.1, routeEnter: 0.29, routeExit: 0.105 },
}

export const UI_MOTION_SECONDS: Record<UiMotionDuration, number> = {
  off: 0,
  fast: MOTION_TIMING.fast.micro,
  normal: MOTION_TIMING.normal.micro,
  slow: MOTION_TIMING.slow.micro,
}

export function useUiMotionSeconds(): number {
  const uiMotionDuration = useThemeStore((s) => s.uiMotionDuration)
  return UI_MOTION_SECONDS[uiMotionDuration]
}

export function useMotionTiming(): MotionTiming {
  const uiMotionDuration = useThemeStore((s) => s.uiMotionDuration)
  return MOTION_TIMING[uiMotionDuration]
}

export function usePageTransition() {
  const timing = useMotionTiming()
  return {
    initial: { opacity: 0, y: timing.viewEnter === 0 ? 0 : 4 },
    animate: {
      opacity: 1,
      y: 0,
      transition: { duration: timing.viewEnter, ease: MOTION_EASING.enter },
    },
    exit: {
      opacity: 0,
      y: timing.viewExit === 0 ? 0 : -2,
      transition: { duration: timing.viewExit, ease: MOTION_EASING.exit },
    },
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
