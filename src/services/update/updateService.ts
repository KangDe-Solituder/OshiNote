import { getVersion } from '@tauri-apps/api/app'
import { relaunch } from '@tauri-apps/plugin-process'
import { check, type DownloadEvent, type Update } from '@tauri-apps/plugin-updater'

export interface UpdateInfo {
  currentVersion: string
  version: string
  date?: string
  body?: string
}

export type UpdateInstallProgress = {
  downloadedBytes: number
  totalBytes?: number
  percent?: number
}

let pendingUpdate: Update | null = null

export async function getCurrentAppVersion() {
  return getVersion()
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const update = await check()
  pendingUpdate = update
  if (!update) return null

  return {
    currentVersion: update.currentVersion,
    version: update.version,
    date: update.date,
    body: update.body,
  }
}

export async function installPendingUpdate(
  onProgress?: (progress: UpdateInstallProgress) => void
) {
  if (!pendingUpdate) {
    pendingUpdate = await check()
  }
  if (!pendingUpdate) {
    throw new Error('No update is available.')
  }

  let downloadedBytes = 0
  let totalBytes: number | undefined

  await pendingUpdate.downloadAndInstall((event: DownloadEvent) => {
    if (event.event === 'Started') {
      downloadedBytes = 0
      totalBytes = event.data.contentLength
    }
    if (event.event === 'Progress') {
      downloadedBytes += event.data.chunkLength
    }
    if (event.event === 'Finished') {
      downloadedBytes = totalBytes ?? downloadedBytes
    }

    onProgress?.({
      downloadedBytes,
      totalBytes,
      percent: totalBytes ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : undefined,
    })
  })

  await relaunch()
}
