import type { Illustration, Oshi } from '../../types'

export function formatDate(value: string): string {
  const date = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString()
}

export function formatImageSize(illustration: Illustration): string {
  const dimensions = illustration.width && illustration.height ? `${illustration.width}x${illustration.height}` : ''
  const size = illustration.file_size > 0 ? `${(illustration.file_size / 1024 / 1024).toFixed(1)} MB` : ''
  return [dimensions, size].filter(Boolean).join(' / ')
}

export function getOshiName(oshis: Oshi[], oshiId: string | null, emptyLabel = 'No Oshi', unknownLabel = 'Unknown Oshi'): string {
  if (!oshiId) return emptyLabel
  return oshis.find((oshi) => oshi.id === oshiId)?.name || unknownLabel
}
