import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, ImageIcon, Layers3, PackageOpen, Upload, Tag } from 'lucide-react'
import { PAGE_CONTENT_CLASS, PAGE_HEADER_CLASS, PAGE_WIDE_FRAME_CLASS } from '../components/layout/pageShell'
import { Button } from '../components/ui/Button'
import { useI18n } from '../i18n/useI18n'
import { getAllTags, getTotalNoteCount } from '../features/notes/noteService'
import { getTotalIllustrationCount } from '../features/illustrations/illustrationService'
import { useResourceText } from '../features/resources/resourceText'
import { JOURNAL_MATERIALS } from '../features/journal/journalMaterials'
import { JournalMaterialTile } from '../components/features/journal/JournalMaterialTile'
import { MediaImage } from '../components/ui/MediaImage'
import { fetchJournalImages } from '../features/journal/journalImageService'
import type { JournalImage } from '../types'
import { fetchResourceTemplates } from '../features/templates/templateService'

export function ResourcesPage() {
  const { t } = useI18n()
  const text = useResourceText()
  const [uploads, setUploads] = useState<JournalImage[]>([])
  const [error, setError] = useState(false)
  const [counts, setCounts] = useState({ notes: 0, illustrations: 0, tags: 0, templates: 0 })

  useEffect(() => {
    let alive = true
    Promise.all([
      getTotalNoteCount(),
      getTotalIllustrationCount(),
      getAllTags(),
      fetchResourceTemplates(),
      fetchJournalImages(),
    ])
      .then(([notes, illustrations, tags, templates, images]) => {
        if (alive) setUploads(images)
        if (alive) setCounts({ notes, illustrations, tags: tags.length, templates: templates.length })
      })
      .catch(() => {
        if (alive) setError(true)
      })
    return () => { alive = false }
  }, [])

  return (
    <div className="flex h-full flex-col bg-bg-primary">
      <header className={PAGE_HEADER_CLASS}>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{t('resources.eyebrow')}</p>
          <h1 className="text-3xl font-bold text-text-primary">{t('resources.title')}</h1>
          <p className="mt-1 text-text-secondary">{text.subtitle}</p>
        </div>
      </header>

      <main className={PAGE_CONTENT_CLASS}>
        <div className={PAGE_WIDE_FRAME_CLASS}>
        {error && <p role="alert" className="mb-4 text-red-400">{text.unavailable}</p>}
        <h2 className="mb-3 text-sm font-semibold text-text-muted">{text.records}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <ResourceCard icon={FileText} title={text.notes} description={t('resources.notes.description')} count={counts.notes} to="/notes" action={text.open} />
          <ResourceCard icon={ImageIcon} title={text.images} description={t('resources.illustrations.description')} count={counts.illustrations} to="/illustrations" action={text.open} />
          <ResourceCard icon={Tag} title={text.tags} description={t('resources.tags.description')} count={counts.tags} to="/tags" action={text.open} />
        </div>
        <h2 className="mb-3 mt-8 text-sm font-semibold text-text-muted">{text.tools}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div><div className="mb-3 grid grid-cols-3 gap-2">{JOURNAL_MATERIALS.filter(m => ['flow-cat', 'hannya-mask', 'karaoke-mic'].includes(m.id)).map(material => <JournalMaterialTile key={material.id} material={material} compact />)}</div><ResourceCard icon={PackageOpen} title={text.materials} description={text.materialDescription} count={JOURNAL_MATERIALS.length} to="/resources/materials" action={text.open} /></div>
          <div><div className="mb-3 grid h-16 grid-cols-3 gap-2 overflow-hidden rounded-lg bg-bg-card">{uploads.slice(0, 3).map(image => <MediaImage key={image.id} path={image.file_path} alt={image.original_filename} className="h-16 w-full object-contain" />)}{!uploads.length && <Upload className="m-auto text-text-muted" />}</div><ResourceCard icon={Upload} title={text.uploads} description={text.uploadDescription} count={uploads.length} to="/resources/uploads" action={text.open} /></div>
          <div><div className="mb-3 flex h-16 items-center justify-center rounded-lg bg-bg-card"><Layers3 className="text-accent" /></div><ResourceCard icon={Layers3} title={text.templates} description={t('resources.templates.description')} count={counts.templates} to="/resources/templates" action={text.open} /></div>
        </div>
        </div>
      </main>
    </div>
  )
}

function ResourceCard({
  icon: Icon,
  title,
  description,
  count,
  to,
  action,
}: {
  icon: typeof FileText
  title: string
  description: string
  count: number
  to: string
  action: string
}) {
  return (
    <section className="rounded-lg border border-border-color bg-bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <Icon size={20} />
        </span>
        <span className="rounded-full bg-bg-secondary px-2.5 py-1 text-xs font-semibold text-text-secondary">{count}</span>
      </div>
      <h2 className="text-base font-semibold text-text-primary">{title}</h2>
      <p className="mt-1 min-h-10 text-sm leading-relaxed text-text-secondary">{description}</p>
      <Link to={to} className="mt-4 inline-flex">
        <Button variant="secondary" size="sm">{action}</Button>
      </Link>
    </section>
  )
}
