import { isTauri } from '@tauri-apps/api/core'
import { BaseDirectory, exists, mkdir, writeFile } from '@tauri-apps/plugin-fs'

const BACKGROUND_DIR = 'media/background'

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

async function ensureBackgroundDir(): Promise<void> {
  if (await exists(BACKGROUND_DIR, { baseDir: BaseDirectory.AppData })) return
  await mkdir(BACKGROUND_DIR, { baseDir: BaseDirectory.AppData, recursive: true })
}

/** Persist a picked background image as an AppData file and return its relative path. */
export async function storeCustomBackground(file: File): Promise<string> {
  await ensureBackgroundDir()
  const ext = EXTENSION_BY_MIME[file.type] || 'png'
  const path = `${BACKGROUND_DIR}/custom-background.${ext}`
  await writeFile(path, new Uint8Array(await file.arrayBuffer()), { baseDir: BaseDirectory.AppData })
  return path
}

/**
 * Older versions stored the background as a base64 data URL inside the settings table,
 * which bloated the database. Move it to AppData and return the new path.
 */
export async function migrateLegacyBackgroundDataUrl(dataUrl: string): Promise<string | null> {
  if (!isTauri()) return null
  const match = /^data:(image\/[\w.+-]+);base64,/i.exec(dataUrl)
  if (!match) return null
  try {
    const blob = await (await fetch(dataUrl)).blob()
    await ensureBackgroundDir()
    const ext = EXTENSION_BY_MIME[match[1]] || 'png'
    const path = `${BACKGROUND_DIR}/custom-background.${ext}`
    await writeFile(path, new Uint8Array(await blob.arrayBuffer()), { baseDir: BaseDirectory.AppData })
    return path
  } catch {
    return null
  }
}
