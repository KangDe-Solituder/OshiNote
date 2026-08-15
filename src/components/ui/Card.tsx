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
        'rounded-xl border transition-shadow',
        glass && 'bg-bg-card border-border-color shadow-e1',
        !glass && 'bg-bg-secondary border-border-color',
        hover && 'cursor-pointer hover:shadow-e2 hover:border-border-hover',
        {
          'p-0': padding === 'none',
          'p-3': padding === 'sm',
          'p-5': padding === 'md',
          'p-8': padding === 'lg',
        },
        className
      )}
      transition={{ duration: motionSeconds, ease: MOTION_EASING.enter }}
      {...props}
    >
      {children}
    </motion.div>
  )
}
