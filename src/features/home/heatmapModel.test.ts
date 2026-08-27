import { describe, expect, it } from 'vitest'
import { buildHeatmapGrid, getColumnMonthLabels, getIntensityLevel, getRangeStartKey, type DayActivity } from './heatmapModel'

describe('getIntensityLevel', () => {
  it('buckets totals into five levels', () => {
    expect(getIntensityLevel(0)).toBe(0)
    expect(getIntensityLevel(2)).toBe(1)
    expect(getIntensityLevel(5)).toBe(2)
    expect(getIntensityLevel(9)).toBe(3)
    expect(getIntensityLevel(10)).toBe(4)
  })
})

describe('getRangeStartKey', () => {
  const today = new Date(2026, 7, 27) // 2026-08-27

  it('starts at the first day of the month for month range', () => {
    expect(getRangeStartKey('month', today)).toBe('2026-08-01')
  })

  it('goes back ~90 days for quarter and ~364 for year', () => {
    expect(getRangeStartKey('quarter', today)).toBe('2026-05-30')
    expect(getRangeStartKey('year', today)).toBe('2025-08-28')
  })
})

describe('buildHeatmapGrid', () => {
  it('aligns weeks to Monday and marks future cells', () => {
    // 2026-08-27 is a Thursday; grid should start on Monday 2026-08-24 for month range... actually month starts 08-01.
    const activities = new Map<string, DayActivity>([
      ['2026-08-26', { date: '2026-08-26', notes: 2, illustrations: 1, journalPages: 0 }],
    ])
    const weeks = buildHeatmapGrid(activities, '2026-08-01', '2026-08-27')
    // 2026-08-01 is a Saturday, so the first week starts Monday 2026-07-27.
    expect(weeks[0][0].date).toBe('2026-07-27')
    const flat = weeks.flat()
    const target = flat.find((cell) => cell.date === '2026-08-26')
    expect(target?.total).toBe(3)
    expect(target?.level).toBe(2)
    expect(flat.find((cell) => cell.date === '2026-08-28')?.future).toBe(true)
    expect(flat.every((cell) => cell.date >= '2026-07-27')).toBe(true)
    // Days before the range start are muted to level 0.
    expect(flat.find((cell) => cell.date === '2026-07-31')?.level).toBe(0)
  })

  it('produces month labels on month boundaries', () => {
    const weeks = buildHeatmapGrid(new Map(), '2025-12-15', '2026-01-10')
    const labels = getColumnMonthLabels(weeks)
    expect(labels.length).toBe(weeks.length)
    expect(labels.filter(Boolean)).toContain('12')
    expect(labels.filter(Boolean)).toContain('01')
  })
})
