export interface MasonryPosition {
  x: number
  y: number
}

export function calculateMasonryLayout(
  itemHeights: number[],
  columnCount: number,
  itemWidth: number,
  gap: number
): { positions: MasonryPosition[]; height: number } {
  const safeColumnCount = Math.max(1, Math.floor(columnCount))
  const columnHeights = Array.from({ length: safeColumnCount }, () => 0)
  const positions = itemHeights.map((height) => {
    let column = 0
    for (let index = 1; index < columnHeights.length; index += 1) {
      if (columnHeights[index] < columnHeights[column]) column = index
    }
    const position = { x: column * (itemWidth + gap), y: columnHeights[column] }
    columnHeights[column] += Math.max(0, height) + gap
    return position
  })
  return {
    positions,
    height: itemHeights.length > 0 ? Math.max(0, ...columnHeights) - gap : 0,
  }
}
