import { getFontFamily } from '../../../features/journal/journalItemStyles'
import type { JournalDraftItem } from '../../../types'
import { excerpt, layoutRegion, type JournalRegion } from '../../../features/journal/journalRegions'
import { JournalStickerArt } from './JournalStickerArt'
import { MediaImage } from '../../ui/MediaImage'
import { useI18n } from '../../../i18n/useI18n'

export function JournalRegionView({ item, region, editing }: { item: JournalDraftItem; region: JournalRegion; editing: boolean }) {
  const { t } = useI18n()
  const cards = region.external ? [] : layoutRegion(region, item.width, item.height)
  const strips = region.kind === 'strips'
  return <div data-journal-region={region.kind} className="relative h-full w-full rounded-2xl border border-black/10" style={{ background: region.style === 'board' && !strips ? '#e8d6c0' : region.color, color: '#655460', boxShadow: '0 2px 5px #725b7312', fontFamily: getFontFamily('casual') }}>
    <div className="absolute left-5 right-5 top-3 flex items-center justify-between gap-2" style={{ fontFamily: getFontFamily('casual'), fontSize: 10, letterSpacing: 1 }}><span className="truncate">{region.title || t(strips ? 'journalRegions.strips' : 'journalRegions.notes')}</span><span>{region.external && !strips ? '' : String(region.external ? region.count : region.entries.length).padStart(2, '0')} ♡</span></div>
    {cards.map(card => {
      const entry = card.entry, blank = !entry, holes = strips && region.holes !== 'none'
      const fontSize = strips ? Math.min(17, Math.max(10, (card.height - 28) / (1.4 + region.lines * 1.55))) : Math.min(14, Math.max(10, card.width / 15))
      const stickerSize = Math.min(49, card.height * 0.65), anchor = entry?.stickerAnchor ?? card.index % 6
      return <div key={entry ? `${entry.kind}:${entry.id}` : `blank-${card.index}`} data-region-entry={entry?.id} className="absolute" style={{ left: card.x, top: card.y, width: card.width, height: card.height, transform: `rotate(${card.rotation}deg)`, zIndex: card.index + 1 }}>
        {!strips && region.style === 'string' && <div style={{ position: 'absolute', top: -8, left: -8, right: -8, borderTop: '2px solid #b99e87' }} />}
        <div className="h-full w-full overflow-hidden rounded-lg border border-black/10" style={{ background: card.color, boxShadow: '1px 3px 4px #6f53621b', padding: strips ? '10px 20px' : '16px 14px', paddingLeft: holes && region.holes === 'left' ? 34 : undefined, paddingRight: holes && region.holes === 'right' ? 34 : undefined, fontSize, lineHeight: 1.55 }}>
          {holes && [0.25, 0.75].map(position => <span key={position} style={{ position: 'absolute', top: `calc(${position * 100}% - 4px)`, [region.holes]: 10, width: 8, height: 8, borderRadius: '50%', background: region.color, boxShadow: 'inset 0 1px 2px #735f6666' }} />)}
          {entry && <>
            <div style={{ fontWeight: 700, lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 6 }} title={entry.title}>
              {entry.date.slice(5, 10).replace('-', '/')} {'\u2002'}{entry.title}
            </div>
            {entry.kind === 'image' && entry.path ? <MediaImage path={entry.path} alt={entry.title} reserveHeight={false} eager className="h-[70%] w-full" imgStyle={{ objectFit: 'cover' }} /> : <div style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: strips ? region.lines : Math.max(1, Math.floor((card.height - 58) / (fontSize * 1.55))), overflow: 'hidden', overflowWrap: 'anywhere' }}>{excerpt(entry.text, region.limit)}</div>}
          </>}
          {blank && editing && <div data-journal-placeholder="true" className="flex h-full items-center justify-center text-center opacity-50" style={{ fontFamily: 'sans-serif', fontSize: 12 }}>{t('journalRegions.dropHint')}</div>}
        </div>
        {(strips || region.style === 'loose' || region.style === 'grid') && <div style={{ position: 'absolute', top: -5, left: card.index % 2 ? '68%' : '12%', width: strips ? 64 : 42, height: 13, borderRadius: 4, transform: `rotate(${card.index % 2 ? -4 : 3}deg)`, backgroundColor: ['#efb6d1bb', '#afdbf5bb', '#f0d68abb'][card.index % 3], backgroundImage: 'radial-gradient(#ffffff80 1.5px, transparent 2px)', backgroundSize: '10px 10px' }} />}
        {!strips && region.style === 'board' && <span style={{ position: 'absolute', top: -4, left: '50%', width: 9, height: 9, borderRadius: '50%', background: '#b87683', boxShadow: '1px 2px 2px #65445555' }} />}
        {!strips && region.style === 'string' && <span style={{ position: 'absolute', top: -13, left: '48%', width: 8, height: 22, borderRadius: 2, background: '#caa685', boxShadow: '1px 1px 2px #65445544' }} />}
        {strips && entry && region.stickers && entry.sticker !== 'none' && <div style={{ position: 'absolute', width: stickerSize, height: stickerSize, left: anchor % 2 === 0 ? -17 : undefined, right: anchor % 2 === 1 ? -17 : undefined, top: anchor < 2 ? -12 : anchor < 4 ? (card.height - stickerSize) / 2 : undefined, bottom: anchor >= 4 ? -10 : undefined, transform: `rotate(${anchor % 2 ? 9 : -9}deg)` }}><JournalStickerArt icon={entry.sticker || ['flower', 'star', 'music-note', 'angel-wings', 'arcane-books', 'heart'][card.index % 6]} size="100%" color={['#e999ba', '#d3ac69', '#a99bcf'][card.index % 3]} outline /></div>}
      </div>
    })}
    {!strips && region.style === 'box' && <div className="absolute bottom-0 left-2 right-2 z-40 flex h-[18%] items-center justify-center rounded-b-xl border border-black/10" style={{ background: '#d8bdd0', boxShadow: '0 -3px 5px #77546922', fontSize: 12, letterSpacing: 3 }}>♡ MEMORIES ♡</div>}
  </div>
}
