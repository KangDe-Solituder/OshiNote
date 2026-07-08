import type { JournalItemWithNote } from '../../../types'
import { JOURNAL_PAGE } from '../../../features/journal/journalLayout'
import { JournalInspector } from './JournalInspector'
import { useLayoutEffect, useState, type ComponentProps } from 'react'
import { motion } from 'framer-motion'
import { usePopoverTransition } from '../themes/uiMotion'
import type { JournalPopoverAnchor } from './JournalCanvas'

interface JournalStickerPopoverProps extends Omit<ComponentProps<typeof JournalInspector>, 'variant'> {
  selectedItem: JournalItemWithNote
  anchor?: JournalPopoverAnchor | null
}

export function JournalStickerPopover(props: JournalStickerPopoverProps) {
  const popoverTransition = usePopoverTransition()
  const { selectedItem, anchor } = props
  const [position, setPosition] = useState<{ left: number; top: number; mode: 'fixed' | 'absolute' }>(() => ({
    left: Math.max(16, Math.min(selectedItem.x + selectedItem.width + 12, JOURNAL_PAGE.width - 340)),
    top: Math.max(16, Math.min(selectedItem.y, JOURNAL_PAGE.height - 580)),
    mode: 'absolute',
  }))

  useLayoutEffect(() => {
    function updatePosition() {
      if (anchor) {
        setPosition(getAnchoredPosition(anchor))
        return
      }
      const target = findJournalItemElement(selectedItem.id)
      if (!target) {
        setPosition({
          left: Math.max(16, Math.min(selectedItem.x + selectedItem.width + 12, JOURNAL_PAGE.width - 340)),
          top: Math.max(16, Math.min(selectedItem.y, JOURNAL_PAGE.height - 580)),
          mode: 'absolute',
        })
        return
      }
      const rect = target.getBoundingClientRect()
      const width = POPOVER_WIDTH
      const height = POPOVER_HEIGHT
      const gap = POPOVER_GAP
      const rightLeft = rect.right + gap
      const leftLeft = rect.left - width - gap
      const left = rightLeft + width <= window.innerWidth - 16
        ? rightLeft
        : leftLeft >= 16
          ? leftLeft
          : Math.max(16, Math.min(rect.left, window.innerWidth - width - 16))
      const preferredTop = rect.top + rect.height / 2 - height / 2
      const top = Math.max(16, Math.min(preferredTop, window.innerHeight - height - 16))
      setPosition({ left, top, mode: 'fixed' })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [anchor, selectedItem.height, selectedItem.id, selectedItem.width, selectedItem.x, selectedItem.y])

  return (
    <motion.div
      {...popoverTransition}
      className="z-[80]"
      style={{
        position: position.mode,
        left: position.left,
        top: position.top,
        transformOrigin: 'top left',
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <JournalInspector {...props} variant="popover" />
    </motion.div>
  )
}

const POPOVER_WIDTH = 360
const POPOVER_HEIGHT = 560
const POPOVER_GAP = 12
const VIEWPORT_PADDING = 16

function getAnchoredPosition(anchor: JournalPopoverAnchor) {
  const rightSpace = window.innerWidth - anchor.clientX
  const leftSpace = anchor.clientX
  const preferRight = rightSpace >= leftSpace
  const rightLeft = anchor.clientX + POPOVER_GAP
  const leftLeft = anchor.clientX - POPOVER_WIDTH - POPOVER_GAP
  const left = preferRight
    ? Math.min(rightLeft, window.innerWidth - POPOVER_WIDTH - VIEWPORT_PADDING)
    : Math.max(leftLeft, VIEWPORT_PADDING)
  const top = Math.max(
    VIEWPORT_PADDING,
    Math.min(anchor.clientY - 24, window.innerHeight - POPOVER_HEIGHT - VIEWPORT_PADDING),
  )
  return {
    left: Math.max(VIEWPORT_PADDING, Math.min(left, window.innerWidth - POPOVER_WIDTH - VIEWPORT_PADDING)),
    top,
    mode: 'fixed' as const,
  }
}

function findJournalItemElement(itemId: string): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-journal-item-id]'))
    .find((element) => element.dataset.journalItemId === itemId) || null
}
