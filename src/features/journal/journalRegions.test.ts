import { describe, expect, it } from 'vitest'
import { addRegionEntries, createRegionItem, excerpt, layoutRegion, newRegion, orderedRegionEntries, readRegion, regionAtPoint, writeRegion, type RegionEntry } from './journalRegions'
import { applyJournalPageTemplate } from './journalPageTemplates'
import { captureJournalLayout } from './journalReusableLayouts'
import { journalItemToDraftItem } from './journalDraftAdapters'
import type { JournalItemWithNote } from '../../types'

const entry = (id: string, date = '2026-10-06'): RegionEntry => ({ id, kind: 'note', date, title: id, text: 'Original reflection 👻 with extra content' })
describe('semi-automatic journal regions', () => {
  it('deduplicates within a region, grows rows, and preserves source text', () => {
    const source = entry('one'), original = JSON.stringify(source)
    const r = addRegionEntries({ ...newRegion('strips'), count: 1 }, [source, entry('two'), source])
    expect(r.entries).toHaveLength(2); expect(r.count).toBe(2)
    expect(JSON.stringify(source)).toBe(original)
    expect(addRegionEntries(newRegion('notes'), [source]).entries).toHaveLength(1)
  })
  it('sorts stably without mutating insertion order', () => {
    const r = addRegionEntries(newRegion('notes'), [entry('late', '2026-10-10'), entry('early'), entry('same')])
    expect(orderedRegionEntries(r).map(e => e.id)).toEqual(['early', 'same', 'late'])
    expect(orderedRegionEntries({ ...r, sort: 'desc' }).map(e => e.id)).toEqual(['late', 'early', 'same'])
    expect(orderedRegionEntries({ ...r, sort: 'added' }).map(e => e.id)).toEqual(['late', 'early', 'same'])
  })
  it('truncates Unicode characters without splitting surrogate pairs', () => {
    expect(excerpt('a👻bc', 2)).toBe('a👻…'); expect(excerpt('anything', 0)).toBe('')
  })
  it('uses deterministic geometry and keeps six weekly cards within the region', () => {
    for (const kind of ['notes', 'strips'] as const) for (const style of ['loose', 'box', 'string', 'board', 'grid'] as const) {
      const r = { ...addRegionEntries(newRegion(kind), Array.from({ length: 6 }, (_, i) => entry(String(i)))), style }
      const cards = layoutRegion(r, 550, 630)
      expect(cards).toEqual(layoutRegion(r, 550, 630)); expect(cards).toHaveLength(6)
      for (const c of cards) { expect(c.x).toBeGreaterThan(0); expect(c.y).toBeGreaterThan(0); expect(c.x + c.width).toBeLessThan(550); expect(c.y + c.height).toBeLessThan(630) }
    }
  })
  it('hit-tests rotated containers and excludes locked or staged regions', () => {
    const item = { ...createRegionItem('notes', 'r'), x: 100, y: 100, width: 300, height: 200, rotation: 90 }
    expect(regionAtPoint([item], { x: 250, y: 70 })?.draftId).toBe('r')
    expect(regionAtPoint([{ ...item, staged: true }], { x: 250, y: 200 })).toBeUndefined()
    expect(regionAtPoint([{ ...item, stylePayload: JSON.stringify({ ...JSON.parse(item.stylePayload!), locked: true }) }], { x: 250, y: 200 })).toBeUndefined()
  })
  it('round-trips through existing persisted material items', () => {
    const item = writeRegion(createRegionItem('strips', 'r'), addRegionEntries(newRegion('strips'), [entry('one')]))
    const saved = { id: 'saved', item_type: 'material', material_id: 'memo-cream', style_payload: item.stylePayload, x: 0, y: 0, width: 500, height: 600, rotation: 0, z_index: 1 } as JournalItemWithNote
    expect(readRegion(journalItemToDraftItem(saved)[0].stylePayload)?.entries).toEqual(readRegion(item.stylePayload)?.entries)
  })
  it('reusable templates retain rules but never last week’s contents', () => {
    const item = writeRegion(createRegionItem('notes', 'r'), { ...addRegionEntries(newRegion('notes'), [entry('private')]), style: 'box', color: '#e1d1c1' })
    const template = captureJournalLayout({ oshiId: 'o', title: '', description: '', dateLabel: '', background: 'sakura', orientation: 'landscape', stamp: null, items: [item] }, 'test', 'test')
    const r = readRegion(JSON.stringify(template.decorations[0].styleOverrides))!
    expect(r.entries).toEqual([]); expect(r.style).toBe('box'); expect(r.color).toBe('#e1d1c1')
    expect(JSON.stringify(template)).not.toContain('private')
  })
  it('weekly template creates real regions and keeps their contents when changing row count', () => {
    const initial = applyJournalPageTemplate('weekly-reflections-4', [])
    expect(initial.items.filter(i => readRegion(i.stylePayload))).toHaveLength(2)
    const populated = initial.items.map(i => readRegion(i.stylePayload) ? writeRegion(i, addRegionEntries(readRegion(i.stylePayload)!, [entry('one')])) : i)
    const changed = applyJournalPageTemplate('weekly-reflections-6', populated)
    expect(changed.items.filter(i => readRegion(i.stylePayload))).toHaveLength(2)
    for (const i of changed.items.filter(i => readRegion(i.stylePayload))) expect(readRegion(i.stylePayload)?.entries).toHaveLength(1)
    expect(readRegion(changed.items.find(i => readRegion(i.stylePayload)?.kind === 'strips')!.stylePayload)?.count).toBe(6)
  })
  it('rejects unknown versions and normalizes malformed settings', () => {
    expect(readRegion('{"region":{"version":2,"kind":"notes"}}')).toBeNull()
    expect(readRegion(JSON.stringify({ region: { ...newRegion('notes'), style: 'broken', color: 'url(x)', count: -4, entries: [null, entry('one'), entry('one')] } }))).toMatchObject({ style: 'loose', count: 1, color: '#eee8f3', entries: [expect.objectContaining({ id: 'one' })] })
  })
})
