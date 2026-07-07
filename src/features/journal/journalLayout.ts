import type { JournalItem, JournalPageOrientation, JournalStickerStyle, Note } from '../../types'

export const JOURNAL_PAGE = {
  width: 700,
  height: 980,
  padding: 36,
  maxWidth: 2200,
  maxHeight: 1600,
}

export const JOURNAL_PAGE_LANDSCAPE = {
  width: 980,
  height: 700,
}

export const DEFAULT_STICKER = {
  width: 250,
  height: 180,
}

export interface JournalLayoutInput {
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

export function createInitialLayout(index: number): JournalLayoutInput & {
  z_index: number
  sticker_style: JournalStickerStyle
  color: string
} {
  const columns = 3
  const gapX = 34
  const gapY = 32
  const col = index % columns
  const row = Math.floor(index / columns)
  const style = STYLES[index % STYLES.length]

  return {
    x: JOURNAL_PAGE.padding + col * (DEFAULT_STICKER.width + gapX),
    y: JOURNAL_PAGE.padding + row * (DEFAULT_STICKER.height + gapY),
    width: DEFAULT_STICKER.width,
    height: DEFAULT_STICKER.height,
    rotation: ROTATIONS[index % ROTATIONS.length],
    z_index: index,
    sticker_style: style,
    color: COLORS[index % COLORS.length],
  }
}

export function getJournalPageSize(orientation: JournalPageOrientation = 'portrait'): { width: number; height: number } {
  return orientation === 'landscape'
    ? { width: JOURNAL_PAGE_LANDSCAPE.width, height: JOURNAL_PAGE_LANDSCAPE.height }
    : { width: JOURNAL_PAGE.width, height: JOURNAL_PAGE.height }
}

export function autoArrangeNotes(notes: Note[]): Map<string, JournalLayoutInput> {
  const layouts = new Map<string, JournalLayoutInput>()
  notes.forEach((note, index) => {
    const layout = createInitialLayout(index)
    layouts.set(note.id, {
      x: layout.x,
      y: layout.y,
      width: layout.width,
      height: layout.height,
      rotation: layout.rotation,
    })
  })
  return layouts
}

export function clampLayout(
  input: JournalLayoutInput,
  constraints: { minWidth?: number; minHeight?: number } = {},
  orientation: JournalPageOrientation = 'portrait'
): JournalLayoutInput {
  const pageSize = getJournalPageSize(orientation)
  const minWidth = constraints.minWidth ?? 180
  const minHeight = constraints.minHeight ?? 130
  const width = Math.min(Math.max(input.width, minWidth), Math.min(JOURNAL_PAGE.maxWidth, pageSize.width) - JOURNAL_PAGE.padding)
  const height = Math.min(Math.max(input.height, minHeight), Math.min(JOURNAL_PAGE.maxHeight, pageSize.height) - JOURNAL_PAGE.padding)
  const x = Math.min(Math.max(input.x, JOURNAL_PAGE.padding / 2), pageSize.width - width - JOURNAL_PAGE.padding / 2)
  const y = Math.min(Math.max(input.y, JOURNAL_PAGE.padding / 2), pageSize.height - height - JOURNAL_PAGE.padding / 2)

  return {
    x,
    y,
    width,
    height,
    rotation: Math.min(Math.max(input.rotation, -18), 18),
  }
}

export function getJournalCanvasSize(
  items: Pick<JournalItem, 'x' | 'y' | 'width' | 'height'>[],
  orientation: JournalPageOrientation = 'portrait'
): { width: number; height: number } {
  const pageSize = getJournalPageSize(orientation)
  const contentWidth = items.reduce((max, item) => Math.max(max, item.x + item.width + JOURNAL_PAGE.padding), pageSize.width)
  const contentHeight = items.reduce((max, item) => Math.max(max, item.y + item.height + JOURNAL_PAGE.padding), pageSize.height)

  return {
    width: Math.min(Math.max(pageSize.width, Math.ceil(contentWidth)), JOURNAL_PAGE.maxWidth),
    height: Math.min(Math.max(pageSize.height, Math.ceil(contentHeight)), JOURNAL_PAGE.maxHeight),
  }
}

export function getNextZIndex(items: Pick<JournalItem, 'z_index'>[]): number {
  return items.reduce((max, item) => Math.max(max, item.z_index), 0) + 1
}

const COLORS = ['#fff1f5', '#eef6ff', '#fff7d6', '#f3f0ff', '#edf7ed']
const ROTATIONS = [-2, 1.5, -0.5, 2.5, -1.25, 0.75]
const STYLES: JournalStickerStyle[] = ['sticky', 'memo', 'ticket']
