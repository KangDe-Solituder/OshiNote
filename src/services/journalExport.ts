import { isTauri } from '@tauri-apps/api/core'
import { writeFile } from '@tauri-apps/plugin-fs'
import { save } from '@tauri-apps/plugin-dialog'
import type { JournalItemWithNote, JournalPage, Stamp } from '../types'
import { getJournalCanvasSize } from '../features/journal/journalLayout'
import { getJournalBackgroundPreset } from '../features/journal/journalBackgrounds'
import { getJournalImageItemStyle, getJournalNoteCardStyle } from '../features/journal/journalItemStyles'
import { getImageBottomPadding, getImagePadding } from '../features/journal/journalItemStyles'
import { getJournalMaterialDefinition } from '../features/journal/journalMaterials'
import { resolveMediaUrl } from './media/illustrationMedia'

const EXPORT_SCALE = 2

export interface JournalExportOptions {
  untitled: string
  noContent: string
}

/** Render a journal page to a PNG with a hand-drawn canvas renderer (no DOM rasterization). */
export async function exportJournalPageImage(page: JournalPage, items: JournalItemWithNote[], stamp: Stamp | null, labels: JournalExportOptions): Promise<string> {
  const visibleItems = items.filter((item) => !item.staged).sort((a, b) => a.z_index - b.z_index)
  const size = getJournalCanvasSize(items, page.orientation || 'portrait')
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(size.width * EXPORT_SCALE)
  canvas.height = Math.round(size.height * EXPORT_SCALE)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.scale(EXPORT_SCALE, EXPORT_SCALE)

  paintPageBackground(ctx, page.background || 'paper', size.width, size.height)
  paintPageHeader(ctx, page, size.width)

  for (const item of visibleItems) {
    ctx.save()
    ctx.translate(item.x + item.width / 2, item.y + item.height / 2)
    ctx.rotate((item.rotation * Math.PI) / 180)
    ctx.translate(-item.width / 2, -item.height / 2)
    await paintItem(ctx, item, labels)
    ctx.restore()
  }

  if (stamp) paintStamp(ctx, stamp, size.width, size.height)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Failed to encode the page image')
  const fileName = `${(page.title || 'journal').replace(/[\\/:*?"<>|]/g, '_')}.png`
  const bytes = new Uint8Array(await blob.arrayBuffer())

  if (isTauri()) {
    const target = await save({
      defaultPath: fileName,
      filters: [{ name: 'PNG image', extensions: ['png'] }],
    })
    if (!target) return ''
    await writeFile(target, bytes)
    return target
  }

  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
  return fileName
}

function paintPageHeader(ctx: CanvasRenderingContext2D, page: JournalPage, width: number) {
  ctx.fillStyle = 'rgba(90, 84, 76, 0.55)'
  ctx.font = '500 11px system-ui, sans-serif'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(page.title || '', 28, 34)
  const pageNo = String(page.page_index + 1)
  ctx.textAlign = 'right'
  ctx.fillText(pageNo, width - 28, 34)
  ctx.textAlign = 'left'
}

const PRESET_BASE_COLORS: Record<string, string> = {
  paper: '#f7f1e8',
  sakura: '#fae8ee',
  'blue-hour': '#dbe9f7',
  'rainy-cafe': '#eadfce',
  maple: '#f4dfbd',
  envelope: '#f2e7d7',
  grid: '#f6f7fa',
  postcard: '#f6eee4',
}

