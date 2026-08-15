import { createPortal } from 'react-dom'
import { ImageIcon, StickyNote } from 'lucide-react'
import type { Illustration, Note } from '../../../types'
import { getAnchoredPopoverPosition } from '../../../features/journal/journalPopoverPosition'
import { useI18n } from '../../../i18n/useI18n'
import { MediaImage } from '../../ui/MediaImage'

export type JournalResourcePreview =
  | { kind: 'note'; note: Note }
  | { kind: 'illustration'; illustration: Illustration }

export interface JournalResourcePreviewAnchor {
  clientX: number
  clientY: number
}

export function JournalResourceHoverPreview({ preview, anchor }: {
  preview: JournalResourcePreview
  anchor: JournalResourcePreviewAnchor
}) {
  const { t } = useI18n()
  const width = 320
  const height = preview.kind === 'illustration' ? 360 : 260
  const position = getAnchoredPopoverPosition(anchor, {
    popoverWidth: width,
    popoverHeight: height,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    padding: 12,
    gap: 16,
    yOffset: 28,
  })

  return createPortal(
    <aside
      aria-hidden="true"
      className="pointer-events-none fixed z-[140] overflow-hidden rounded-2xl border border-border-color bg-bg-primary shadow-2xl"
      style={{ left: position.left, top: position.top, width, height }}
    >
      {preview.kind === 'illustration' ? (
        <IllustrationPreview illustration={preview.illustration} />
      ) : (
        <div className="flex h-full flex-col p-4">
          <div className="flex min-w-0 items-start gap-3 border-b border-border-color pb-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft/45 text-accent">
              <StickyNote size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-text-primary">
                {preview.note.title || t('common.untitled')}
              </h3>
              <p className="mt-1 text-xs text-text-muted">{new Date(preview.note.created_at).toLocaleDateString()}</p>
            </div>
          </div>
          <p className="mt-3 min-h-0 flex-1 overflow-hidden whitespace-pre-wrap break-words text-sm leading-6 text-text-secondary">
            {preview.note.plain_text || t('common.noContent')}
          </p>
          <PreviewTags tags={preview.note.tags} />
        </div>
      )}
    </aside>,
    document.body
  )
}

function IllustrationPreview({ illustration }: { illustration: Illustration }) {
  const { t } = useI18n()
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[220px] shrink-0 items-center justify-center overflow-hidden bg-bg-tertiary">
        <MediaImage
          path={illustration.thumbnail_path || illustration.original_path}
          fallbackPath={illustration.original_path}
          alt=""
          className="h-full w-full object-contain"
          reserveHeight={false}
          eager
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col p-4">
        <div className="flex min-w-0 items-start gap-3">
          <ImageIcon size={18} className="mt-0.5 shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-text-primary">
              {illustration.title || illustration.original_filename || t('common.untitled')}
            </h3>
            <p className="mt-1 truncate text-xs text-text-muted">
              {illustration.artist || illustration.owner || t('common.unknownArtist')}
            </p>
          </div>
        </div>
        {illustration.description ? (
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-text-secondary">{illustration.description}</p>
        ) : null}
        <PreviewTags tags={illustration.tags} />
      </div>
    </div>
  )
}

function PreviewTags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null
  return (
    <div className="mt-auto flex max-h-7 gap-1 overflow-hidden pt-2">
      {tags.slice(0, 4).map((tag) => (
        <span key={tag} className="shrink-0 rounded-full bg-bg-secondary px-2 py-0.5 text-[11px] text-text-muted">{tag}</span>
      ))}
    </div>
  )
}
