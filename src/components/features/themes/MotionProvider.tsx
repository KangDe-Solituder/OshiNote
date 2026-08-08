import { useEffect, type ReactNode } from 'react'
import { MotionConfig } from 'framer-motion'
import { useUiMotionSeconds } from './uiMotion'

export function MotionProvider({ children }: { children: ReactNode }) {
  const seconds = useUiMotionSeconds()

  useEffect(() => {
    document.documentElement.style.setProperty('--ui-motion-duration', `${seconds}s`)
    document.documentElement.dataset.uiMotion = seconds === 0 ? 'off' : 'on'
  }, [seconds])

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: seconds, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </MotionConfig>
  )
}