function paintPageBackground(ctx: CanvasRenderingContext2D, background: string, width: number, height: number) {
  const preset = getJournalBackgroundPreset(background)
  const base = PRESET_BASE_COLORS[preset.id] || PRESET_BASE_COLORS.paper
  ctx.fillStyle = base
  ctx.fillRect(0, 0, width, height)

  if (preset.id === 'grid') {
    ctx.strokeStyle = 'rgba(90, 100, 125, 0.13)'
    ctx.lineWidth = 1
    for (let x = 0; x <= width; x += 30) line(ctx, x, 0, x, height)
    for (let y = 0; y <= height; y += 30) line(ctx, 0, y, width, y)
    return
  }
  if (preset.id === 'postcard') {
    ctx.fillStyle = 'rgba(167, 88, 64, 0.28)'
    ctx.fillRect(0, 0, 44, height)
    ctx.strokeStyle = 'rgba(118, 93, 78, 0.12)'
    ctx.lineWidth = 2
    line(ctx, width * 0.7, 0, width * 0.7, height)
    for (let y = 24; y < height; y += 24) line(ctx, 44, y, width, y)
    return
  }
  if (preset.id === 'envelope') {
    ctx.strokeStyle = 'rgba(135, 104, 76, 0.12)'
    ctx.lineWidth = 2
    line(ctx, 0, height, width, 0)
    line(ctx, 0, 0, width, height)
    return
  }

  // Soft diagonal light band shared by the paper-toned presets.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)'
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(width * 0.42, 0)
  ctx.lineTo(0, height * 0.42)
  ctx.closePath()
  ctx.fill()

  const petalColor = preset.id === 'sakura' ? 'rgba(239, 139, 170, 0.18)' : preset.id === 'maple' ? 'rgba(184, 86, 52, 0.16)' : preset.id === 'blue-hour' ? 'rgba(255, 255, 255, 0.5)' : null
  if (petalColor) {
    ctx.fillStyle = petalColor
    for (const [fx, fy] of [[0.07, 0.09], [0.92, 0.87]] as const) {
      ctx.beginPath()
      ctx.ellipse(width * fx, height * fy, 26, 14, 0.4, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

async function paintItem(ctx: CanvasRenderingContext2D, item: JournalItemWithNote, labels: JournalExportOptions): Promise<void> {
  if (item.item_type === 'note' && item.note) {
    paintNoteItem(ctx, item, labels)
    return
  }
  if (item.item_type === 'illustration' || item.item_type === 'image') {
    await paintImageItem(ctx, item)
    return
  }
  paintMaterialItem(ctx, item)
}

function paintNoteItem(ctx: CanvasRenderingContext2D, item: JournalItemWithNote, labels: JournalExportOptions) {
  const style = getJournalNoteCardStyle(item, labels.untitled, labels.noContent)
  if (!style) return
  fillRoundRect(ctx, 0, 0, item.width, item.height, style.radius, style.backgroundColor)
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)'
  ctx.lineWidth = 1
  strokeRoundRect(ctx, 0.5, 0.5, item.width - 1, item.height - 1, style.radius)

  const padding = style.padding
  const maxWidth = item.width - padding * 2
  let cursorY = padding
  ctx.fillStyle = style.textColor

  if (style.titleVisible && style.titleText) {
    ctx.font = `600 ${Math.round(style.fontSize * 1.08)}px ${style.fontFamily}`
    ctx.textBaseline = 'top'
    cursorY = drawWrappedText(ctx, style.titleText, padding, cursorY, maxWidth, Math.round(style.fontSize * 1.08 * 1.3), item.height - padding) + 6
  }
  ctx.font = `${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`
  drawWrappedText(ctx, style.bodyText, padding, cursorY, maxWidth, Math.round(style.fontSize * style.lineHeight), item.height - padding)
}

async function paintImageItem(ctx: CanvasRenderingContext2D, item: JournalItemWithNote) {
  const style = getJournalImageItemStyle(item)
  const imagePath = item.item_type === 'image' ? item.journal_image?.file_path : item.illustration?.original_path || item.illustration?.thumbnail_path
  if (!imagePath) return

  const radius = style?.radius ?? 12
  if (style && style.backgroundColor !== 'transparent') fillRoundRect(ctx, 0, 0, item.width, item.height, radius, style.backgroundColor)
  if (style && style.borderWidth > 0) {
    ctx.strokeStyle = style.borderColor
    ctx.lineWidth = style.borderWidth
    strokeRoundRect(ctx, style.borderWidth / 2, style.borderWidth / 2, item.width - style.borderWidth, item.height - style.borderWidth, radius)
  }

  const image = await loadImage(imagePath)
  if (!image) return
  const padding = style ? getImagePadding(style) : 0
  const bottomPadding = style ? getImageBottomPadding(style) : 0
  const targetX = padding
  const targetY = padding
  const targetWidth = item.width - padding * 2
  const targetHeight = item.height - padding - bottomPadding
  const fit = style?.fit || 'contain'

  ctx.save()
  clipRoundRect(ctx, targetX, targetY, targetWidth, targetHeight, Math.max(2, radius - padding / 2))
  const imageRatio = image.naturalWidth / Math.max(1, image.naturalHeight)
  const targetRatio = targetWidth / Math.max(1, targetHeight)
  let drawWidth = targetWidth
  let drawHeight = targetHeight
  let offsetX = targetX
  let offsetY = targetY
  const cover = fit === 'cover'
  if ((cover && imageRatio < targetRatio) || (!cover && imageRatio > targetRatio)) {
    drawHeight = targetWidth / imageRatio
    offsetY = targetY + (targetHeight - drawHeight) / 2
  } else {
    drawWidth = targetHeight * imageRatio
    offsetX = targetX + (targetWidth - drawWidth) / 2
  }
  if (cover) {
    drawWidth = Math.max(drawWidth, targetWidth)
    drawHeight = Math.max(drawHeight, targetHeight)
  }
  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight)
  ctx.restore()
}

function paintMaterialItem(ctx: CanvasRenderingContext2D, item: JournalItemWithNote) {
  if (item.item_type === 'tape') {
    fillRoundRect(ctx, 0, 0, item.width, item.height, 5, item.color || '#d9c4ff')
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)'
    ctx.fillRect(0, 0, item.width * 0.3, item.height)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'
    ctx.fillRect(item.width * 0.72, 0, item.width * 0.28, item.height)
    return
  }
  const material = item.material_id ? getJournalMaterialDefinition(item.material_id) : undefined
  const color = materialColor(item, material?.defaultStyle.color)
  if (material?.kind === 'tape') {
    fillRoundRect(ctx, 0, 0, item.width, item.height, 5, color)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)'
    ctx.fillRect(0, 0, item.width * 0.3, item.height)
    return
  }
  if (material?.kind === 'label') {
    fillRoundRect(ctx, 0, 0, item.width, item.height, item.height / 2, color)
    return
  }
  fillRoundRect(ctx, 0, 0, item.width, item.height, 10, color)
}

