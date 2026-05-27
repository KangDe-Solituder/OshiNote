import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Tag } from 'lucide-react'
import { getAllTags } from '../features/notes/noteService'

export function TagsPage() {
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([])

  useEffect(() => {
    getAllTags().then(setTags).catch(() => {})
  }, [])

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold text-text-primary mb-2">Tags</h1>
      <p className="text-text-secondary mb-8">Browse your memories by tag.</p>

      {tags.length === 0 ? (
        <div className="text-center py-20">
          <Tag size={48} className="mx-auto mb-4 text-accent-soft" />
          <h2 className="text-lg font-semibold text-text-primary mb-2">No tags yet</h2>
          <p className="text-text-muted">Tags will appear as you add them to your notes.</p>
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
                className="px-4 py-2 rounded-full bg-bg-card border border-border-color hover:border-accent hover:shadow-lg transition-all duration-200"
                style={{ fontSize: `${size}rem` }}
              >
                <span className="text-text-primary font-medium">#{tag}</span>
                <span className="ml-1.5 text-text-muted text-sm">({count})</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
