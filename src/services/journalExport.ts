import { isTauri } from '@tauri-apps/api/core'
import { writeFile } from '@tauri-apps/plugin-fs'
import { save } from '@tauri-apps/plugin-dialog'
import type { JournalItemWithNote, JournalPage, Stamp } from '../types'
import { getJournalCanvasSize } from '../features/journal/journalLayout'

export interface JournalExportOptions {
  untitled: string
  noContent: string
}

/**
 * Export a journal page as a PNG by rasterizing the real page DOM — the same
 * nodes the user sees on screen (foreignObject under the hood), so fonts,
 * stickers, tape textures and frames come out exactly as rendered.
 *
 * The live canvas is scaled by zoom; we clone the paper element, reset the
 * transform and natural size, rasterize the clone offscreen, and clean up.
 */
export async function exportJournalPageImage(page: JournalPage, items: JournalItemWithNote[], _stamp: Stamp | null, labels: JournalExportOptions): Promise<string> {
  void items
  void labels
  const source = findJournalPageElement()
  if (!source) throw new Error('Journal page element not found on screen')

  const itemsForSize = items.filter((item) => !item.staged)
  const size = getJournalCanvasSize(itemsForSize, page.orientation || 'portrait')

  const clone = source.cloneNode(true) as HTMLElement
  clone.style.transform = 'none'
  clone.style.width = `${size.width}px`
  clone.style.height = `${size.height}px`
  clone.style.minHeight = 'unset'
  clone.querySelectorAll('[class*="outline"], [class*="ring-"]').forEach((element) => {
    element.classList.remove('outline', 'outline-2', 'outline-accent/90', 'ring-2', 'ring-accent', 'ring-accent/80', 'shadow-xl')
  })

  const host = document.createElement('div')
  host.style.cssText = 'position: fixed; left: -10000px; top: 0; pointer-events: none;'
  host.appendChild(clone)
  document.body.appendChild(host)

  try {
    const { domToPng } = await import('modern-screenshot')
    const dataUrl = await domToPng(clone, {
      scale: 2,
      backgroundColor: undefined,
      // Local blob: URLs and bundled fonts resolve same-origin in the webview.
      fetch: { requestInit: { cache: 'force-cache' } },
    })
    const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (char) => char.charCodeAt(0))
    const fileName = `${(page.title || 'journal').replace(/[\\/:*?"<>|]/g, '_')}.png`

    if (isTauri()) {
      const target = await save({
        defaultPath: fileName,
        filters: [{ name: 'PNG image', extensions: ['png'] }],
      })
      if (!target) return ''
      await writeFile(target, bytes)
      return target
    }

    const anchor = document.createElement('a')
    anchor.href = dataUrl
    anchor.download = fileName
    anchor.click()
    return fileName
  } finally {
    host.remove()
  }
}

/** The page view canvas renders the paper as a plain relative div with the preset background. */
function findJournalPageElement(): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>('.journal-paper-page')
  if (candidates.length === 1) return candidates[0]
  // Prefer the one currently inside the journal view viewport.
  for (const candidate of candidates) {
    if (candidate.closest('.journal-canvas-viewport')) return candidate
  }
  return candidates[0] || null
}
