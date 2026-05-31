import { useEffect, type ReactNode } from 'react'
import { MotionConfig } from 'framer-motion'
import { useUiMotionSeconds } from './uiMotion'

export function MotionProvider({ children }: { children: ReactNode }) {
  const seconds = useUiMotionSeconds()

  useEffect(() => {
    document.documentElement.style.setProperty('--ui-motion-duration', `${seconds}s`)
  }, [seconds])

  return (
    <MotionConfig transition={{ duration: seconds, ease: 'easeOut' }}>
      {children}
    </MotionConfig>
  )
}
