import { invoke, isTauri } from '@tauri-apps/api/core'
import { BaseDirectory, exists, mkdir, readFile, remove, writeFile } from '@tauri-apps/plugin-fs'

const MAX_IMAGE_BYTES = 20 * 1024 * 1024
const THUMBNAIL_MAX_WIDTH = 640
const MEDIA_ROOT = 'media/illustrations'
const MAX_CACHED_MEDIA_ITEMS = 64
const MAX_CACHED_MEDIA_BYTES = 128 * 1024 * 1024

interface CachedMediaUrl {
  path: string
  url: string
  byteLength: number
  references: number
  lastUsed: number
}

interface PendingMediaUrl {
  promise: Promise<CachedMediaUrl>
}

const cachedMediaByPath = new Map<string, CachedMediaUrl | PendingMediaUrl>()
const cachedMediaByUrl = new Map<string, CachedMediaUrl>()

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export interface StoredIllustrationImage {
  original_path: string
  thumbnail_path: string | null
  original_filename: string
  mime_type: string
  file_size: number
  width: number | null
  height: number | null
}

export function validateIllustrationFile(file: File): string | null {
  if (!MIME_EXTENSIONS[file.type]) {
    return 'Only JPEG, PNG, and WebP images are supported.'
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return 'Illustration images must be 20 MB or smaller.'
  }
  return null
}

export async function storeIllustrationImage(file: File, illustrationId: string): Promise<StoredIllustrationImage> {
  const error = validateIllustrationFile(file)
  if (error) throw new Error(error)

  const ext = MIME_EXTENSIONS[file.type]
  const year = String(new Date().getFullYear())
  const originalDir = `${MEDIA_ROOT}/originals/${year}`
  const thumbnailDir = `${MEDIA_ROOT}/thumbnails/${year}`
  const originalPath = `${originalDir}/${illustrationId}.${ext}`
  const thumbnailPath = `${thumbnailDir}/${illustrationId}.webp`
  const bytes = new Uint8Array(await file.arrayBuffer())
  const dimensions = await readImageDimensions(file)
  const thumbnailBytes = await createThumbnail(file)

  await ensureMediaDir(originalDir)
  await ensureMediaDir(thumbnailDir)
  await writeFile(originalPath, bytes, { baseDir: BaseDirectory.AppData })
  if (thumbnailBytes) {
    await writeFile(thumbnailPath, thumbnailBytes, { baseDir: BaseDirectory.AppData })
  }

  return {
    original_path: originalPath,
    thumbnail_path: thumbnailBytes ? thumbnailPath : null,
    original_filename: file.name,
    mime_type: file.type,
    file_size: file.size,
    width: dimensions.width,
    height: dimensions.height,
  }
}

export async function removeIllustrationFiles(paths: Array<string | null | undefined>): Promise<void> {
  for (const path of paths) {
    if (!path) continue
    discardCachedMediaPath(path)
    try {
      if (await exists(path, { baseDir: BaseDirectory.AppData })) {
        await remove(path, { baseDir: BaseDirectory.AppData })
      }
    } catch {
      // Keep deletion of metadata usable even if a media file has already gone missing.
    }
  }
}

export async function resolveMediaUrl(relativePath: string | null | undefined): Promise<string> {
  if (!relativePath) return ''
  if (!hasTauriRuntime()) return ''
  let cached = cachedMediaByPath.get(relativePath)
  if (!cached) {
    const pending: PendingMediaUrl = {
      promise: readIllustrationBytes(relativePath)
        .then((bytes) => {
          const entry: CachedMediaUrl = {
            path: relativePath,
            url: URL.createObjectURL(new Blob([bytes], { type: getImageMimeType(relativePath) })),
            byteLength: bytes.byteLength,
            references: 0,
            lastUsed: Date.now(),
          }
          cachedMediaByPath.set(relativePath, entry)
          cachedMediaByUrl.set(entry.url, entry)
          return entry
        })
        .catch((error) => {
          if (cachedMediaByPath.get(relativePath) === pending) cachedMediaByPath.delete(relativePath)
          throw error
        }),
    }
    cachedMediaByPath.set(relativePath, pending)
    cached = pending
  }

  const entry = 'promise' in cached ? await cached.promise : cached
  entry.references += 1
  entry.lastUsed = Date.now()
  trimMediaUrlCache()
  return entry.url
}

