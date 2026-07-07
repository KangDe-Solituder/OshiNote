import { Loader2, Minus, Plus, StickyNote } from 'lucide-react'
import type { JournalItemWithNote, JournalPage } from '../../../types'
import { getJournalCanvasSize, type JournalLayoutInput } from '../../../features/journal/journalLayout'
import { JournalSticker } from './JournalSticker'
import { useI18n } from '../../../i18n/useI18n'
import { getPageBackground } from './journalCanvasStyle'
import { StampOverlay } from '../stamps/StampOverlay'
import { StampPlacementLayer } from '../stamps/StampPlacementLayer'
import type { Stamp, StampInput } from '../../../types'

interface JournalCanvasProps {
  page: JournalPage | null
  items: JournalItemWithNote[]
  selectedItemId: string | null
  loading: boolean
  zoom: number
  zoomControlsRightOffset?: number
  stamp?: Stamp | StampInput | null
  stampPlacementDraft?: StampInput | null
  stampSoundEnabled?: boolean
  onZoomChange: (zoom: number) => void
  onSelectItem: (item: JournalItemWithNote | null) => void
  onCommitLayout: (itemId: string, layout: JournalLayoutInput) => void
  onStampPlace?: (stamp: StampInput) => void
  onStampPlacementComplete?: () => void
  onStampPlacementCancel?: () => void
}

export function JournalCanvas({
  page,
  items,
  selectedItemId,
  loading,
  zoom,
  zoomControlsRightOffset = 16,
  stamp = null,
  stampPlacementDraft = null,
  stampSoundEnabled = false,
  onZoomChange,
  onSelectItem,
  onCommitLayout,
  onStampPlace,
  onStampPlacementComplete,
  onStampPlacementCancel,
}: JournalCanvasProps) {
  const { t } = useI18n()
  const orientation = page?.orientation || 'portrait'
  const canvasSize = getJournalCanvasSize(items, orientation)

  return (
    <div className="relative h-full min-h-0 min-w-0 flex-1 overflow-auto bg-[var(--journal-canvas-bg)]">
      <div
        className="sticky top-4 z-[60] flex h-10 w-max items-center gap-1 rounded-2xl border border-border-color bg-bg-card/90 p-1 shadow-sm backdrop-blur"
        style={{ left: `max(16px, calc(100% - 178px - ${zoomControlsRightOffset}px))` }}
      >
        <button type="button" onClick={() => onZoomChange(Math.max(0.5, zoom - 0.1))} className="rounded-xl p-2 text-text-muted hover:bg-bg-secondary hover:text-accent" title={t('journalEditor.zoomOut')}>
          <Minus size={15} />
        </button>
        <span className="min-w-12 text-center text-xs font-semibold text-text-secondary">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => onZoomChange(Math.min(1.25, zoom + 0.1))} className="rounded-xl p-2 text-text-muted hover:bg-bg-secondary hover:text-accent" title={t('journalEditor.zoomIn')}>
          <Plus size={15} />
        </button>
      </div>
      <div className="flex min-h-[calc(100%-56px)] min-w-full justify-center p-6 pt-2">
      <div style={{ width: canvasSize.width * zoom, height: Math.max(canvasSize.height * zoom, 1) }}>
        <div
          className="relative overflow-visible bg-[var(--journal-canvas-bg)]"
          style={{
            width: canvasSize.width,
            height: canvasSize.height,
            minHeight: '100%',
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
            ...getPageBackground(page?.background || 'paper'),
          }}
          onClick={(e) => {
            if (e.currentTarget === e.target) onSelectItem(null)
          }}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-8 py-5 text-xs text-text-muted">
            <span>{page?.title || t('journalEditor.canvasLabel')}</span>
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
              <p className="text-sm font-medium text-text-primary">{t('journalEditor.empty.title')}</p>
              <p className="mt-1 text-xs text-text-muted">{t('journalEditor.empty.body')}</p>
            </div>
          )}

          {items.map((item) => (
            <JournalSticker
              key={item.id}
              item={item}
              selected={selectedItemId === item.id}
              zoom={zoom}
              orientation={orientation}
              onSelect={onSelectItem}
              onCommitLayout={onCommitLayout}
            />
          ))}

          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <StampOverlay stamp={stamp} />
            <StampPlacementLayer
              active={Boolean(stampPlacementDraft)}
              stamp={stampPlacementDraft}
              soundEnabled={stampSoundEnabled}
              onPlace={(nextStamp) => onStampPlace?.(nextStamp)}
              onComplete={() => onStampPlacementComplete?.()}
              onCancel={() => onStampPlacementCancel?.()}
            />
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
