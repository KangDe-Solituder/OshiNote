import { isTauri } from '@tauri-apps/api/core'
import { BaseDirectory, exists, mkdir, remove, writeFile } from '@tauri-apps/plugin-fs'

const BACKGROUND_DIR = 'media/background'

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

const MANAGED_BACKGROUND_PATH = /^media\/background\/custom-background(?:-[a-z0-9-]+)?\.(?:jpg|png|webp|gif)$/i

async function ensureBackgroundDir(): Promise<void> {
  if (await exists(BACKGROUND_DIR, { baseDir: BaseDirectory.AppData })) return
  await mkdir(BACKGROUND_DIR, { baseDir: BaseDirectory.AppData, recursive: true })
}

function buildBackgroundPath(extension: string): string {
  const id = crypto.randomUUID().replace(/-/g, '')
  return `${BACKGROUND_DIR}/custom-background-${id}.${extension}`
}

export async function removeCustomBackground(path: string | null | undefined): Promise<void> {
  if (!path || !MANAGED_BACKGROUND_PATH.test(path)) return
  try {
    if (await exists(path, { baseDir: BaseDirectory.AppData })) {
      await remove(path, { baseDir: BaseDirectory.AppData })
    }
  } catch {
    // Background cleanup is best-effort and must not block changing the setting.
  }
}

/** Persist a picked background image as an AppData file and return its unique relative path. */
export async function storeCustomBackground(file: File, previousPath?: string | null): Promise<string> {
  await ensureBackgroundDir()
  const ext = EXTENSION_BY_MIME[file.type]
  if (!ext) throw new Error(`Unsupported background image type: ${file.type || 'unknown'}`)
  const path = buildBackgroundPath(ext)
  await writeFile(path, new Uint8Array(await file.arrayBuffer()), { baseDir: BaseDirectory.AppData })
  await removeCustomBackground(previousPath)
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
    const ext = EXTENSION_BY_MIME[match[1]]
    if (!ext) return null
    const path = buildBackgroundPath(ext)
    await writeFile(path, new Uint8Array(await blob.arrayBuffer()), { baseDir: BaseDirectory.AppData })
    return path
  } catch {
    return null
  }
}