export async function resolveMediaUrlWithFallback(
  primaryPath: string | null | undefined,
  fallbackPath?: string | null
): Promise<string> {
  const candidates = Array.from(new Set([primaryPath, fallbackPath].filter((path): path is string => Boolean(path))))
  for (const path of candidates) {
    try {
      const url = await resolveMediaUrl(path)
      if (url) return url
    } catch {
      // Try the next candidate. Callers should render their normal placeholder if all candidates fail.
    }
  }
  return ''
}

export function releaseMediaUrl(url: string): void {
  if (!url.startsWith('blob:')) return
  const cached = cachedMediaByUrl.get(url)
  if (!cached) {
    URL.revokeObjectURL(url)
    return
  }
  cached.references = Math.max(0, cached.references - 1)
  cached.lastUsed = Date.now()
  trimMediaUrlCache()
}

export function getCachedMediaUrlWithFallback(
  primaryPath: string | null | undefined,
  fallbackPath?: string | null
): string {
  const candidates = Array.from(new Set([primaryPath, fallbackPath].filter((path): path is string => Boolean(path))))
  for (const path of candidates) {
    const cached = cachedMediaByPath.get(path)
    if (cached && !('promise' in cached)) {
      cached.lastUsed = Date.now()
      return cached.url
    }
  }
  return ''
}

export function discardCachedMediaUrl(url: string): void {
  const cached = cachedMediaByUrl.get(url)
  if (!cached) {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url)
    return
  }
  cachedMediaByPath.delete(cached.path)
  cachedMediaByUrl.delete(cached.url)
  URL.revokeObjectURL(cached.url)
}

async function readIllustrationBytes(relativePath: string): Promise<Uint8Array<ArrayBuffer>> {
  try {
    const bytes = await readFile(relativePath, { baseDir: BaseDirectory.AppData })
    return new Uint8Array(bytes)
  } catch (pluginError) {
    try {
      const bytes = await invoke<number[]>('read_illustration_media_file', { relativePath })
      return new Uint8Array(bytes)
    } catch (nativeError) {
      throw new Error(`Could not read illustration media. Plugin: ${String(pluginError)}; native: ${String(nativeError)}`, { cause: nativeError })
    }
  }
}

function hasTauriRuntime(): boolean {
  if (isTauri()) return true
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

async function ensureMediaDir(path: string): Promise<void> {
  if (await exists(path, { baseDir: BaseDirectory.AppData })) return
  await mkdir(path, { baseDir: BaseDirectory.AppData, recursive: true })
}

function readImageDimensions(file: File): Promise<{ width: number | null; height: number | null }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: image.naturalWidth || null, height: image.naturalHeight || null })
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      resolve({ width: null, height: null })
    }
    image.src = url
  })
}

function createThumbnail(file: File): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const scale = Math.min(1, THUMBNAIL_MAX_WIDTH / image.naturalWidth)
      const width = Math.max(1, Math.round(image.naturalWidth * scale))
      const height = Math.max(1, Math.round(image.naturalHeight * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        URL.revokeObjectURL(url)
        resolve(null)
        return
      }
      context.drawImage(image, 0, 0, width, height)
      canvas.toBlob(async (blob) => {
        URL.revokeObjectURL(url)
        if (!blob) {
          resolve(null)
          return
        }
        resolve(new Uint8Array(await blob.arrayBuffer()))
      }, 'image/webp', 0.82)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    image.src = url
  })
}

function getImageMimeType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  return 'application/octet-stream'
}

function discardCachedMediaPath(path: string): void {
  const cached = cachedMediaByPath.get(path)
  cachedMediaByPath.delete(path)
  if (!cached || 'promise' in cached) return
  cachedMediaByUrl.delete(cached.url)
  URL.revokeObjectURL(cached.url)
}

function trimMediaUrlCache(): void {
  const entries = Array.from(cachedMediaByUrl.values())
  let totalBytes = entries.reduce((sum, entry) => sum + entry.byteLength, 0)
  let totalItems = entries.length
  if (totalItems <= MAX_CACHED_MEDIA_ITEMS && totalBytes <= MAX_CACHED_MEDIA_BYTES) return

  const releasable = entries
    .filter((entry) => entry.references === 0)
    .sort((left, right) => left.lastUsed - right.lastUsed)
  for (const entry of releasable) {
    if (totalItems <= MAX_CACHED_MEDIA_ITEMS && totalBytes <= MAX_CACHED_MEDIA_BYTES) break
    cachedMediaByPath.delete(entry.path)
    cachedMediaByUrl.delete(entry.url)
    URL.revokeObjectURL(entry.url)
    totalItems -= 1
    totalBytes -= entry.byteLength
  }
}
