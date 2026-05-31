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
