import { createResourceTemplate } from '../features/templates/templateService'
import { getMaterialSnapshot } from '../features/journal/journalMaterials'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, ArrowUpRight, PackageOpen, Star } from 'lucide-react'
import { getDb } from '../database'
import type { JournalImage, JournalMaterialKind } from '../types'
import { JOURNAL_MATERIAL_KINDS, JOURNAL_STICKER_GROUPS } from '../features/journal/journalMaterials'
import { findResourceUsage, reconcileResourceLibrary, type ResourceUsage, type ResourceVersion } from '../features/resources/resourceLibrary'
import { useResourceText } from '../features/resources/resourceText'
import { useResourceActions } from '../features/resources/resourceActionsText'
import { useMaterialLibrary } from '../features/resources/useMaterialLibrary'
import { importMaterial, updateResource, notifyResourcesChanged } from '../features/resources/resourceManagement'
import { exportMaterialPack, importResourcePack } from '../features/resources/resourcePacks'
import { storeJournalImage } from '../features/journal/journalImageService'
import { useI18n } from '../i18n/useI18n'
import { JournalMaterialTile } from '../components/features/journal/JournalMaterialTile'
import { MediaImage } from '../components/ui/MediaImage'
import { Button } from '../components/ui/Button'
import { ResourceCleanupPanel } from '../components/features/ResourceCleanupPanel'
import { PAGE_CONTENT_CLASS, PAGE_HEADER_CLASS, PAGE_WIDE_FRAME_CLASS } from '../components/layout/pageShell'

