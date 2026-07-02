import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, ImageIcon, Layers3, PackageOpen, Shapes, Tag } from 'lucide-react'
import { PAGE_CONTENT_CLASS, PAGE_HEADER_CLASS } from '../components/layout/pageShell'
import { Button } from '../components/ui/Button'
import { useI18n } from '../i18n/useI18n'
import { getAllTags, getTotalNoteCount } from '../features/notes/noteService'
import { getTotalIllustrationCount } from '../features/illustrations/illustrationService'
import { fetchResourceTemplates } from '../features/templates/templateService'

export function ResourcesPage() {
  const { t } = useI18n()
  const [counts, setCounts] = useState({ notes: 0, illustrations: 0, tags: 0, templates: 0 })

  useEffect(() => {
    let alive = true
    Promise.all([
      getTotalNoteCount(),
      getTotalIllustrationCount(),
      getAllTags(),
      fetchResourceTemplates(),
    ])
      .then(([notes, illustrations, tags, templates]) => {
        if (alive) setCounts({ notes, illustrations, tags: tags.length, templates: templates.length })
      })
      .catch(() => {
        if (alive) setCounts({ notes: 0, illustrations: 0, tags: 0, templates: 0 })
      })
    return () => { alive = false }
  }, [])

  return (
    <div className="flex h-full flex-col bg-bg-primary">
      <header className={PAGE_HEADER_CLASS}>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{t('resources.eyebrow')}</p>
          <h1 className="text-3xl font-bold text-text-primary">{t('resources.title')}</h1>
          <p className="mt-1 text-text-secondary">{t('resources.subtitle')}</p>
        </div>
      </header>

      <main className={PAGE_CONTENT_CLASS}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ResourceCard icon={FileText} title={t('nav.allNotes')} description={t('resources.notes.description')} count={counts.notes} to="/notes" action={t('common.viewAll')} />
          <ResourceCard icon={ImageIcon} title={t('nav.illustrations')} description={t('resources.illustrations.description')} count={counts.illustrations} to="/illustrations" action={t('common.viewAll')} />
          <ResourceCard icon={Layers3} title={t('nav.templates')} description={t('resources.templates.description')} count={counts.templates} to="/resources/templates" action={t('resources.openTemplates')} />
          <ResourceCard icon={PackageOpen} title={t('nav.materials')} description={t('resources.materials.description')} count={0} to="/resources/materials" action={t('resources.openMaterials')} />
          <ResourceCard icon={Tag} title={t('nav.tags')} description={t('resources.tags.description')} count={counts.tags} to="/tags" action={t('common.viewAll')} />
        </div>

        <section className="mt-8 rounded-lg border border-border-color bg-bg-card p-5">
          <div className="flex items-start gap-3">
            <Shapes size={20} className="mt-0.5 text-accent" />
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-text-primary">{t('resources.next.title')}</h2>
              <p className="mt-1 text-sm leading-relaxed text-text-secondary">{t('resources.next.body')}</p>
            </div>
          </div>
        </section>
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
