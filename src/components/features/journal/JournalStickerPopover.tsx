import type { JournalItemWithNote } from '../../../types'
import { JOURNAL_PAGE } from '../../../features/journal/journalLayout'
import { JournalInspector } from './JournalInspector'
import type { ComponentProps } from 'react'
import { motion } from 'framer-motion'
import { usePopoverTransition } from '../themes/uiMotion'

interface JournalStickerPopoverProps extends Omit<ComponentProps<typeof JournalInspector>, 'variant'> {
  selectedItem: JournalItemWithNote
}

export function JournalStickerPopover(props: JournalStickerPopoverProps) {
  const popoverTransition = usePopoverTransition()
  const { selectedItem } = props
  const left = Math.min(selectedItem.x + selectedItem.width + 12, JOURNAL_PAGE.width - 340)
  const top = Math.min(Math.max(selectedItem.y, 16), JOURNAL_PAGE.height - 580)

  return (
    <motion.div
      {...popoverTransition}
      className="absolute z-[80]"
      style={{
        left: Math.max(16, left),
        top: Math.max(16, top),
        transformOrigin: 'top left',
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <JournalInspector {...props} variant="popover" />
    </motion.div>
  )
}
