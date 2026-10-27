import { getFontFamily } from '../../../features/journal/journalItemStyles'
import type { JournalDraftItem } from '../../../types'
import { readRegion } from '../../../features/journal/journalRegions'

/** Front flaps live above independent cards; pointer events pass through to the paper. */
export function JournalRegionPockets({ items }: { items: JournalDraftItem[] }) {
  const zIndex = Math.max(0, ...items.map(item => item.zIndex)) + 1
  return <>{items.map(item => {
    const region = readRegion(item.stylePayload)
    if (item.staged || !region?.external || region.kind !== 'notes' || region.style !== 'box') return null
    return <div key={item.draftId} data-region-pocket="true" className="pointer-events-none absolute" style={{ left: item.x, top: item.y, width: item.width, height: item.height, transform: `rotate(${item.rotation}deg)`, zIndex }}>
      <div className="absolute bottom-0 left-2 right-2 flex h-[18%] items-center justify-center rounded-b-xl border border-black/10" style={{ background: 'linear-gradient(165deg, #e6cfdd, #cfaec5)', boxShadow: '0 -3px 5px #77546922, inset 0 2px 0 #fff8', color: '#856878', fontFamily: getFontFamily('casual'), fontSize: 12, letterSpacing: 3 }}>♡ MEMORIES ♡</div>
    </div>
  })}</>
}
