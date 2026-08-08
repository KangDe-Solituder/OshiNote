import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import clsx from 'clsx'
import { MOTION_EASING, useUiMotionSeconds } from '../features/themes/uiMotion'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, children, ...props }, ref) => {
    const motionSeconds = useUiMotionSeconds()
    const motionProps = props as unknown as HTMLMotionProps<'button'>
    const interactiveMotion = motionSeconds > 0 && !props.disabled
    const base = clsx(
      'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-accent-soft disabled:opacity-50 disabled:pointer-events-none',
      {
        'bg-accent text-white hover:bg-accent-hover shadow-lg shadow-accent/20': variant === 'primary',
        'bg-bg-secondary text-text-primary hover:bg-bg-tertiary border border-border-color': variant === 'secondary',
        'text-text-secondary hover:text-text-primary hover:bg-bg-secondary': variant === 'ghost',
        'bg-red-500 text-white hover:bg-red-600': variant === 'danger',
      },
      {
        'px-3 py-1.5 text-sm': size === 'sm',
        'px-4 py-2 text-sm': size === 'md',
        'px-6 py-3 text-base': size === 'lg',
      },
      className
    )

    return (
      <motion.button
        ref={ref}
        className={base}
        whileHover={interactiveMotion ? { y: -1 } : undefined}
        whileTap={interactiveMotion ? { y: 0, scale: 0.975 } : undefined}
        transition={{ duration: motionSeconds, ease: MOTION_EASING.enter }}
        {...motionProps}
      >
        {children}
      </motion.button>
    )
  }
)

Button.displayName = 'Button'
