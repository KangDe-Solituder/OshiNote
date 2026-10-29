import type { useResourcePagination } from '../../features/resources/useResourcePagination'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'
import { SelectMenu } from '../ui/SelectMenu'

export function ResourcePagination({ page, size, totalPages, total, setPage, setSize }: ReturnType<typeof useResourcePagination>) {
  const { locale } = useI18n()
  const labels = locale === 'zh' ? { previous: '上一页', next: '下一页', size: '每页数量', pagination: '分页' }
    : locale === 'ja' ? { previous: '前のページ', next: '次のページ', size: '表示件数', pagination: 'ページ切替' }
      : { previous: 'Previous page', next: 'Next page', size: 'Items per page', pagination: 'Pagination' }
  const buttonClass = 'rounded-lg border border-border-color p-2 text-text-secondary hover:bg-bg-secondary focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-30 disabled:cursor-not-allowed'
  return <nav aria-label={labels.pagination} className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border-color pt-3 mt-3">
    <div className="flex items-center gap-3 text-xs text-text-muted">
      <span className="tabular-nums">{total ? (page - 1) * size + 1 : 0}–{Math.min(page * size, total)} / {total}</span>
      <SelectMenu size="sm" ariaLabel={labels.size} value={String(size)} onChange={value => setSize(Number(value))}
        options={[12, 24, 48].map(value => ({ value: String(value), label: `${value} / ${locale === 'zh' ? '页' : locale === 'ja' ? 'ページ' : 'page'}` }))} />
    </div>
    <div className="flex items-center gap-3">
      <button type="button" aria-label={labels.previous} disabled={page === 1} onClick={() => setPage(page - 1)} className={buttonClass}><ChevronLeft size={16} /></button>
      <span aria-live="polite" className="text-sm tabular-nums text-text-secondary">{page} / {totalPages}</span>
      <button type="button" aria-label={labels.next} disabled={page === totalPages} onClick={() => setPage(page + 1)} className={buttonClass}><ChevronRight size={16} /></button>
    </div>
  </nav>
}
