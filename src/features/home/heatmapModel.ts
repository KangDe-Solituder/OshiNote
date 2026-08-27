import { addDays, dateKeyToDate, noteDateKey, toLocalDateKey } from '../schedule/scheduleModel'

export type HeatmapRange = 'month' | 'quarter' | 'year'

export interface DayActivity {
  date: string
  notes: number
  illustrations: number
  journalPages: number
}

export interface HeatmapCell extends DayActivity {
  total: number
  level: 0 | 1 | 2 | 3 | 4
  future: boolean
}

export function getIntensityLevel(total: number): 0 | 1 | 2 | 3 | 4 {
  if (total <= 0) return 0
  if (total <= 2) return 1
  if (total <= 5) return 2
  if (total <= 9) return 3
  return 4
}

export function getRangeStartKey(range: HeatmapRange, today: Date): string {
  if (range === 'month') return toLocalDateKey(new Date(today.getFullYear(), today.getMonth(), 1))
  const days = range === 'quarter' ? 89 : 364
  return addDays(toLocalDateKey(today), -days)
}

/**
 * Weeks (columns) x weekdays (rows, Monday first), covering [startKey, today].
 * Days after today are marked future so the UI can mute them.
 */
export function buildHeatmapGrid(activities: Map<string, DayActivity>, startKey: string, todayKey: string): HeatmapCell[][] {
  const start = dateKeyToDate(startKey)
  const mondayOffset = (start.getDay() + 6) % 7
  const gridStart = addDays(startKey, -mondayOffset)

  const weeks: HeatmapCell[][] = []
  let weekStart = gridStart
  while (weekStart <= todayKey) {
    const week: HeatmapCell[] = []
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const date = addDays(weekStart, dayIndex)
      const activity = activities.get(date) || { date, notes: 0, illustrations: 0, journalPages: 0 }
      const total = activity.notes + activity.illustrations + activity.journalPages
      week.push({
        ...activity,
        total,
        level: date < startKey ? 0 : getIntensityLevel(total),
        future: date > todayKey,
      })
    }
    weeks.push(week)
    weekStart = addDays(weekStart, 7)
  }
  return weeks
}

/** Month labels above the columns: a label appears on the first week that contains a day of that month. */
export function getColumnMonthLabels(weeks: HeatmapCell[][]): (string | null)[] {
  let lastMonth = ''
  return weeks.map((week) => {
    const firstVisible = week.find((cell) => !cell.future) || week[0]
    const month = firstVisible.date.slice(5, 7)
    if (month !== lastMonth) {
      lastMonth = month
      return month
    }
    return null
  })
}

export function emptyActivity(date: string): DayActivity {
  return { date, notes: 0, illustrations: 0, journalPages: 0 }
}

export function noteActivityDate(createdAt: string): string {
  return noteDateKey({ created_at: createdAt })
}
