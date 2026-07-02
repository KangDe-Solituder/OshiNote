import { Link } from 'react-router-dom'
import { ImageIcon, PackageOpen, Ruler, Stamp } from 'lucide-react'
import { PAGE_CONTENT_CLASS, PAGE_HEADER_CLASS } from '../components/layout/pageShell'
import { Button } from '../components/ui/Button'
import { useI18n } from '../i18n/useI18n'

export function ResourceMaterialsPage() {
  const { t } = useI18n()

  return (
    <div className="flex h-full flex-col bg-bg-primary">
      <header className={PAGE_HEADER_CLASS}>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{t('resources.eyebrow')}</p>
          <h1 className="text-3xl font-bold text-text-primary">{t('materials.title')}</h1>
          <p className="mt-1 text-text-secondary">{t('materials.subtitle')}</p>
        </div>
      </header>

      <main className={PAGE_CONTENT_CLASS}>
        <section className="rounded-lg border border-dashed border-border-color bg-bg-secondary/20 px-6 py-12 text-center">
          <PackageOpen size={40} className="mx-auto mb-3 text-accent-soft" />
          <h2 className="text-lg font-semibold text-text-primary">{t('materials.empty.title')}</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-text-secondary">{t('materials.empty.body')}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link to="/illustrations">
              <Button variant="secondary" size="sm">
                <ImageIcon size={15} />
                {t('nav.illustrations')}
              </Button>
            </Link>
            <Link to="/resources/templates">
              <Button variant="secondary" size="sm">
                <Stamp size={15} />
                {t('nav.templates')}
              </Button>
            </Link>
          </div>
        </section>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <HintCard icon={ImageIcon} title={t('materials.hint.images.title')} body={t('materials.hint.images.body')} />
          <HintCard icon={Ruler} title={t('materials.hint.tapes.title')} body={t('materials.hint.tapes.body')} />
          <HintCard icon={Stamp} title={t('materials.hint.stamps.title')} body={t('materials.hint.stamps.body')} />
        </div>
      </main>
    </div>
  )
}

function HintCard({ icon: Icon, title, body }: { icon: typeof ImageIcon; title: string; body: string }) {
  return (
    <section className="rounded-lg border border-border-color bg-bg-card p-5">
      <Icon size={20} className="mb-3 text-accent" />
      <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-text-secondary">{body}</p>
    </section>
  )
}
