import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown } from 'lucide-react'
import clsx from 'clsx'
import { useUiMotionSeconds } from '../features/themes/uiMotion'

export interface SelectMenuOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectMenuProps {
  value: string
  options: SelectMenuOption[]
  onChange: (value: string) => void
  ariaLabel?: string
  className?: string
  buttonClassName?: string
  menuClassName?: string
  disabled?: boolean
  placeholder?: string
  menuAlign?: 'left' | 'right'
  size?: 'sm' | 'md'
}

export function SelectMenu({
  value,
  options,
  onChange,
  ariaLabel,
  className,
  buttonClassName,
  menuClassName,
  disabled = false,
  placeholder,
  menuAlign = 'left',
  size = 'md',
}: SelectMenuProps) {
  const [open, setOpen] = useState(false)
  const [menuRect, setMenuRect] = useState({ top: 0, left: 0, width: 0 })
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const motionSeconds = useUiMotionSeconds()
  const selected = options.find((option) => option.value === value)
  const menuOrigin = menuAlign === 'right' ? 'origin-top-right' : 'origin-top-left'

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  useLayoutEffect(() => {
    if (!open) return

    function updatePosition() {
      const rect = rootRef.current?.getBoundingClientRect()
      if (!rect) return
      setMenuRect({
        top: rect.bottom + 8,
        left: menuAlign === 'right' ? rect.right : rect.left,
        width: rect.width,
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [menuAlign, open])

  const menu = open && !disabled ? (
    <AnimatePresence>
      <div
        className="fixed z-[120]"
        style={{
          top: menuRect.top,
          left: menuRect.left,
          transform: menuAlign === 'right' ? 'translateX(-100%)' : undefined,
        }}
      >
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, y: motionSeconds === 0 ? 0 : -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: motionSeconds === 0 ? 0 : -4 }}
          transition={{ duration: motionSeconds, ease: 'easeOut' }}
          className={clsx(
            'overflow-hidden rounded-xl border border-border-color bg-bg-primary p-1 shadow-lg transform-gpu will-change-[transform,opacity]',
            menuOrigin,
            menuClassName
          )}
          style={{
            minWidth: menuRect.width,
            contain: 'layout paint',
          }}
        >
          <div role="listbox" aria-label={ariaLabel} className="space-y-0.5">
            {options.map((option) => {
              const active = option.value === value
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  disabled={option.disabled}
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                  className={clsx(
                    'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                    size === 'sm' ? 'text-xs' : 'text-sm',
                    active
                      ? 'bg-accent/10 text-accent'
                      : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {active && <Check size={size === 'sm' ? 13 : 15} className="shrink-0" />}
                </button>
              )
            })}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  ) : null

  return (
    <div ref={rootRef} className={clsx('relative shrink-0', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={clsx(
          'inline-flex items-center justify-between gap-3 rounded-full border font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-accent-soft disabled:cursor-not-allowed disabled:opacity-50',
          size === 'sm' ? 'h-8 min-w-[92px] px-3 text-xs' : 'h-10 min-w-[132px] px-4 text-sm',
          open
            ? 'border-accent bg-accent/5 text-text-primary ring-1 ring-accent/35'
            : 'border-border-color bg-bg-secondary text-text-secondary hover:border-accent hover:text-accent',
          buttonClassName
        )}
      >
        <span className="truncate">{selected?.label || placeholder || value}</span>
        <ChevronDown
          size={size === 'sm' ? 14 : 16}
          className="shrink-0 transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transitionDuration: `${motionSeconds}s` }}
        />
      </button>

      {menu ? createPortal(menu, document.body) : null}
    </div>
  )
}
