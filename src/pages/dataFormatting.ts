import type { IncrementalSyncSummary } from '../services/sync/incrementalSync'
import type { useI18n } from '../i18n/useI18n'
export function formatSyncResult(
  result: IncrementalSyncSummary,
  t: ReturnType<typeof useI18n>['t']
): string {
  if (result.status === 'up-to-date') return t('export.sync.status.upToDate')
  if (result.status === 'pushed') return t('export.sync.status.pushed', { count: result.uploadedRecords, size: formatBytes(result.transferredBytes) })
  if (result.status === 'pulled') return t('export.sync.status.pulled', { count: result.downloadedRecords, size: formatBytes(result.transferredBytes) })
  if (result.status === 'merged') return t('export.sync.status.merged', { size: formatBytes(result.transferredBytes) })
  return t('export.sync.status.conflicts', { count: result.conflicts })
}

export function formatRemoteTime(value: string, locale: string): string {
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) return value
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'medium' }).format(timestamp)
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export function shortEntityKey(value: string): string {
  const [table, id] = value.split(':')
  return `${table}:${id?.slice(0, 8) || ''}`
}

export function conflictPreview(value: string | null): string {
  if (!value) return '∅'
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    for (const key of ['title', 'name', 'label', 'description', 'hash']) {
      if (typeof parsed[key] === 'string' && parsed[key]) return String(parsed[key])
    }
    return JSON.stringify(parsed).slice(0, 180)
  } catch {
    return value.slice(0, 180)
  }
}
