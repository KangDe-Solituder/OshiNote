import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, ArrowUpRight, PackageOpen } from 'lucide-react'
import { getDb } from '../database'
import type { JournalImage } from '../types'
import { JOURNAL_MATERIALS, JOURNAL_MATERIAL_KINDS } from '../features/journal/journalMaterials'
import { findResourceUsage, type ResourceUsage } from '../features/resources/resourceLibrary'
import { useResourceText } from '../features/resources/resourceText'
import { useI18n } from '../i18n/useI18n'
import { JournalMaterialTile } from '../components/features/journal/JournalMaterialTile'
import { MediaImage } from '../components/ui/MediaImage'
import { PAGE_CONTENT_CLASS, PAGE_HEADER_CLASS, PAGE_WIDE_FRAME_CLASS } from '../components/layout/pageShell'

export function ResourceLibraryPage({ kind }: { kind: 'material' | 'upload' }) {
  const { t } = useI18n()
  const text = useResourceText()
  const [images, setImages] = useState<(JournalImage & { archived: number })[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [usage, setUsage] = useState<ResourceUsage[]>([])
  const [error, setError] = useState('')
  const [loadingUsage, setLoadingUsage] = useState(false)
  useEffect(() => {
    let alive = true
    if (kind === 'upload') getDb().then(db => db.select<(JournalImage & { archived: number })[]>('SELECT * FROM journal_images ORDER BY created_at DESC'))
      .then(rows => { if (alive) setImages(rows) }).catch(error => { if (alive) setError(String(error)) })
    return () => { alive = false }
  }, [kind])
  useEffect(() => {
    let alive = true
    setUsage([])
    if (!selected) return
    setLoadingUsage(true)
    findResourceUsage(kind, selected).then(rows => { if (alive) setUsage(rows) })
      .catch(error => { if (alive) setError(String(error)) }).finally(() => { if (alive) setLoadingUsage(false) })
    return () => { alive = false }
  }, [selected, kind])
  const material = JOURNAL_MATERIALS.find(item => item.id === selected)
  const image = images.find(item => item.id === selected)
  const choices = kind === 'material' ? JOURNAL_MATERIAL_KINDS.map(item => ({ id: item.id, label: t(item.labelKey) }))
    : [{ id: 'all', label: text.all }, { id: 'active', label: text.active }, { id: 'retired', label: text.retired }]
  const items = kind === 'material' ? JOURNAL_MATERIALS.filter(item => (filter === 'all' || filter === item.kind) && t(item.nameKey).toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    .map(item => ({ id: item.id, name: t(item.nameKey), preview: <JournalMaterialTile material={item} />, caption: t(item.categoryKey) }))
    : images.filter(item => (filter === 'all' || (filter === 'retired') === Boolean(item.archived)) && item.original_filename.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
      .map(item => ({ id: item.id, name: item.original_filename, preview: <MediaImage path={item.file_path} alt={item.original_filename} className="h-32 w-full object-contain" />, caption: item.archived ? text.retired : `${item.width || '—'} × ${item.height || '—'}` }))
  return <div className="flex h-full flex-col bg-bg-primary">
    <header className={PAGE_HEADER_CLASS}><div><Link to="/resources" className="text-sm text-text-muted">{t('resources.title')}</Link><h1 className="mt-1 text-3xl font-bold">{kind === 'material' ? text.materials : text.uploads}</h1></div></header>
    <main className={PAGE_CONTENT_CLASS}><div className={PAGE_WIDE_FRAME_CLASS}>
      <div className="mb-5 flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 rounded-lg border border-border-color bg-bg-card px-3 py-2"><Search size={16} /><input aria-label={text.search} placeholder={text.search} value={query} onChange={event => setQuery(event.target.value)} className="bg-transparent outline-none" /></label>
        {choices.map(choice => <button key={choice.id} onClick={() => setFilter(choice.id)} className={`rounded-lg border px-3 py-2 text-sm ${filter === choice.id ? 'border-accent bg-accent-soft text-accent' : 'border-border-color text-text-secondary'}`}>{choice.label}</button>)}<span className="text-sm text-text-muted">{items.length}</span></div>
      {error && <p role="alert" className="mb-4 text-red-400">{text.unavailable} {error}</p>}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{items.map(item => <button key={item.id} onClick={() => setSelected(item.id)} aria-pressed={selected === item.id} className={`overflow-hidden rounded-xl border bg-bg-card p-3 text-left transition-colors ${selected === item.id ? 'border-accent ring-1 ring-accent' : 'border-border-color hover:border-accent'}`}>
          {item.preview}<p className="mt-3 truncate text-sm font-medium">{item.name}</p><p className="mt-1 text-xs text-text-muted">{item.caption}</p></button>)}
          {!items.length && <p className="col-span-full py-14 text-center text-text-muted">{text.empty}</p>}</div>
        <aside className="sticky top-4 rounded-xl border border-border-color bg-bg-card p-5">
          {!selected ? <div className="py-10 text-center text-sm leading-relaxed text-text-muted"><PackageOpen className="mx-auto mb-3" />{text.choose}</div> : <>
            {kind === 'material' && material ? <JournalMaterialTile material={material} /> : image && <MediaImage path={image.file_path} alt={image.original_filename} className="max-h-60 w-full object-contain" />}
            <h2 className="mt-4 break-words font-semibold">{kind === 'material' && material ? t(material.nameKey) : image?.original_filename}</h2>
            <p className="mt-1 text-xs text-text-muted">{kind === 'material' ? text.builtin : text.upload}</p>
            {image && <dl className="mt-4 space-y-2 text-sm"><dt className="text-text-muted">{text.dimensions}</dt><dd>{image.width} × {image.height}</dd><dt className="text-text-muted">{text.size}</dt><dd>{(image.file_size / 1024 / 1024).toFixed(2)} MB</dd><dt className="text-text-muted">{text.created}</dt><dd>{image.created_at}</dd>{Boolean(image.archived) && <dd>{text.retained}</dd>}</dl>}
            <h3 className="mt-6 border-t border-border-color pt-4 text-sm font-semibold">{text.usage}</h3>
            {loadingUsage ? <p className="mt-3 text-sm text-text-muted">…</p> : usage.length ? <ul className="mt-2 space-y-2">{usage.map(item => <li key={`${item.type}:${item.id}`}><Link className="flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-bg-secondary" to={item.type === 'page' ? `/journal/pages/${item.id}/edit` : '/resources/templates'}><ArrowUpRight size={14} className="shrink-0 text-accent" /><span className="truncate">{item.title || t('common.untitled')}</span></Link></li>)}</ul> : <p className="mt-3 text-sm leading-relaxed text-text-muted">{text.unused}</p>}
          </>}
        </aside>
      </div>
    </div></main>
  </div>
}
