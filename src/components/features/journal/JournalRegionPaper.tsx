import type { JournalDraftItem } from '../../../types'
import { excerpt } from '../../../features/journal/journalRegions'
import { paperEntry, type RegionPaper } from '../../../features/journal/journalRegionItems'
import { getFontFamily, parseStylePayload } from '../../../features/journal/journalItemStyles'
import { isRecord } from '../../../utils/safeJson'
import { MediaImage } from '../../ui/MediaImage'

export function JournalRegionPaper({ item, paper }: { item: JournalDraftItem; paper: RegionPaper }) {
  const style = parseStylePayload(item.stylePayload), text = isRecord(style.noteCard) ? style.noteCard : {}
  const entry = paperEntry(item)!, strips = paper.kind === 'strips', holes = strips && paper.holes !== 'none'
  const fontSize = typeof text.fontSize === 'number' ? text.fontSize : strips ? Math.min(17, Math.max(9, (item.height - 24) / (1.4 + paper.lines * 1.55))) : Math.min(15, Math.max(9, item.width / 16))
  const lineHeight = typeof text.lineHeight === 'number' ? text.lineHeight : 1.55
  const padding = Math.max(6, Math.min(14, item.height * .12))
  const lines = strips ? paper.lines : Math.max(1, Math.floor((item.height - padding * 2 - fontSize * 1.5 - 4) / (fontSize * lineHeight)))
  return <div data-region-paper={paper.kind} className="relative h-full w-full" style={{ fontFamily: getFontFamily(typeof text.fontFamily === 'string' && text.fontFamily || 'casual'), color: typeof text.textColor === 'string' ? text.textColor : '#655460', fontSize, lineHeight }}>
    {paper.style === 'string' && !strips && <div className="absolute" style={{ top: -8, left: -12, right: -12, borderTop: '2px solid #b99e87' }} />}
    <div className="h-full w-full overflow-hidden rounded-lg border border-black/10" style={{ background: typeof style.color === 'string' ? style.color : '#fbe5ee', boxShadow: '1px 3px 5px #6f536226', padding, paddingLeft: holes && paper.holes === 'left' ? 32 : padding, paddingRight: holes && paper.holes === 'right' ? 32 : padding }}>
      {holes && [25, 75].map(top => <span key={top} style={{ position: 'absolute', top: `calc(${top}% - 4px)`, [paper.holes]: 10, width: 8, height: 8, borderRadius: '50%', background: paper.backing, boxShadow: 'inset 0 1px 2px #735f6666' }} />)}
      <div style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', fontWeight: 700, lineHeight: 1.4, marginBottom: 4 }} title={entry.title}>{entry.date.slice(5, 10).replace('-', '/')} {entry.title}</div>
      {entry.path ? <MediaImage path={entry.path} alt={entry.title} reserveHeight={false} eager className="h-[70%] w-full" imgStyle={{ objectFit: 'cover' }} /> : <div style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: lines, overflow: 'hidden', overflowWrap: 'anywhere', fontWeight: typeof text.fontWeight === 'number' ? text.fontWeight : 400 }}>{excerpt(entry.text, paper.limit)}</div>}
    </div>
    {(strips || paper.style === 'loose' || paper.style === 'grid') && <div style={{ position: 'absolute', top: -5, left: paper.index % 2 ? '66%' : '12%', width: strips ? 54 : 38, height: 11, borderRadius: 3, transform: `rotate(${paper.index % 2 ? -4 : 3}deg)`, backgroundColor: ['#efb6d1bb', '#afdbf5bb', '#f0d68abb'][paper.index % 3], backgroundImage: 'radial-gradient(#ffffff80 1.5px, transparent 2px)', backgroundSize: '10px 10px' }} />}
    {paper.style === 'board' && !strips && <span className="absolute" style={{ top: -4, left: '50%', width: 9, height: 9, borderRadius: '50%', background: '#b87683', boxShadow: '1px 2px 2px #65445555' }} />}
    {paper.style === 'string' && !strips && <span className="absolute" style={{ top: -13, left: '48%', width: 8, height: 22, borderRadius: 2, background: '#caa685', boxShadow: '1px 1px 2px #65445544' }} />}
  </div>
}
