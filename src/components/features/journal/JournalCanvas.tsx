import { Loader2, Minus, Plus, StickyNote } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { JournalItemWithNote, JournalPage } from '../../../types'
import { getJournalCanvasSize, type JournalLayoutInput } from '../../../features/journal/journalLayout'
import { JournalSticker } from './JournalSticker'

interface JournalCanvasProps {
  page: JournalPage | null
  items: JournalItemWithNote[]
  selectedItemId: string | null
  loading: boolean
  zoom: number
  onZoomChange: (zoom: number) => void
  onSelectItem: (item: JournalItemWithNote | null) => void
  onCommitLayout: (itemId: string, layout: JournalLayoutInput) => void
}

export function JournalCanvas({
  page,
  items,
  selectedItemId,
  loading,
  zoom,
  onZoomChange,
  onSelectItem,
  onCommitLayout,
}: JournalCanvasProps) {
  const canvasSize = getJournalCanvasSize(items)

  return (
    <div className="relative h-full min-h-0 min-w-0 flex-1 overflow-auto bg-[var(--journal-canvas-bg)]">
      <div className="sticky left-[calc(100%-178px)] top-4 z-[70] flex h-10 w-max items-center gap-1 rounded-2xl border border-border-color bg-bg-card/90 p-1 shadow-sm backdrop-blur">
        <button type="button" onClick={() => onZoomChange(Math.max(0.5, zoom - 0.1))} className="rounded-xl p-2 text-text-muted hover:bg-bg-secondary hover:text-accent" title="Zoom out">
          <Minus size={15} />
        </button>
        <span className="min-w-12 text-center text-xs font-semibold text-text-secondary">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => onZoomChange(Math.min(1.25, zoom + 0.1))} className="rounded-xl p-2 text-text-muted hover:bg-bg-secondary hover:text-accent" title="Zoom in">
          <Plus size={15} />
        </button>
      </div>
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
              <p className="mt-1 text-xs text-text-muted">Place notes or illustrations to start arranging your page.</p>
            </div>
          )}

          {items.map((item) => (
            <JournalSticker
              key={item.id}
              item={item}
              selected={selectedItemId === item.id}
              zoom={zoom}
              onSelect={onSelectItem}
              onCommitLayout={onCommitLayout}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export function getPageBackground(background: string): CSSProperties {
  const dotLayer = 'radial-gradient(var(--journal-canvas-dot) 1px, transparent 1px)'
  if (background === 'grid') {
    return {
      backgroundColor: 'var(--journal-canvas-bg)',
      backgroundImage: 'linear-gradient(var(--journal-canvas-dot) 1px, transparent 1px), linear-gradient(90deg, var(--journal-canvas-dot) 1px, transparent 1px)',
      backgroundSize: '24px 24px',
    }
  }
  if (background === 'blush') {
    return {
      backgroundColor: 'color-mix(in srgb, var(--color-bg-primary) 82%, var(--color-accent-soft))',
      backgroundImage: dotLayer,
      backgroundSize: '18px 18px',
    }
  }
  if (background === 'blue') {
    return {
      backgroundColor: 'color-mix(in srgb, var(--color-bg-primary) 76%, var(--color-bg-secondary))',
      backgroundImage: dotLayer,
      backgroundSize: '18px 18px',
    }
  }
  if (background === 'mint') {
    return {
      backgroundColor: 'color-mix(in srgb, var(--color-bg-primary) 82%, var(--color-text-secondary))',
      backgroundImage: dotLayer,
      backgroundSize: '18px 18px',
    }
  }
  if (background === 'postcard') {
    return {
      backgroundColor: 'var(--journal-canvas-bg)',
      backgroundImage: 'linear-gradient(90deg, color-mix(in srgb, var(--color-accent) 34%, transparent) 0 8px, transparent 8px), radial-gradient(var(--journal-canvas-dot) 1px, transparent 1px)',
      backgroundSize: '44px 100%, 18px 18px',
    }
  }
  return {
    backgroundColor: 'var(--journal-canvas-bg)',
    backgroundImage: dotLayer,
    backgroundSize: '18px 18px',
  }
}