export function ResourceLibraryPage({ kind }: { kind: 'material' | 'upload' }) {
  const { t } = useI18n()
  const text = useResourceText()
  const action = useResourceActions()
  const { materials, error: libraryError } = useMaterialLibrary()
  const [images, setImages] = useState<(JournalImage & { archived: number })[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [status, setStatus] = useState('active')
  const [favorites, setFavorites] = useState(false)
  const [usage, setUsage] = useState<ResourceUsage[]>([])
  const [versions, setVersions] = useState<ResourceVersion[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [loadingUsage, setLoadingUsage] = useState(false)
  const [revision, setRevision] = useState(0)
  const [importKind, setImportKind] = useState<JournalMaterialKind>('sticker')
  const picker = useRef<HTMLInputElement>(null)
  const replacePicker = useRef<HTMLInputElement>(null)
  useEffect(() => { setSelected(null); setFilter('all'); setQuery('') }, [kind])
  useEffect(() => {
    let alive = true
    if (kind === 'upload') getDb().then(async db => { await reconcileResourceLibrary(db); return db.select<(JournalImage & { archived: number })[]>('SELECT * FROM journal_images ORDER BY created_at DESC') })
      .then(rows => { if (alive) setImages(rows) }).catch(e => { if (alive) setError(String(e)) })
    return () => { alive = false }
  }, [kind, revision])
  useEffect(() => {
    let alive = true
    setUsage([]); setVersions([])
    if (!selected) return
    setLoadingUsage(true)
    findResourceUsage(kind, selected).then(rows => { if (alive) setUsage(rows) })
      .catch(e => { if (alive) setError(String(e)) }).finally(() => { if (alive) setLoadingUsage(false) })
    const assetId = materials.find(item => item.id === selected)?.assetId
    if (assetId) getDb().then(db => db.select<ResourceVersion[]>('SELECT * FROM resource_versions WHERE asset_id = ?', [assetId])).then(rows => { if (alive) setVersions(rows) }).catch(e => { if (alive) setError(String(e)) })
    return () => { alive = false }
  }, [selected, kind, materials, revision])
  const material = materials.find(item => item.id === selected)
  const image = images.find(item => item.id === selected)
  const assetId = kind === 'material' ? material?.assetId : image ? `upload:${image.id}` : undefined
  const title = kind === 'material' && material ? material.displayName || t(material.nameKey) : image?.original_filename || ''
  const archived = kind === 'material' ? material?.archived : Boolean(image?.archived)
  const items = kind === 'material' ? materials.filter(item => (filter === 'all' || filter === item.kind) && (status === 'all' || item.archived === (status === 'retired')) && (!favorites || item.favorite) && (item.displayName || t(item.nameKey)).toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    .map(item => ({ id: item.id, name: item.displayName || t(item.nameKey), preview: <JournalMaterialTile material={item} />, caption: item.archived ? text.retired : t(item.categoryKey), favorite: item.favorite }))
    : images.filter(item => (status === 'all' || (status === 'retired') === Boolean(item.archived)) && item.original_filename.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
      .map(item => ({ id: item.id, name: item.original_filename, preview: <MediaImage path={item.file_path} alt={item.original_filename} className="h-32 w-full object-contain" />, caption: item.archived ? text.retired : `${item.width || '—'} × ${item.height || '—'}`, favorite: false }))
  async function run(work: () => Promise<unknown>) {
    setBusy(true); setError(''); setNotice('')
    try { await work(); setRevision(value => value+1); setNotice(action.done) } catch(e) { setError(String(e)) } finally { setBusy(false) }
  }
  async function importFiles(files: File[], replace = false) {
    await run(async () => {
      const failures: string[] = []
      for (const file of files) {
        try {
          if (file.name.toLowerCase().endsWith('.json') && !replace && kind === 'material') await importResourcePack(file)
          else if (kind === 'material') setSelected(await importMaterial(file, replace && material ? material.kind : importKind, replace ? assetId : undefined))
          else setSelected((await storeJournalImage(file, null)).id)
        } catch(e) { failures.push(`${file.name}: ${String(e)}`) }
      }
      await reconcileResourceLibrary(await getDb())
      setStatus('active'); setQuery(''); setFilter('all'); setFavorites(false)
      notifyResourcesChanged(); setRevision(value => value+1)
      if (failures.length) throw new Error(failures.join('\n'))
    })
  }
  const inputClass = 'w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm'
  return <div className="flex h-full flex-col bg-bg-primary">
    <header className={`${PAGE_HEADER_CLASS} flex-wrap justify-between gap-4`}><div><Link to="/resources" className="text-sm text-text-muted">{t('resources.title')}</Link><h1 className="mt-1 text-3xl font-bold">{kind === 'material' ? text.materials : text.uploads}</h1></div>
      <div className="flex shrink-0 items-center gap-2">{kind === 'material' && <select disabled={busy} aria-label={action.kind} value={importKind} onChange={e => setImportKind(e.target.value as JournalMaterialKind)} className={`${inputClass} !w-auto`}>{JOURNAL_MATERIAL_KINDS.filter(item => item.id !== 'all').map(item => <option key={item.id} value={item.id}>{t(item.labelKey)}</option>)}</select>}<Button className="shrink-0 whitespace-nowrap" disabled={busy} onClick={() => picker.current?.click()}>{action.import}</Button></div>
      <input ref={picker} type="file" accept={kind === 'material' ? 'image/png,image/jpeg,image/webp,image/gif,.json' : 'image/png,image/jpeg,image/webp,image/gif'} multiple hidden onChange={e => { const files=Array.from(e.target.files || []); e.target.value=''; if(files.length) void importFiles(files) }} />
      <input ref={replacePicker} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={e => { const files=Array.from(e.target.files || []); e.target.value=''; if(files.length) void importFiles(files,true) }} />
    </header>
    <main className={PAGE_CONTENT_CLASS}><div className={PAGE_WIDE_FRAME_CLASS}>
      <p className="mb-4 text-xs text-text-muted">{action.importHint}</p>
      <div className="mb-5 flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 rounded-lg border border-border-color bg-bg-card px-3 py-2"><Search size={16} /><input aria-label={text.search} placeholder={text.search} value={query} onChange={e => setQuery(e.target.value)} className="min-w-0 bg-transparent outline-none" /></label>
        {kind === 'material' && <select aria-label={action.kind} value={filter} onChange={e=>setFilter(e.target.value)} className="rounded-lg border border-border-color bg-bg-card px-3 py-2 text-sm">{JOURNAL_MATERIAL_KINDS.map(item=><option key={item.id} value={item.id}>{t(item.labelKey)}</option>)}</select>}
        <select aria-label={action.status} value={status} onChange={e=>setStatus(e.target.value)} className="rounded-lg border border-border-color bg-bg-card px-3 py-2 text-sm"><option value="active">{text.active}</option><option value="retired">{text.retired}</option><option value="all">{text.all}</option></select>
        {kind === 'material' && <button aria-pressed={favorites} onClick={()=>setFavorites(!favorites)} className={`flex items-center gap-1 rounded-lg border border-border-color px-3 py-2 text-sm ${favorites ? 'text-accent' : 'text-text-muted'}`}><Star size={15}/>{action.favorites}</button>}<span className="text-sm text-text-muted">{items.length}</span></div>
      {(error || libraryError) && <p role="alert" className="mb-4 whitespace-pre-wrap text-red-400">{error || libraryError}</p>}{notice && <p role="status" className="mb-3 text-sm text-accent">{notice}</p>}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{items.map(item => <button disabled={busy} key={item.id} onClick={() => setSelected(item.id)} aria-pressed={selected === item.id} className={`overflow-hidden rounded-xl border bg-bg-card p-3 text-left transition-colors ${selected === item.id ? 'border-accent ring-1 ring-accent' : 'border-border-color hover:border-accent'}`}>
          {item.preview}<p className="mt-3 truncate text-sm font-medium">{item.favorite && '★ '}{item.name}</p><p className="mt-1 text-xs text-text-muted">{item.caption}</p></button>)}
          {!items.length && <p className="col-span-full py-14 text-center text-text-muted">{text.empty}</p>}</div>
        <aside className="sticky top-4 rounded-xl border border-border-color bg-bg-card p-5">
          {!selected ? <div className="py-10 text-center text-sm leading-relaxed text-text-muted"><PackageOpen className="mx-auto mb-3" />{text.choose}</div> : <>
            {kind === 'material' && material ? <JournalMaterialTile material={material} /> : image && <MediaImage path={image.file_path} alt={image.original_filename} className="max-h-60 w-full object-contain" />}
            <h2 className="mt-4 break-words font-semibold">{title}</h2>
            <p className="mt-1 text-xs text-text-muted">{kind === 'material' ? material?.source === 'builtin' ? text.builtin : action.imported : text.upload}</p>
            {assetId && <form key={`${assetId}:${title}`} className="mt-4 space-y-3" onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); void run(()=>updateResource(assetId,{name:String(form.get('name'))})) }}><label className="block text-xs text-text-muted">{action.rename}<input name="name" aria-label={action.rename} defaultValue={title} maxLength={160} required className={`${inputClass} mt-1 text-text-primary`} /></label><Button disabled={busy} variant="secondary" size="sm" type="submit">{action.save}</Button></form>}
            {material && <div className="mt-3 space-y-3"><label className="block text-xs text-text-muted">{action.group}<select disabled={busy} aria-label={action.group} value={material.group || 'misc'} className={`${inputClass} mt-1 text-text-primary`} onChange={e=>void run(()=>updateResource(material.assetId,{group:e.target.value}))}>{JOURNAL_STICKER_GROUPS.filter(item=>item.id!=='all').map(item=><option key={item.id} value={item.id}>{t(item.labelKey)}</option>)}</select></label>
              <Button disabled={busy} variant="secondary" size="sm" onClick={()=>void run(()=>updateResource(material.assetId,{favorite:!material.favorite}))}>{material.favorite?action.unfavorite:action.favorite}</Button>
              <p className="text-xs text-text-muted">{action.versions}: {versions.length}</p></div>}
            <div className="mt-3 flex flex-wrap gap-2">{assetId && <Button disabled={busy} variant="secondary" size="sm" onClick={()=>void run(()=>updateResource(assetId,{archived:!archived}))}>{archived?action.restore:action.archive}</Button>}{material?.source==='import' && <Button disabled={busy} variant="secondary" size="sm" onClick={()=>replacePicker.current?.click()}>{action.replace}</Button>}{material && <Button disabled={busy} variant="secondary" size="sm" onClick={()=>void run(()=>exportMaterialPack(material.assetId,title))}>{action.export}</Button>}{material && <Button disabled={busy} variant="secondary" size="sm" onClick={()=>void run(()=>createResourceTemplate({type:'material',name:title,payload:JSON.stringify({version:1,materialSnapshot:getMaterialSnapshot(material),resourceDependencies:[material.resourceVersionId]})}))}>{action.saveTemplate}</Button>}</div>
            <p className="mt-3 text-xs leading-relaxed text-text-muted">{action.retained}</p>
            {image && <dl className="mt-4 space-y-2 text-sm"><dt className="text-text-muted">{text.dimensions}</dt><dd>{image.width} × {image.height}</dd><dt className="text-text-muted">{text.size}</dt><dd>{(image.file_size / 1024 / 1024).toFixed(2)} MB</dd><dt className="text-text-muted">{text.created}</dt><dd>{image.created_at}</dd></dl>}
            <h3 className="mt-6 border-t border-border-color pt-4 text-sm font-semibold">{text.usage}</h3>
            {loadingUsage ? <p className="mt-3 text-sm text-text-muted">…</p> : usage.length ? <ul className="mt-2 space-y-2">{usage.map(item => <li key={`${item.type}:${item.id}`}><Link className="flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-bg-secondary" to={item.type === 'page' ? `/journal/pages/${item.id}/edit` : '/resources/templates'}><ArrowUpRight size={14} className="shrink-0 text-accent" /><span className="truncate">{item.title || t('common.untitled')}</span></Link></li>)}</ul> : <p className="mt-3 text-sm leading-relaxed text-text-muted">{text.unused}</p>}
          </>}
        </aside>
      </div>
      <ResourceCleanupPanel />
    </div></main>
  </div>
}
