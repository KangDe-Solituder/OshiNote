import type { StampMaterialId } from '../../types'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { BaseDirectory, exists, mkdir, readFile, writeFile } from '@tauri-apps/plugin-fs'

export type StampFontId = 'great-vibes' | 'yuji-syuku'

export interface StampFontDefinition {
  id: StampFontId
  labelKey: string
  descriptionKey: string
  fileName: string
  localPath: string
  appDataPath: string
  downloadUrl: string
}

export const STAMP_FONT_DEFINITIONS: StampFontDefinition[] = [
  {
    id: 'great-vibes',
    labelKey: 'settings.stampFont.greatVibes',
    descriptionKey: 'settings.stampFont.greatVibesDescription',
    fileName: 'GreatVibes-Regular.ttf',
    localPath: '/fonts/stamps/great-vibes/GreatVibes-Regular.ttf',
    appDataPath: 'fonts/stamps/great-vibes/GreatVibes-Regular.ttf',
    downloadUrl: 'https://raw.githubusercontent.com/google/fonts/main/ofl/greatvibes/GreatVibes-Regular.ttf',
  },
  {
    id: 'yuji-syuku',
    labelKey: 'settings.stampFont.yujiSyuku',
    descriptionKey: 'settings.stampFont.yujiSyukuDescription',
    fileName: 'YujiSyuku-Regular.ttf',
    localPath: '/fonts/stamps/yuji-syuku/YujiSyuku-Regular.ttf',
    appDataPath: 'fonts/stamps/yuji-syuku/YujiSyuku-Regular.ttf',
    downloadUrl: 'https://raw.githubusercontent.com/google/fonts/main/ofl/yujisyuku/YujiSyuku-Regular.ttf',
  },
]

export const STAMP_FONT_REQUIREMENTS: Partial<Record<StampMaterialId, StampFontId>> = {
  flourish: 'great-vibes',
  'running-script': 'great-vibes',
  calligraphy: 'yuji-syuku',
}

export const DEFAULT_STAMP_FONT_AVAILABILITY: Record<StampFontId, boolean> = {
  'great-vibes': false,
  'yuji-syuku': false,
}

export function isStampMaterialFontReady(materialId: StampMaterialId, availability: Record<StampFontId, boolean>): boolean {
  const requiredFont = STAMP_FONT_REQUIREMENTS[materialId]
  return !requiredFont || availability[requiredFont]
}

export async function checkStampFontAvailability(): Promise<Record<StampFontId, boolean>> {
  const entries = await Promise.all(
    STAMP_FONT_DEFINITIONS.map(async (font) => {
      return [font.id, await isStampFontAvailable(font)] as const
    })
  )
  return Object.fromEntries(entries) as Record<StampFontId, boolean>
}

export async function applyStampFontFaces(availability: Record<StampFontId, boolean>): Promise<void> {
  if (typeof document === 'undefined') return
  const styleId = 'oshinote-stamp-font-faces'
  document.getElementById(styleId)?.remove()
  releaseStampFontObjectUrls()

  const rules: string[] = []
  if (availability['great-vibes']) {
    const source = await resolveStampFontSource(STAMP_FONT_DEFINITIONS[0])
    rules.push(`
@font-face {
  font-family: 'OshiNote Great Vibes';
  src: url('${source}') format('truetype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}`)
  }
  if (availability['yuji-syuku']) {
    const source = await resolveStampFontSource(STAMP_FONT_DEFINITIONS[1])
    rules.push(`
@font-face {
  font-family: 'OshiNote CJK Brush';
  src: url('${source}') format('truetype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}`)
  }

  if (rules.length === 0) return
  const style = document.createElement('style')
  style.id = styleId
  style.textContent = rules.join('\n')
  document.head.appendChild(style)
}

export async function downloadStampFont(
  font: StampFontDefinition,
  onProgress?: (percent: number | null) => void
): Promise<void> {
  onProgress?.(null)
  if (isTauri()) {
    await invoke('download_stamp_font', {
      url: font.downloadUrl,
      relativePath: font.appDataPath,
    })
    onProgress?.(100)
    return
  }

  const response = await fetch(font.downloadUrl, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Could not download font (${response.status})`)

  const contentLength = Number(response.headers.get('content-length') || 0)
  let bytes: Uint8Array
  if (response.body) {
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let received = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        chunks.push(value)
        received += value.byteLength
        if (contentLength > 0) onProgress?.(Math.min(99, Math.round((received / contentLength) * 100)))
      }
    }
    bytes = mergeChunks(chunks, received)
  } else {
    bytes = new Uint8Array(await response.arrayBuffer())
  }

  await ensureStampFontDir(font.appDataPath)
  await writeFile(font.appDataPath, bytes, { baseDir: BaseDirectory.AppData })
  onProgress?.(100)
}

let stampFontObjectUrls: string[] = []

async function isStampFontAvailable(font: StampFontDefinition): Promise<boolean> {
  try {
    if (isTauri() && await exists(font.appDataPath, { baseDir: BaseDirectory.AppData })) return true
  } catch {
    // Fall back to bundled public assets below.
  }

  try {
    const response = await fetch(font.localPath, { cache: 'no-store' })
    return response.ok
  } catch {
    return false
  }
}

async function resolveStampFontSource(font: StampFontDefinition): Promise<string> {
  try {
    if (isTauri() && await exists(font.appDataPath, { baseDir: BaseDirectory.AppData })) {
      const bytes = await readFile(font.appDataPath, { baseDir: BaseDirectory.AppData })
      const url = URL.createObjectURL(new Blob([bytes], { type: 'font/ttf' }))
      stampFontObjectUrls.push(url)
      return url
    }
  } catch {
    // Fall back to bundled public assets below.
  }
  return font.localPath
}

function releaseStampFontObjectUrls(): void {
  for (const url of stampFontObjectUrls) URL.revokeObjectURL(url)
  stampFontObjectUrls = []
}

async function ensureStampFontDir(path: string): Promise<void> {
  const directory = path.split('/').slice(0, -1).join('/')
  if (!directory) return
  if (await exists(directory, { baseDir: BaseDirectory.AppData })) return
  await mkdir(directory, { baseDir: BaseDirectory.AppData, recursive: true })
}

function mergeChunks(chunks: Uint8Array[], totalLength: number): Uint8Array {
  const merged = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return merged
}
