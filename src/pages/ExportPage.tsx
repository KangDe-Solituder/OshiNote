import { Download } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'

export function ExportPage() {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold text-text-primary mb-2">Export</h1>
      <p className="text-text-secondary mb-8">Your data belongs to you. Export anytime.</p>

      <div className="grid grid-cols-3 gap-4">
        {['JSON', 'Markdown', 'TXT'].map((format) => (
          <Card key={format}>
            <Download size={24} className="mb-3 text-accent" />
            <h3 className="font-semibold text-text-primary mb-1">{format}</h3>
            <p className="text-sm text-text-muted mb-4">
              {format === 'JSON' && 'Full data with rich formatting preserved.'}
              {format === 'Markdown' && 'Readable documents with basic formatting.'}
              {format === 'TXT' && 'Plain text for maximum compatibility.'}
            </p>
            <Button variant="secondary" size="sm" className="w-full">
              <Download size={14} />
              Export {format}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  )
}
