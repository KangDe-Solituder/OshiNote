import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Tag } from 'lucide-react'
import { OshiModuleHeader } from '../components/layout/OshiModuleHeader'
import { PAGE_CONTENT_CLASS } from '../components/layout/pageShell'
import { getTagsByOshi } from '../features/notes/noteService'
import { fetchOshiById } from '../features/oshis/oshiService'
import type { Oshi } from '../types'

export function OshiTagsPage() {
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
      <OshiModuleHeader
        oshiId={oshiId}
        title="Tags"
        subtitle={`Tags used in ${oshi?.name || 'this oshi'}'s notes.`}
        icon={Tag}
      />
      <main className={PAGE_CONTENT_CLASS}>
        <div className="mx-auto max-w-5xl">
        {tags.length === 0 ? (
          <div className="py-20 text-center">
            <Tag size={48} className="mx-auto mb-4 text-accent-soft" />
            <h2 className="mb-2 text-lg font-semibold text-text-primary">No tags yet</h2>
            <p className="text-text-muted">Tags will appear as you add them to this oshi's notes.</p>
          </div>
        ) : (
          <div className="mt-8 flex flex-wrap gap-3">
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
