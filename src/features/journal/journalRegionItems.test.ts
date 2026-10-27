import { describe, expect, it } from 'vitest'
import { createRegionItem, readRegion, writeRegion, layoutRegion, newRegion, type RegionEntry } from './journalRegions'
import { arrangeRegionItems, collectRegionEntry, finalizeStrips, materializeRegions, memberOf, paperEntry, readRegionPaper, regionForItem, regionOverlap, removeRegionAware, updateRegionItems } from './journalRegionItems'
import { parseStylePayload } from './journalItemStyles'
import { captureJournalLayout } from './journalReusableLayouts'
import { journalItemToDraftItem } from './journalDraftAdapters'
import type { JournalItemWithNote } from '../../types'

const entry = (id: string, date = '2026-10-06'): RegionEntry => ({ id, kind: 'note', title: id, text: `Full source ${id}`, date })
function populated(kind: 'notes' | 'strips' = 'notes') {
  const zone = createRegionItem(kind, 'zone')
  return materializeRegions([writeRegion(zone, { ...readRegion(zone.stylePayload)!, stickers: false, count: 2, entries: [entry('first'), entry('second', '2026-10-08')] })])
}
describe('independent functional-region paper', () => {
  it('moving a legacy container never moves unrelated materials', () => {
    const zone = createRegionItem('notes', 'legacy'), other = { ...createRegionItem('notes', 'other'), stylePayload: '{}', x: 700 }
    const moved = updateRegionItems([zone, other], { ...zone, x: zone.x + 20 })
    expect(moved[1]).toEqual(other)
  })
  it('generated stickers become ordinary independent materials on confirmation', () => {
    const zone = createRegionItem('strips', 'zone')
    const items = materializeRegions([writeRegion(zone, { ...readRegion(zone.stylePayload)!, entries: [{ ...entry('first'), sticker: 'angel-wings' }] })])
    const sticker = items.find(item => item.materialId === 'angel-wings')!
    expect(sticker).toBeDefined()
    const edited = updateRegionItems(items, { ...sticker, x: 30, rotation: 25 })
    const done = finalizeStrips(edited, 'zone')
    expect(done.find(item => item.draftId === sticker.draftId)).toMatchObject({ x: 30, rotation: 25 })
    expect(parseStylePayload(done.find(item => item.draftId === sticker.draftId)!.stylePayload).regionSticker).toBeUndefined()
  })
  it('migrates legacy entries once into independently persisted paper', () => {
    const items = populated(), papers = items.filter(memberOf)
    expect(papers).toHaveLength(2)
    expect(readRegion(items[0].stylePayload)).toMatchObject({ external: true, entries: [] })
    expect(paperEntry(papers[0])?.text).toBe('Full source first')
    expect(materializeRegions(items)).toEqual(items)
    const reopened = items.flatMap(item => journalItemToDraftItem({ id: item.draftId, item_type: item.itemType, material_id: item.materialId, style_payload: item.stylePayload, x: item.x, y: item.y, width: item.width, height: item.height, rotation: item.rotation, z_index: item.zIndex } as JournalItemWithNote))
    expect(materializeRegions(reopened)).toEqual(reopened)
    expect(reopened.filter(item => memberOf(item) === readRegion(reopened[0].stylePayload)?.id)).toHaveLength(2)
  })
  it('keeps a manual child move and text edit without rearranging other papers', () => {
    const items = populated(), paper = items.find(memberOf)!, other = items.filter(memberOf)[1]
    const moved = updateRegionItems(items, { ...paper, x: paper.x + 10, rotation: 8 })
    expect(moved.find(item => item.draftId === paper.draftId)).toMatchObject({ x: paper.x + 10, rotation: 8 })
    expect(moved.find(item => item.draftId === other.draftId)).toEqual(other)
    const edited = { ...paper, stylePayload: JSON.stringify({ ...parseStylePayload(paper.stylePayload), noteCard: { titleText: 'My title', bodyText: 'My words' } }) }
    const collected = collectRegionEntry(updateRegionItems(items, edited), 'zone', entry('third'))
    expect(paperEntry(collected.find(item => item.draftId === paper.draftId)!)).toMatchObject({ title: 'My title', text: 'My words' })
  })
  it('collects and time-sorts, deduplicates, preserves edited text and source identity', () => {
    const items = populated(), next = collectRegionEntry(items, 'zone', entry('early', '2026-10-05'))
    expect(next.filter(memberOf)).toHaveLength(3)
    expect([...next.filter(memberOf)].sort((a,b) => a.y-b.y)[0]).toMatchObject({ stylePayload: expect.stringContaining('early') })
    expect(collectRegionEntry(next, 'zone', entry('early'))).toEqual(next)
    const original = { ...createRegionItem('notes', 'ordinary'), itemType: 'note' as const, sourceId: 'source', originItemId: 'persisted', stylePayload: '{}' }
    const result = collectRegionEntry([...items, original], 'zone', entry('source'), original.draftId)
    expect(result.find(item => item.draftId === original.draftId)).toMatchObject({ itemType: 'note', sourceId: 'source', originItemId: 'persisted' })
  })
  it('releases a dragged-out child, and moving a container preserves manual offsets', () => {
    const items = populated(), paper = items.find(memberOf)!
    const detached = updateRegionItems(items, { ...paper, x: 900, y: 900 }).find(item => item.draftId === paper.draftId)!
    expect(memberOf(detached)).toBeUndefined()
    expect(paperEntry(detached)).toEqual(paperEntry(paper))
    const moved = updateRegionItems(items, { ...items[0], x: items[0].x + 40, y: items[0].y + 30 })
    expect(moved.find(item => item.draftId === paper.draftId)).toMatchObject({ x: paper.x + 40, y: paper.y + 30, width: paper.width })
  })
  it('requires substantial overlap, including rotated collectors and locked exclusions', () => {
    const items = populated(), zone = items[0], paper = items.find(memberOf)!
    expect(regionOverlap(zone, paper)).toBeGreaterThan(.9)
    expect(regionForItem(items, paper)?.draftId).toBe(zone.draftId)
    expect(regionForItem([{ ...zone, stylePayload: JSON.stringify({ ...parseStylePayload(zone.stylePayload), locked: true }) }], paper)).toBeUndefined()
    expect(regionOverlap(zone, { ...paper, x: zone.x + zone.width - paper.width * .2 })).toBeLessThan(.45)
    const rotated = { ...zone, rotation: 90 }
    expect(regionOverlap(rotated, { ...paper, x: zone.x + zone.width / 2 - paper.width / 2, y: zone.y + zone.height / 2 - paper.height / 2, rotation: 90 })).toBe(1)
  })
  it('finishes the strip generator while retaining every independent material and text', () => {
    const items = populated('strips'), done = finalizeStrips(items, 'zone')
    expect(done).toHaveLength(items.length)
    expect(done.some(item => readRegion(item.stylePayload))).toBe(false)
    expect(done.some(memberOf)).toBe(false)
    expect(done.filter(readRegionPaper).map(paperEntry)).toEqual(items.filter(readRegionPaper).map(paperEntry))
    expect(removeRegionAware(items, ['zone']).filter(readRegionPaper)).toHaveLength(2)
    expect(removeRegionAware(items, ['zone']).some(memberOf)).toBe(false)
  })
  it('generates requested empty rows, fills them and never discards filled rows on reduction', () => {
    let items = materializeRegions([createRegionItem('strips', 'zone')])
    expect(items.filter(readRegionPaper)).toHaveLength(6)
    items = collectRegionEntry(items, 'zone', entry('first'))
    expect(items.filter(readRegionPaper)).toHaveLength(6)
    const zone = items.find(item => item.draftId === 'zone')!
    items = updateRegionItems(items, writeRegion(zone, { ...readRegion(zone.stylePayload)!, count: 1 }))
    expect(items.filter(readRegionPaper)).toHaveLength(1)
    expect(paperEntry(items.find(readRegionPaper)!)?.title).toBe('first')
  })
  it('reflow leaves locked paper untouched', () => {
    const items = populated(), paper = items.find(memberOf)!
    const locked = { ...paper, x: 150, stylePayload: JSON.stringify({ ...parseStylePayload(paper.stylePayload), locked: true }) }
    const next = arrangeRegionItems(items.map(item => item.draftId === paper.draftId ? locked : item), 'zone')
    expect(next.find(item => item.draftId === paper.draftId)).toEqual(locked)
  })
  it('reusable templates contain rules, with no copied private text or stale region identity', () => {
    for (const items of [populated(), finalizeStrips(populated('strips'), 'zone')]) {
      const template = captureJournalLayout({ oshiId: 'o', title: '', description: '', dateLabel: '', background: 'sakura', orientation: 'landscape', stamp: null, items }, 'reuse', 'reuse')
      expect(JSON.stringify(template)).not.toContain('Full source')
      expect(JSON.stringify(template)).not.toContain('regionMember')
      for (const decoration of template.decorations) { const region = readRegion(JSON.stringify(decoration.styleOverrides)); if (region) { expect(region.external).toBe(false); expect(region.id).toBeUndefined() } }
    }
  })
  it('uses the same two-column geometry for string, board and grid, and keeps pockets visible', () => {
    const r = { ...newRegion('notes'), entries: Array.from({ length: 6 }, (_, i) => entry(String(i))) }
    const geometry = (style: 'string' | 'board' | 'grid') => layoutRegion({ ...r, style }, 340, 420).map(({ x, y, width, height }) => ({ x, y, width, height }))
    expect(geometry('string')).toEqual(geometry('board'))
    expect(geometry('string')).toEqual(geometry('grid'))
    expect(geometry('string')[0].width).toBeCloseTo((340 - 44 - 12) / 2)
    expect(geometry('string')[0].y).toBe(geometry('string')[1].y)
    expect(geometry('string')[2].y).toBeGreaterThan(geometry('string')[0].y)
    const small = layoutRegion({ ...r, style: 'box' }, 340, 420), large = layoutRegion({ ...r, style: 'box' }, 500, 600)
    expect(large[0].width).toBeGreaterThan(small[0].width)
    expect(large[0].height).toBeGreaterThan(small[0].height)
    expect(small.at(-1)!.y).toBeLessThan(420 * .82 - 20)
    expect(small.at(-1)!.y + small.at(-1)!.height).toBeGreaterThan(420 * .82)
  })
})
