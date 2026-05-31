import { Loader2, StickyNote } from 'lucide-react'
import type { JournalItemWithNote, JournalPage } from '../../../types'
import { JOURNAL_PAGE, type JournalLayoutInput } from '../../../features/journal/journalLayout'
import { JournalSticker } from './JournalSticker'

interface JournalCanvasProps {
  page: JournalPage | null
  items: JournalItemWithNote[]
  selectedItemId: string | null
  loading: boolean
  onSelectItem: (item: JournalItemWithNote | null) => void
  onCommitLayout: (itemId: string, layout: JournalLayoutInput) => void
}

export function JournalCanvas({
  page,
  items,
  selectedItemId,
  loading,
  onSelectItem,
  onCommitLayout,
}: JournalCanvasProps) {
  return (
    <div className="flex min-w-0 flex-1 justify-center overflow-auto p-6">
      <div
        className="relative shrink-0 overflow-hidden rounded-2xl border border-border-color bg-[#fffdf8] shadow-xl"
        style={{
          width: JOURNAL_PAGE.width,
          height: JOURNAL_PAGE.height,
          backgroundImage:
            'radial-gradient(rgba(160, 130, 120, 0.18) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
        }}
        onClick={(e) => {
          if (e.currentTarget === e.target) onSelectItem(null)
        }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-8 py-5 text-xs text-text-muted">
          <span>{page?.title || 'Journal Page'}</span>
          <span>{page ? page.page_index + 1 : 1}</span>
        </div>

        {loading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-bg-primary/25 backdrop-blur-sm">
            <Loader2 size={26} className="animate-spin text-accent" />
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <StickyNote size={44} className="mb-3 text-accent-soft" />
            <p className="text-sm font-medium text-text-primary">This page is waiting for memories</p>
            <p className="mt-1 text-xs text-text-muted">Create notes or switch archives to place stickers here.</p>
          </div>
        )}

        {items.map((item) => (
          <JournalSticker
            key={item.id}
            item={item}
            selected={selectedItemId === item.id}
            onSelect={onSelectItem}
            onCommitLayout={onCommitLayout}
          />
        ))}
      </div>
    </div>
  )
}
