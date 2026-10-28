import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { FileText, ImageIcon, Layers3, PackageOpen, Upload, Tag } from 'lucide-react'
import { PAGE_CONTENT_CLASS, PAGE_HEADER_CLASS, PAGE_WIDE_FRAME_CLASS } from '../components/layout/pageShell'
import { useI18n } from '../i18n/useI18n'
import { getAllTags, getTotalNoteCount } from '../features/notes/noteService'
import { fetchIllustrations, getTotalIllustrationCount } from '../features/illustrations/illustrationService'
import { useResourceText } from '../features/resources/resourceText'
import { JOURNAL_MATERIALS } from '../features/journal/journalMaterials'
import { JournalMaterialTile } from '../components/features/journal/JournalMaterialTile'
import { MediaImage } from '../components/ui/MediaImage'
import { fetchJournalImages } from '../features/journal/journalImageService'
import type { Illustration, JournalImage } from '../types'
import { fetchResourceTemplates } from '../features/templates/templateService'
import { JOURNAL_PAGE_TEMPLATES } from '../features/journal/journalPageTemplates'
import { TemplateMiniPreview } from '../components/features/journal/JournalSetupStep'

const featuredMaterial = JOURNAL_MATERIALS.find(material => material.id === 'flow-cat') || JOURNAL_MATERIALS[0]

export function ResourcesPage() {
  const { t } = useI18n()
  const text = useResourceText()
  const [uploads, setUploads] = useState<JournalImage[]>([])
  const [illustration, setIllustration] = useState<Illustration>()
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
      fetchIllustrations({ sort: 'newest', limit: 1 }),
    ])
      .then(([notes, illustrations, tags, templates, images, firstIllustrations]) => {
        if (alive) setUploads(images)
        if (alive) setIllustration(firstIllustrations[0])
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
          <ResourceCard icon={FileText} title={text.notes} count={counts.notes} to="/notes" action={text.open}>
            <AbstractPreview kind="notes" />
          </ResourceCard>
          <ResourceCard icon={ImageIcon} title={text.images} count={counts.illustrations} to="/illustrations" action={text.open}>
            {illustration ? <MediaImage path={illustration.thumbnail_path} fallbackPath={illustration.original_path} alt={illustration.title || illustration.original_filename} className="h-full w-full object-contain" eager /> : <AbstractPreview kind="image" />}
          </ResourceCard>
          <ResourceCard icon={Tag} title={text.tags} count={counts.tags} to="/tags" action={text.open}>
            <AbstractPreview kind="tags" />
          </ResourceCard>
        </div>
        <h2 className="mb-3 mt-8 text-sm font-semibold text-text-muted">{text.tools}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <ResourceCard icon={PackageOpen} title={text.materials} count={JOURNAL_MATERIALS.length} to="/resources/materials" action={text.open}>
            <div className="h-36 w-36"><JournalMaterialTile material={featuredMaterial} fill /></div>
          </ResourceCard>
          <ResourceCard icon={Upload} title={text.uploads} count={uploads.length} to="/resources/uploads" action={text.open}>
            {uploads[0] ? <MediaImage path={uploads[0].file_path} alt={uploads[0].original_filename} className="h-full w-full object-contain" eager /> : <AbstractPreview kind="image" />}
          </ResourceCard>
          <ResourceCard icon={Layers3} title={text.templates} count={counts.templates} to="/resources/templates" action={text.open}>
            <TemplateMiniPreview template={JOURNAL_PAGE_TEMPLATES[0]} className="scale-125 !bg-transparent" />
          </ResourceCard>
        </div>
        </div>
      </main>
    </div>
  )
}

function ResourceCard({
  icon: Icon,
  title,
  children,
  count,
  to,
  action,
}: {
  icon: typeof FileText
  title: string
  children: ReactNode
  count: number
  to: string
  action: string
}) {
  return (
    <section className="rounded-lg border border-border-color bg-bg-card p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <Icon size={18} />
        </span>
        <h3 className="min-w-0 flex-1 text-base font-semibold text-text-primary">{title}</h3>
        <span className="rounded-full bg-bg-secondary px-2.5 py-1 text-xs font-semibold tabular-nums text-text-secondary">{count}</span>
      </div>
      <div className="my-4 flex h-40 items-center justify-center overflow-hidden rounded-lg bg-bg-primary/60">
        {children}
      </div>
      <Link to={to} aria-label={`${action} · ${title}`} className="inline-flex items-center justify-center rounded-lg border border-border-color bg-bg-secondary px-3 py-1.5 text-sm font-medium text-text-primary transition-colors hover:bg-bg-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        {action}
      </Link>
    </section>
  )
}

function AbstractPreview({ kind }: { kind: 'notes' | 'tags' | 'image' }) {
  return (
    <svg viewBox="0 0 240 160" className="h-full w-full max-w-64 text-accent" aria-hidden="true">
      <ellipse cx="120" cy="139" rx="66" ry="5" fill="currentColor" opacity=".07" />
      {kind === 'notes' ? <>
        <rect x="66" y="28" width="105" height="111" rx="9" fill="var(--color-accent-soft)" transform="rotate(-9 120 80)" />
        <g transform="rotate(5 120 80)">
          <rect x="78" y="18" width="100" height="119" rx="8" fill="var(--color-bg-card)" stroke="currentColor" strokeOpacity=".3" />
          <rect x="109" y="12" width="38" height="13" rx="3" fill="currentColor" opacity=".35" />
          <path d="M94 48h41 M94 64h67 M94 78h59 M94 92h65 M94 106h39" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".35" />
          <path d="M151 111c-12-7-10-15-5-15 3 0 5 3 5 3s2-3 5-3c5 0 7 8-5 15" fill="currentColor" opacity=".6" />
        </g>
      </> : kind === 'tags' ? <>
        <path d="M80 48Q72 10 122 22T166 47" fill="none" stroke="currentColor" strokeWidth="2" opacity=".4" />
        <g transform="rotate(-14 94 87)">
          <path d="M66 57l28-21 28 21v66a6 6 0 0 1-6 6H72a6 6 0 0 1-6-6Z" fill="var(--color-accent-soft)" stroke="currentColor" strokeOpacity=".25" />
          <circle cx="94" cy="54" r="4" fill="var(--color-bg-primary)" />
          <path d="M80 84h28 M80 96h19" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".4" />
        </g>
        <g transform="rotate(17 151 89)">
          <path d="M127 58l24-20 24 20v65a6 6 0 0 1-6 6h-36a6 6 0 0 1-6-6Z" fill="var(--color-bg-card)" stroke="currentColor" strokeOpacity=".4" />
          <circle cx="151" cy="54" r="4" fill="currentColor" opacity=".3" />
          <path d="m151 77 4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1Z" fill="currentColor" opacity=".5" />
        </g>
      </> : <g transform="rotate(-5 120 80)">
        <rect x="56" y="26" width="128" height="108" rx="8" fill="var(--color-bg-card)" stroke="currentColor" strokeOpacity=".3" />
        <rect x="65" y="35" width="110" height="77" rx="4" fill="var(--color-accent-soft)" />
        <circle cx="146" cy="54" r="10" fill="currentColor" opacity=".4" />
        <path d="m65 103 30-37 26 28 18-17 36 35H65Z" fill="currentColor" opacity=".3" />
        <path d="M103 123h34" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".25" />
      </g>}
    </svg>
  )
}
