import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, ArrowUpRight, Star } from 'lucide-react'
import { getDb } from '../database'
import type { JournalImage, JournalMaterialKind } from '../types'
import { JOURNAL_MATERIAL_KINDS } from '../features/journal/journalMaterials'
import { findResourceUsage, reconcileResourceLibrary, type ResourceUsage, type ResourceVersion } from '../features/resources/resourceLibrary'
import { useResourceText } from '../features/resources/resourceText'
import { useResourceActions } from '../features/resources/resourceActionsText'
import { useMaterialLibrary } from '../features/resources/useMaterialLibrary'
import { importMaterial, updateResource, notifyResourcesChanged } from '../features/resources/resourceManagement'
import { importResourcePack } from '../features/resources/resourcePacks'
import { storeJournalImage } from '../features/journal/journalImageService'
import { useI18n } from '../i18n/useI18n'
import { JournalMaterialTile } from '../components/features/journal/JournalMaterialTile'
import { MediaImage } from '../components/ui/MediaImage'
import { Button } from '../components/ui/Button'
import { SelectMenu } from '../components/ui/SelectMenu'
import { ResourcePagination } from '../components/features/ResourcePagination'
import { useResourcePagination } from '../features/resources/useResourcePagination'
import { ResourceCleanupPanel } from '../components/features/ResourceCleanupPanel'
import { MaterialDetailsEditor } from '../components/features/MaterialDetailsEditor'
import { ResourceDetailDrawer } from '../components/features/ResourceDetailDrawer'
import { PAGE_CONTENT_CLASS, PAGE_PREVIEW_HEADER_CLASS, PAGE_WIDE_FRAME_CLASS } from '../components/layout/pageShell'

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
  const items = kind === 'material' ? materials.filter(item => (filter === 'all' || filter === item.kind) && (!favorites || item.favorite) && (item.displayName || t(item.nameKey)).toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    .map(item => ({ id: item.id, name: item.displayName || t(item.nameKey), preview: <JournalMaterialTile material={item} />, caption: t(item.categoryKey), favorite: item.favorite }))
    : images.filter(item => (status === 'all' || (status === 'retired') === Boolean(item.archived)) && item.original_filename.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
      .map(item => ({ id: item.id, name: item.original_filename, preview: <MediaImage path={item.file_path} alt={item.original_filename} className="h-32 w-full object-contain" />, caption: item.archived ? text.retired : `${item.width || '—'} × ${item.height || '—'}`, favorite: false }))
  const pagination = useResourcePagination(items, JSON.stringify([kind, query, filter, status, favorites]))
  const listScroll = useRef<HTMLDivElement>(null)
  const closePreview = useCallback(() => setSelected(null), [])
  useEffect(() => { listScroll.current?.scrollTo(0, 0) }, [pagination.page, pagination.size, query, filter, status, favorites])
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
  return <div className="preview-content-area relative flex h-full min-h-0 flex-col overflow-hidden bg-bg-primary">
    <header className={`${PAGE_PREVIEW_HEADER_CLASS} flex-wrap justify-between gap-4`}><div><Link to="/resources" className="block text-xs leading-4 text-text-muted">{t('resources.title')}</Link><h1 className="text-2xl font-bold leading-8">{kind === 'material' ? text.materials : text.uploads}</h1></div>
      <div className="flex shrink-0 items-center gap-2">{kind === 'material' && <SelectMenu disabled={busy} ariaLabel={action.kind} value={importKind} onChange={value => setImportKind(value as JournalMaterialKind)} options={JOURNAL_MATERIAL_KINDS.filter(item => item.id !== 'all').map(item => ({value: item.id, label: t(item.labelKey)}))} />}<Button className="shrink-0 whitespace-nowrap" disabled={busy} onClick={() => picker.current?.click()}>{action.import}</Button></div>
      <input ref={picker} type="file" accept={kind === 'material' ? 'image/png,image/jpeg,image/webp,image/gif,.json' : 'image/png,image/jpeg,image/webp,image/gif'} multiple hidden onChange={e => { const files=Array.from(e.target.files || []); e.target.value=''; if(files.length) void importFiles(files) }} />
      <input ref={replacePicker} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={e => { const files=Array.from(e.target.files || []); e.target.value=''; if(files.length) void importFiles(files,true) }} />
    </header>
    <main className={`${PAGE_CONTENT_CLASS} !overflow-hidden`}><div className={`${PAGE_WIDE_FRAME_CLASS} flex h-full min-h-0 flex-col`}>
      <div ref={listScroll} className="resource-list-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2">
      <p className="mb-4 text-xs text-text-muted">{action.importHint}</p>
      <div className="mb-5 flex flex-wrap items-center gap-3"><label className="flex min-w-0 max-w-full items-center gap-2 rounded-lg border border-border-color bg-bg-card px-3 py-2 focus-within:ring-2 focus-within:ring-accent/30"><Search size={16} /><input aria-label={text.search} placeholder={text.search} value={query} onChange={e => setQuery(e.target.value)} className="min-w-0 w-full !bg-transparent !backdrop-filter-none text-text-primary outline-none" /></label>
        {kind === 'material' && <SelectMenu ariaLabel={action.kind} value={filter} onChange={setFilter} options={JOURNAL_MATERIAL_KINDS.map(item=>({value:item.id,label:t(item.labelKey)}))} />}
        {kind === 'upload' && <SelectMenu ariaLabel={action.status} value={status} onChange={setStatus} options={[{value:"active",label:text.active},{value:"retired",label:text.retired},{value:"all",label:text.all}]} />}
        {kind === 'material' && <button aria-pressed={favorites} onClick={()=>setFavorites(!favorites)} className={`flex items-center gap-1 rounded-lg border border-border-color px-3 py-2 text-sm ${favorites ? 'text-accent' : 'text-text-muted'}`}><Star size={15}/>{action.favorites}</button>}{kind === 'upload' && <span className="text-sm text-text-muted">{items.length}</span>}</div>
      {((!selected && error) || libraryError) && <p role="alert" className="mb-4 whitespace-pre-wrap text-red-400">{(!selected && error) || libraryError}</p>}{!selected && notice && <p role="status" className="mb-3 text-sm text-accent">{notice}</p>}
        <div className="resource-card-grid">{pagination.visible.map(item => <button disabled={busy} key={item.id} onClick={() => setSelected(item.id)} aria-pressed={selected === item.id} className={`overflow-hidden rounded-xl border bg-bg-card p-3 text-left transition-colors ${selected === item.id ? 'border-accent ring-1 ring-accent' : 'border-border-color hover:border-accent'}`}>
          {item.preview}<p className="mt-3 truncate text-sm font-medium">{item.favorite && '★ '}{item.name}</p><p className="mt-1 text-xs text-text-muted">{item.caption}</p></button>)}
          {!items.length && <p className="col-span-full py-14 text-center text-text-muted">{text.empty}</p>}</div>
        <ResourcePagination {...pagination} />
        {kind === 'upload' && <ResourceCleanupPanel />}
        </div>
    </div></main>
    {selected && <ResourceDetailDrawer resourceId={selected} title={title} category={kind === 'material' ? text.materials : text.uploads} onClose={closePreview}>
            {error && <p role="alert" className="mb-4 whitespace-pre-wrap text-red-400">{error}</p>}
            {notice && <p role="status" className="mb-3 text-sm text-accent">{notice}</p>}
            {kind === 'material' && material ? <JournalMaterialTile material={material} /> : image && <MediaImage path={image.file_path} alt={image.original_filename} className="max-h-60 w-full object-contain" />}
            <h2 className="mt-4 break-words font-semibold">{title}</h2>
            <p className="mt-1 text-xs text-text-muted">{kind === 'material' ? material?.source === 'builtin' ? text.builtin : action.imported : text.upload}</p>
            {kind === 'upload' && assetId && <form key={`${assetId}:${title}`} className="mt-4 space-y-3" onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); void run(()=>updateResource(assetId,{name:String(form.get('name'))})) }}><label className="block text-xs text-text-muted">{action.rename}<input name="name" aria-label={action.rename} defaultValue={title} maxLength={160} required className={`${inputClass} mt-1 text-text-primary`} /></label><Button disabled={busy} variant="secondary" size="sm" type="submit">{action.save}</Button></form>}
            {material && <MaterialDetailsEditor key={`${material.assetId}:${title}:${material.group}`} material={material} title={title} busy={busy} run={run} onDeleted={closePreview} />}
            {kind === 'upload' && assetId && <div className="mt-3"><Button disabled={busy} variant="secondary" size="sm" onClick={() => void run(() => updateResource(assetId, { archived: !archived }))}>{archived ? action.restore : action.archive}</Button></div>}
            {material?.source === 'import' && <Button className="mt-3" disabled={busy} variant="ghost" size="sm" onClick={() => replacePicker.current?.click()}>{action.replace}</Button>}
            {material && <p className="mt-3 text-xs text-text-muted">{action.versions}: {versions.length}</p>}
            <p className="mt-3 text-xs leading-relaxed text-text-muted">{action.retained}</p>
            {image && <dl className="mt-4 space-y-2 text-sm"><dt className="text-text-muted">{text.dimensions}</dt><dd>{image.width} × {image.height}</dd><dt className="text-text-muted">{text.size}</dt><dd>{(image.file_size / 1024 / 1024).toFixed(2)} MB</dd><dt className="text-text-muted">{text.created}</dt><dd>{image.created_at}</dd></dl>}
            <h3 className="mt-6 border-t border-border-color pt-4 text-sm font-semibold">{text.usage}</h3>
            {loadingUsage ? <p className="mt-3 text-sm text-text-muted">…</p> : usage.length ? <ul className="mt-2 space-y-2">{usage.map(item => <li key={`${item.type}:${item.id}`}><Link className="flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-bg-secondary" to={item.type === 'page' ? `/journal/pages/${item.id}/edit` : '/resources/templates'}><ArrowUpRight size={14} className="shrink-0 text-accent" /><span className="truncate">{item.title || t('common.untitled')}</span></Link></li>)}</ul> : <p className="mt-3 text-sm leading-relaxed text-text-muted">{text.unused}</p>}
    </ResourceDetailDrawer>}
  </div>
}
