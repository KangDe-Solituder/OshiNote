import { forwardRef, type InputHTMLAttributes } from 'react'
import clsx from 'clsx'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, className, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-text-secondary">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={clsx(
            'w-full px-4 py-2.5 rounded-xl border border-border-color bg-bg-secondary text-text-primary',
            'placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-soft focus:border-accent',
            'transition-colors text-sm',
            className
          )}
          {...props}
        />
      </div>
    )
  }
)

Input.displayName = 'Input'
