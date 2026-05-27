import { motion, type HTMLMotionProps } from 'framer-motion'
import clsx from 'clsx'

interface CardProps extends HTMLMotionProps<'div'> {
  glass?: boolean
  hover?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export function Card({ glass = true, hover = true, padding = 'md', className, children, ...props }: CardProps) {
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
      whileHover={hover ? { y: -2, scale: 1.01 } : undefined}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      {...props}
    >
      {children}
    </motion.div>
  )
}
