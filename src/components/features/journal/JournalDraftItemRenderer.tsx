import { readRegionPaper } from '../../../features/journal/journalRegionItems'
import { JournalRegionPaper } from './JournalRegionPaper'
import { ImageIcon } from 'lucide-react'
import clsx from 'clsx'
import { useEffect, useState } from 'react'
import type { Illustration, JournalDraftItem, JournalImage, Note } from '../../../types'
import { useI18n } from '../../../i18n/useI18n'
import { resolveMaterialSnapshot } from '../../../features/journal/journalMaterials'
import {
  getDraftImageItemStyle,
  getDraftNoteCardStyle,
  getFontFamily,
  getImageBottomPadding,
  getImageFrameStyle,
  getImagePadding,
  getMaterialStylePayload,
} from '../../../features/journal/journalItemStyles'
import { releaseMediaUrl, resolveMediaUrlWithFallback } from '../../../services/media/illustrationMedia'
import { MediaImage } from '../../ui/MediaImage'
import { DraftMaterialBody } from './renderers/v1/MaterialBody'
import { readRegion } from '../../../features/journal/journalRegions'
import { JournalRegionView } from './JournalRegionView'

export function JournalDraftItemRenderer({ item, note, illustration, journalImage, editing = false }: { item: JournalDraftItem; note?: Note; illustration?: Illustration; journalImage?: JournalImage; editing?: boolean }) {
  const { t } = useI18n()
  const material = item.itemType === 'material' ? resolveMaterialSnapshot(item.materialSnapshot, item.materialId) : null
  const stylePayload = { ...material?.defaultStyle, ...getMaterialStylePayload(item.stylePayload) }
  const region = item.itemType === 'material' ? readRegion(item.stylePayload) : null
  if (region) return <JournalRegionView item={item} region={region} editing={editing} />
  const paper = readRegionPaper(item)
  if (paper) return <JournalRegionPaper item={item} paper={paper} />
  if (item.itemType === 'note') return <DraftNoteBody item={item} note={note} />
  if (item.itemType === 'illustration') return <DraftIllustrationBody item={item} illustration={illustration} />
  if (item.itemType === 'image') return <DraftJournalImageBody item={item} journalImage={journalImage} />
  if (material) return <DraftMaterialBody material={material} stylePayload={stylePayload} emptyText={editing ? t('journalEdit.emptyText') : ''} />
  return null
}

function DraftNoteBody({ item, note }: { item: JournalDraftItem; note?: Note }) {
  const { t } = useI18n()
  const noteCard = getDraftNoteCardStyle(item, note, t('common.untitled'), t('common.noContent'))
  const tags = noteCard.showTags ? (note?.tags || []).slice(0, 3) : []
  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden border border-black/10 shadow-sm"
      style={{
        backgroundColor: noteCard.backgroundColor,
        color: noteCard.textColor,
        padding: noteCard.padding,
        borderRadius: noteCard.radius,
        fontFamily: getFontFamily(noteCard.fontFamily),
        fontSize: noteCard.fontSize,
        fontWeight: noteCard.fontWeight,
        lineHeight: noteCard.lineHeight,
      }}
    >
      {noteCard.titleVisible && <h4 className="mb-2 shrink-0 whitespace-pre-wrap break-words text-[1.08em] font-semibold leading-snug">{noteCard.titleText}</h4>}
      <p className="min-h-0 flex-1 whitespace-pre-wrap break-words">{noteCard.bodyText}</p>
      {tags.length > 0 && (
        <div className="mt-2 flex shrink-0 flex-wrap gap-1 overflow-hidden text-[0.78em]">
          {tags.map((tag) => <span key={tag} className="rounded-full bg-white/55 px-2 py-0.5 text-text-muted">{tag}</span>)}
        </div>
      )}
    </div>
  )
}

function DraftIllustrationBody({ item, illustration }: { item: JournalDraftItem; illustration?: Illustration }) {
  const [imageSrc, setImageSrc] = useState('')
  const [imageLoaded, setImageLoaded] = useState(false)
  const imageStyle = getDraftImageItemStyle(item)

  useEffect(() => {
    let alive = true
    let currentUrl = ''
    setImageLoaded(false)
    if (!illustration) {
      setImageSrc('')
      return
    }
    resolveMediaUrlWithFallback(illustration.thumbnail_path || illustration.original_path, illustration.original_path)
      .then((url) => {
        currentUrl = url
        if (alive) setImageSrc(url)
        else releaseMediaUrl(url)
      })
      .catch(() => { if (alive) setImageSrc('') })
    return () => {
      alive = false
      releaseMediaUrl(currentUrl)
    }
  }, [illustration])

  const imagePadding = getImagePadding(imageStyle)
  const bottomPadding = getImageBottomPadding(imageStyle)
  return (
    <div className="h-full w-full overflow-hidden" style={getImageFrameStyle(imageStyle)}>
      <div className="h-full w-full overflow-hidden" style={{ padding: `${imagePadding}px ${imagePadding}px ${bottomPadding}px`, borderRadius: imageStyle.radius }}>
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={illustration?.title || ''}
            className={clsx('h-full w-full transition-opacity duration-300', imageLoaded ? 'opacity-100' : 'opacity-0')}
            style={{ objectFit: imageStyle.fit }}
            draggable={false}
            decoding="async"
            ref={(el) => {
              if (el?.complete && el.naturalWidth > 0) setImageLoaded(true)
            }}
            onLoad={() => setImageLoaded(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-text-muted"><ImageIcon size={28} /></div>
        )}
      </div>
    </div>
  )
}

function DraftJournalImageBody({ item, journalImage }: { item: JournalDraftItem; journalImage?: JournalImage }) {
  const imageStyle = getDraftImageItemStyle(item)
  const imagePadding = getImagePadding(imageStyle)
  const bottomPadding = getImageBottomPadding(imageStyle)
  if (!journalImage) {
    return <div className="flex h-full w-full items-center justify-center text-text-muted"><ImageIcon size={28} /></div>
  }
  return (
    <div className="h-full w-full overflow-hidden" style={getImageFrameStyle(imageStyle)}>
      <div className="h-full w-full overflow-hidden" style={{ padding: `${imagePadding}px ${imagePadding}px ${bottomPadding}px`, borderRadius: imageStyle.radius }}>
        <MediaImage
          path={journalImage.file_path}
          alt={journalImage.original_filename}
          className="h-full w-full"
          reserveHeight={false}
          eager
          imgStyle={{ objectFit: imageStyle.fit }}
        />
      </div>
    </div>
  )
}
