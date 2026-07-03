import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Tag } from 'lucide-react'
import { getTagsByOshi } from '../features/notes/noteService'
import { fetchOshiById } from '../features/oshis/oshiService'
import type { Oshi } from '../types'
import { useI18n } from '../i18n/useI18n'

export function OshiTagsPage() {
  const { t } = useI18n()
  const { oshiId } = useParams<{ oshiId: string }>()
  const [oshi, setOshi] = useState<Oshi | null>(null)
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([])

  useEffect(() => {
    if (!oshiId) return
    Promise.all([fetchOshiById(oshiId), getTagsByOshi(oshiId)])
      .then(([oshiRecord, tagRows]) => {
        setOshi(oshiRecord)
        setTags(tagRows)
      })
      .catch(() => {})
  }, [oshiId])

  if (!oshiId) return null

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg-primary">
      <header className="shrink-0 px-6 pt-6 lg:px-10">
        <div className="mx-auto flex max-w-5xl items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-soft/25 text-accent">
            <Tag size={23} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold text-text-primary">{t('tags.title')}</h1>
            <p className="mt-0.5 truncate text-sm text-text-secondary">
              {t('tags.oshiSubtitle', { oshi: oshi?.name || t('common.unassigned') })}
            </p>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto px-6 pb-7 pt-5 lg:px-10">
        <div className="mx-auto max-w-5xl">
        {tags.length === 0 ? (
          <div className="py-20 text-center">
            <Tag size={48} className="mx-auto mb-4 text-accent-soft" />
            <h2 className="mb-2 text-lg font-semibold text-text-primary">{t('tags.empty.title')}</h2>
            <p className="text-text-muted">{t('tags.empty.body')}</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {tags.map(({ tag, count }) => {
              const maxCount = tags[0]?.count || 1
              const size = 0.8 + (count / maxCount) * 1.2
              return (
                <Link
                  key={tag}
                  to={`/tags/${encodeURIComponent(tag)}`}
                  className="rounded-full border border-border-color bg-bg-card px-4 py-2 transition-all duration-200 hover:border-accent hover:shadow-lg"
                  style={{ fontSize: `${size}rem` }}
                >
                  <span className="font-medium text-text-primary">#{tag}</span>
                  <span className="ml-1.5 text-sm text-text-muted">({count})</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
      </main>
    </div>
  )
}
