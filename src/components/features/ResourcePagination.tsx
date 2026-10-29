import type { useResourcePagination } from '../../features/resources/useResourcePagination'
import { useI18n } from '../../i18n/useI18n'
import { Button } from '../ui/Button'

export function ResourcePagination({ page, totalPages, setPage }: ReturnType<typeof useResourcePagination>) {
  const { locale, t } = useI18n()
  if (totalPages <= 1) return null
  return <nav aria-label={locale === 'zh' ? '分页' : locale === 'ja' ? 'ページ切替' : 'Pagination'} className="mt-6 flex items-center justify-center gap-3">
    <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t('common.previous')}</Button>
    <span aria-live="polite" className="text-sm text-text-muted">{page} / {totalPages}</span>
    <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>{t('common.next')}</Button>
  </nav>
}
