import { motion, type HTMLMotionProps } from 'framer-motion'
import clsx from 'clsx'
import { MOTION_EASING, useUiMotionSeconds } from '../features/themes/uiMotion'

interface CardProps extends HTMLMotionProps<'div'> {
  glass?: boolean
  hover?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export function Card({ glass = true, hover = true, padding = 'md', className, children, ...props }: CardProps) {
  const motionSeconds = useUiMotionSeconds()

  return (
    <motion.div
      className={clsx(
        'rounded-xl border',
        glass && 'bg-bg-card backdrop-blur-md border-white/20 shadow-glass',
        !glass && 'bg-bg-secondary border-border-color',
        hover && 'cursor-pointer',
        {
          'p-0': padding === 'none',
          'p-3': padding === 'sm',
          'p-5': padding === 'md',
          'p-8': padding === 'lg',
        },
        className
      )}
      whileHover={hover && motionSeconds > 0 ? { y: -2 } : undefined}
      transition={{ duration: motionSeconds, ease: MOTION_EASING.enter }}
      {...props}
    >
      {children}
    </motion.div>
  )
}
