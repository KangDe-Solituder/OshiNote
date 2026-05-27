import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export function TagDetailPage() {
  const { tagName } = useParams()

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link to="/tags" className="inline-flex items-center gap-2 text-text-muted hover:text-text-primary mb-6 transition-colors">
        <ArrowLeft size={18} />
        Back to Tags
      </Link>
      <h1 className="text-3xl font-bold text-text-primary mb-2">#{tagName}</h1>
      <p className="text-text-secondary mb-8">0 notes with this tag.</p>

      <div className="text-center py-12 text-text-muted">
        No notes found with tag "{tagName}".
      </div>
    </div>
  )
}
