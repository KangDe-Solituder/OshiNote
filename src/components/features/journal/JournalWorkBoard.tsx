import { type PointerEvent, type RefObject } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { FileText, Inbox, X } from 'lucide-react'
import type { Illustration, JournalDraftItem, Note } from '../../../types'
import { MediaImage } from '../../ui/MediaImage'
import { JournalMaterialTile } from './JournalMaterialTile'
import { getJournalMaterialDefinition } from '../../../features/journal/journalMaterials'
import { useMotionTiming } from '../themes/uiMotion'
import { useI18n } from '../../../i18n/useI18n'

interface JournalWorkBoardProps {
  open: boolean
  boardRef: RefObject<HTMLDivElement | null>
  items: JournalDraftItem[]
  notesById: Map<string, Note>
  illustrationsById: Map<string, Illustration>
  onDragStartItem: (item: JournalDraftItem, event: PointerEvent<HTMLElement>) => void
  onRemoveItem: (draftId: string) => void
}

/**
 * Magnetic staging tray above the journal canvas: collect first, then compose.
 * Collapsed to a slim edge strip by default; reveals when the pointer nears the
 * canvas top edge (handled by the canvas) and retracts when the pointer leaves.
 */
export function JournalWorkBoard({ open, boardRef, items, notesById, illustrationsById, onDragStartItem, onRemoveItem }: JournalWorkBoardProps) {
  const { t } = useI18n()
  const timing = useMotionTiming()
  const animated = timing.micro > 0

  return (
    <motion.div
      ref={boardRef}
      data-journal-workboard="true"
      initial={false}
      animate={{ height: open ? 84 : 10 }}
      transition={{ duration: timing.micro + 0.14, ease: 'easeOut' }}
      className="relative shrink-0 overflow-hidden border-x border-b border-dashed border-border-color bg-bg-card/60 backdrop-blur-sm"
    >
      <div className={clsx('flex h-[84px] items-center gap-3 px-4 transition-opacity', open ? 'opacity-100 delay-75' : 'pointer-events-none opacity-0')}>
        <div className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-text-muted">
          <Inbox size={14} className="text-accent" />
          {t('journal.workboard')}
          {items.length > 0 && <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent">{items.length}</span>}
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-3">
          {items.length === 0 && (
            <p className="w-full text-center text-xs text-text-muted/70">{t('journal.workboardEmpty')}</p>
          )}
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <motion.div
                key={item.draftId}
                layout
                initial={animated ? { opacity: 0, scale: 0.85 } : false}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: timing.micro + 0.08, ease: 'easeOut' }}
                className="group relative shrink-0 cursor-grab active:cursor-grabbing"
                onPointerDown={(event) => onDragStartItem(item, event)}
              >
                <BoardChip item={item} notesById={notesById} illustrationsById={illustrationsById} />
                <button
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => onRemoveItem(item.draftId)}
                  className="absolute -right-1.5 -top-1.5 flex items-center justify-center rounded-full bg-bg-primary text-text-muted opacity-0 shadow-e1 ring-1 ring-border-color transition-opacity hover:text-red-500 group-hover:opacity-100"
                  style={{ width: 18, height: 18 }}
                  title={t('common.delete')}
                >
                  <X size={10} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
      {!open && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-center gap-2">
          <span className="h-px w-10 bg-border-color" />
          <Inbox size={10} className="text-text-muted/60" />
          <span className="h-px w-10 bg-border-color" />
        </div>
      )}
    </motion.div>
  )
}

function BoardChip({
  item,
  notesById,
  illustrationsById,
}: {
  item: JournalDraftItem
  notesById: Map<string, Note>
  illustrationsById: Map<string, Illustration>
}) {
  const { t } = useI18n()
  if (item.itemType === 'illustration' && item.sourceId) {
    const illustration = illustrationsById.get(item.sourceId)
    return (
      <div className="overflow-hidden rounded-lg bg-bg-tertiary shadow-sm ring-1 ring-border-color" style={{ width: 52, height: 52 }}>
        {illustration && (
          <MediaImage
            path={illustration.thumbnail_path || illustration.original_path}
            fallbackPath={illustration.original_path}
            alt={illustration.title}
            className="h-full w-full object-cover"
            reserveHeight={false}
          />
        )}
      </div>
    )
  }
  if (item.itemType === 'material' && item.materialId) {
    const material = getJournalMaterialDefinition(item.materialId)
    if (material) {
      return (
        <div className="flex items-center justify-center rounded-lg bg-bg-tertiary/60 shadow-sm ring-1 ring-border-color" style={{ width: 52, height: 52 }}>
          <JournalMaterialTile fill material={material} />
        </div>
      )
    }
  }
  const note = item.sourceId ? notesById.get(item.sourceId) : undefined
  return (
    <div className="flex flex-col overflow-hidden rounded-lg bg-[#fff7d6] p-1.5 shadow-sm ring-1 ring-border-color" style={{ width: 64, height: 52 }}>
      <span className="flex items-center gap-1 text-[9px] font-semibold text-text-primary">
        <FileText size={9} className="shrink-0" />
        <span className="truncate">{note?.title || t('common.untitled')}</span>
      </span>
      <span className="mt-0.5 line-clamp-2 text-[8px] leading-tight text-text-muted">{note?.plain_text || ''}</span>
    </div>
  )
}
