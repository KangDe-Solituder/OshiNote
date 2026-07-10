import type { JournalItemWithNote } from '../../../types'
import { JOURNAL_PAGE } from '../../../features/journal/journalLayout'
import { JournalInspector } from './JournalInspector'
import { useLayoutEffect, useState, type ComponentProps } from 'react'
import { motion } from 'framer-motion'
import { usePopoverTransition } from '../themes/uiMotion'
import type { JournalPopoverAnchor } from './JournalCanvas'
import { getAnchoredPopoverPosition, getElementAnchoredPopoverPosition } from '../../../features/journal/journalPopoverPosition'

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
        setPosition({
          ...getAnchoredPopoverPosition(anchor, getPopoverPositionOptions()),
          mode: 'fixed',
        })
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
      setPosition({
        ...getElementAnchoredPopoverPosition({
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        }, getPopoverPositionOptions()),
        mode: 'fixed',
      })
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
const VIEWPORT_PADDING = 16

function getPopoverPositionOptions() {
  return {
    popoverWidth: POPOVER_WIDTH,
    popoverHeight: POPOVER_HEIGHT,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    padding: VIEWPORT_PADDING,
  }
}

function findJournalItemElement(itemId: string): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-journal-item-id]'))
    .find((element) => element.dataset.journalItemId === itemId) || null
}
