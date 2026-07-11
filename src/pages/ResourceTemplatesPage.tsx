import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, FileText, Layers3, PackageOpen, ScrollText, Stamp as StampIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PAGE_CONTENT_CLASS, PAGE_HEADER_CLASS } from '../components/layout/pageShell'
import { useI18n } from '../i18n/useI18n'
import { fetchResourceTemplates } from '../features/templates/templateService'
import type { ResourceTemplate, ResourceTemplateType } from '../types'
import { getJournalPageTemplateDefinition } from '../features/journal/journalPageTemplates'
import { TemplateMiniPreview } from '../components/features/journal/JournalSetupStep'

const TYPE_ICONS = {
  note: FileText,
  journal_page: ScrollText,
  stamp: StampIcon,
  material: PackageOpen,
} satisfies Record<ResourceTemplateType, typeof FileText>

export function ResourceTemplatesPage() {
  const { t } = useI18n()
  const [templates, setTemplates] = useState<ResourceTemplate[]>([])
  const [selectedType, setSelectedType] = useState<ResourceTemplateType | 'all'>('all')

  useEffect(() => {
    fetchResourceTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]))
  }, [])

  const filteredTemplates = useMemo(
    () => selectedType === 'all' ? templates : templates.filter((template) => template.type === selectedType),
    [selectedType, templates]
  )

  return (
    <div className="flex h-full flex-col bg-bg-primary">
      <header className={`${PAGE_HEADER_CLASS} justify-between gap-4`}>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{t('resources.eyebrow')}</p>
          <h1 className="text-3xl font-bold text-text-primary">{t('templates.title')}</h1>
          <p className="mt-1 text-text-secondary">{t('templates.subtitle')}</p>
        </div>
      </header>

      <main className={PAGE_CONTENT_CLASS}>
        <div className="mb-5 flex flex-wrap gap-2">
          {(['all', 'note', 'journal_page', 'stamp', 'material'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setSelectedType(type)}
              className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                selectedType === type
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-border-color bg-bg-card text-text-secondary hover:border-border-hover hover:text-text-primary'
              }`}
            >
              {type === 'all' ? t('common.all') : t(`templates.type.${type}` as never)}
            </button>
          ))}
        </div>

        {filteredTemplates.length === 0 ? (
          <section className="rounded-lg border border-dashed border-border-color bg-bg-secondary/20 px-6 py-12 text-center">
            <Layers3 size={36} className="mx-auto mb-3 text-accent-soft" />
            <h2 className="text-lg font-semibold text-text-primary">{t('templates.empty.title')}</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-text-secondary">{t('templates.empty.body')}</p>
          </section>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredTemplates.map((template) => (
              <TemplateCard key={template.id} template={template} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function TemplateCard({ template }: { template: ResourceTemplate }) {
  const { t } = useI18n()
  const Icon = TYPE_ICONS[template.type]
  const title = template.source === 'builtin' ? t(template.name as never) : template.name
  const description = template.source === 'builtin' ? t(template.description as never) : template.description
  const journalTemplate = template.type === 'journal_page' ? getJournalPageTemplateDefinition(template.id) : null

  return (
    <section className="flex min-h-[250px] flex-col overflow-hidden rounded-lg border border-border-color bg-bg-card shadow-sm">
      {journalTemplate && <TemplateMiniPreview template={journalTemplate} className="h-32 border-b border-border-color" />}
      <div className="flex flex-1 flex-col p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <Icon size={20} />
        </span>
        <span className="rounded-full bg-bg-secondary px-2.5 py-1 text-xs font-medium text-text-secondary">
          {t(`templates.type.${template.type}` as never)}
        </span>
      </div>
      <h2 className="text-base font-semibold text-text-primary">{title}</h2>
      <p className="mt-1 min-h-10 text-sm leading-relaxed text-text-secondary">{description}</p>
      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
          {template.source === 'builtin' ? t('templates.source.builtin') : t('templates.source.user')}
        </p>
        {journalTemplate && (
          <Link to={`/journal/create?templateId=${encodeURIComponent(journalTemplate.id)}`} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90">
            {t('journalTemplates.use')}
            <ArrowRight size={14} />
          </Link>
        )}
      </div>
      </div>
    </section>
  )
}
