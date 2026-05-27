import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { motion } from 'framer-motion'
import clsx from 'clsx'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, children, ...props }, ref) => {
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
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        {...(props as any)}
      >
        {children}
      </motion.button>
    )
  }
)

Button.displayName = 'Button'