function materialColor(item: JournalItemWithNote, fallback: unknown): string {
  try {
    const payload = JSON.parse(item.style_payload || '{}') as Record<string, unknown>
    if (typeof payload.color === 'string') return payload.color
  } catch {
    // fall through
  }
  if (typeof item.color === 'string' && item.color) return item.color
  return typeof fallback === 'string' ? fallback : '#f0e6d8'
}

function paintStamp(ctx: CanvasRenderingContext2D, stamp: Stamp, width: number, height: number) {
  ctx.save()
  ctx.globalAlpha = Math.min(1, Math.max(0.1, stamp.opacity))
  ctx.translate((stamp.x / 100) * width, (stamp.y / 100) * height)
  ctx.rotate((stamp.rotation * Math.PI) / 180)
  ctx.fillStyle = stamp.color
  ctx.font = `600 ${stamp.size}px Georgia, 'Times New Roman', serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (stamp.label) ctx.fillText(stamp.label, 0, 0)
  ctx.restore()
}

async function loadImage(path: string): Promise<HTMLImageElement | null> {
  try {
    const url = await resolveMediaUrl(path)
    if (!url) return null
    return await new Promise<HTMLImageElement | null>((resolve) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => resolve(null)
      image.src = url
    })
  } catch {
    return null
  }
}

function fillRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, color: string) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.roundRect(x, y, width, height, Math.min(radius, width / 2, height / 2))
  ctx.fill()
}

function strokeRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, width, height, Math.min(radius, width / 2, height / 2))
  ctx.stroke()
}

function clipRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, width, height, Math.min(radius, width / 2, height / 2))
  ctx.clip()
}

/** Word-wrap that also breaks CJK runs without spaces. */
function drawWrappedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxY: number): number {
  const paragraphs = text.split('\n')
  let cursorY = y
  for (const paragraph of paragraphs) {
    let line = ''
    for (const char of paragraph.split(/(\s+)/).flatMap((token) => (/\s/.test(token) || ctx.measureText(token).width <= maxWidth ? [token] : token.split('')))) {
      const candidate = line + char
      if (ctx.measureText(candidate).width > maxWidth && line) {
        if (cursorY + lineHeight > maxY) return cursorY
        ctx.fillText(line.trimEnd(), x, cursorY)
        cursorY += lineHeight
        line = char.trimStart()
      } else {
        line = candidate
      }
    }
    if (line.trim()) {
      if (cursorY + lineHeight > maxY) return cursorY
      ctx.fillText(line.trimEnd(), x, cursorY)
      cursorY += lineHeight
    }
  }
  return cursorY
}
