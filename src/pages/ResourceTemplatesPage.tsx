import { UiHint } from '../components/ui/UiHint'
import { AnimatedCollapse } from '../components/ui/AnimatedCollapse'
import { ContentTransition } from '../components/ui/ContentTransition'
import { instantiateMaterialTemplate } from '../features/resources/resourceManagement'
import { readReusableLayout } from '../features/journal/journalReusableLayouts'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, FileText, Layers3, PackageOpen, ScrollText, Stamp as StampIcon } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { PAGE_CONTENT_CLASS, PAGE_HEADER_CLASS, PAGE_WIDE_FRAME_CLASS } from '../components/layout/pageShell'
import { useI18n } from '../i18n/useI18n'
import { fetchResourceTemplates, duplicateResourceTemplate, updateResourceTemplate } from '../features/templates/templateService'
import { exportTemplatePack, importResourcePack } from '../features/resources/resourcePacks'
import { useResourceActions } from '../features/resources/resourceActionsText'
import type { ResourceTemplate, ResourceTemplateType } from '../types'
import { getJournalPageTemplateDefinition } from '../features/journal/journalPageTemplates'
import { TemplateMiniPreview } from '../components/features/journal/JournalSetupStep'
import { Button } from '../components/ui/Button'
import { ResourcePagination } from '../components/features/ResourcePagination'
import { useResourcePagination } from '../features/resources/useResourcePagination'

const TYPE_ICONS = { note: FileText, journal_page: ScrollText, stamp: StampIcon, material: PackageOpen } satisfies Record<ResourceTemplateType, typeof FileText>
export function ResourceTemplatesPage() {
  const { t } = useI18n()
  const text = useResourceActions()
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<ResourceTemplate[]>([])
  const [type, setType] = useState<ResourceTemplateType | 'all'>('all')
  const [trash, setTrash] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const picker = useRef<HTMLInputElement>(null)
  useEffect(() => {
    let alive = true
    fetchResourceTemplates(undefined,true).then(rows => {
      rows.filter(row => row.type==='journal_page' && row.source==='user').forEach(row => readReusableLayout(row))
      if(alive) setTemplates(rows)
    }).catch(e=>{if(alive)setError(String(e))})
    return ()=>{alive=false}
  },[revision])
  const title = (template: ResourceTemplate) => template.source==='builtin' ? t(template.name as never) : template.name
  const filtered = templates.filter(template=>(type==='all'||template.type===type) && template.deleted===trash && title(template).toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  const pagination = useResourcePagination(filtered, JSON.stringify([type, trash, query]))
  const listScroll = useRef<HTMLDivElement>(null)
  useEffect(() => { listScroll.current?.scrollTo(0, 0) }, [pagination.page, pagination.size, type, trash, query])
  async function run(work:()=>Promise<unknown>) {
    setBusy(true);setError('')
    try {await work();setRevision(value=>value+1)} catch(e){setError(String(e))} finally{setBusy(false)}
  }
  const fieldClass='w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary'
  return <div className="flex h-full flex-col bg-bg-primary">
    <header className={`${PAGE_HEADER_CLASS} justify-between gap-4`}><div><Link to="/resources" className="text-sm text-text-muted">{t('resources.title')}</Link><h1 className="mt-1 text-3xl font-bold text-text-primary">{t('templates.title')}</h1></div>
      <Button disabled={busy} onClick={()=>picker.current?.click()}>{text.import}</Button>
      <input ref={picker} hidden type="file" accept=".json" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void run(()=>importResourcePack(file))}} />
    </header>
    <main className={`${PAGE_CONTENT_CLASS} !overflow-hidden`}><div className={`${PAGE_WIDE_FRAME_CLASS} flex h-full min-h-0 flex-col`}>
      <div ref={listScroll} className="resource-list-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2">
      <div className="mb-4 flex flex-wrap items-center gap-2"><input aria-label={text.search} placeholder={text.search} value={query} onChange={e=>setQuery(e.target.value)} className="rounded-lg border border-border-color bg-bg-card px-3 py-2 text-sm" />
        {(['all','note','journal_page','stamp','material'] as const).map(value=><button key={value} onClick={()=>setType(value)} className={`rounded-lg border px-3 py-2 text-sm ${type===value?'border-accent bg-accent-soft text-accent':'border-border-color bg-bg-card text-text-secondary'}`}>{value==='all'?text.all:t(`templates.type.${value}` as never)}</button>)}
        <button onClick={()=>setTrash(!trash)} aria-pressed={trash} className={`rounded-lg border px-3 py-2 text-sm ${trash?'border-accent text-accent':'border-border-color text-text-muted'}`}>{text.trash}</button>
      </div>
      {trash ? <p className="mb-5 text-sm text-text-muted">{text.deletedHint}</p> : <UiHint className="mb-5 text-sm text-text-muted">{text.templateHint}</UiHint>}
      {error&&<p role="alert" className="mb-4 text-red-400">{error}</p>}
      {!filtered.length&&<div className="py-16 text-center text-text-muted"><Layers3 className="mx-auto mb-3"/>{t('templates.empty.title')}</div>}
      <ContentTransition changeKey={pagination.visible.map(item => item.id).join(',')} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{pagination.visible.map(template=>{
        const Icon=TYPE_ICONS[template.type]
        const layout=template.type==='journal_page'?getJournalPageTemplateDefinition(template.id):null
        const name=title(template)
        return <section key={template.id} className="flex flex-col overflow-hidden rounded-xl border border-border-color bg-bg-card">
          {layout?<TemplateMiniPreview template={layout} className="!h-36 border-b border-border-color"/>:<div className="flex h-36 items-center justify-center bg-bg-primary/50"><Icon size={48} className="text-accent/60"/></div>}
          <div className="flex flex-1 flex-col p-4"><h2 className="font-semibold">{name}</h2><p className="mt-1 text-xs text-text-muted">{t(`templates.type.${template.type}` as never)} · {t(`templates.source.${template.source==='builtin'?'builtin':'user'}`)}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {!trash&&layout&&<Link to={`/journal/create?templateId=${encodeURIComponent(layout.id)}`} className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-sm text-white">{t('journalTemplates.use')}<ArrowRight size={14}/></Link>}
              {!trash&&template.type==='material'&&<Button disabled={busy} size="sm" onClick={()=>void run(async()=>{await instantiateMaterialTemplate(template.payload,name);navigate('/resources/materials')})}>{t('journalTemplates.use')}</Button>}
              {!trash&&<Button disabled={busy} size="sm" variant="secondary" onClick={()=>void run(async()=>{const copy=await duplicateResourceTemplate(template,`${name} · ${text.duplicate}`);setSelected(copy.id)})}>{text.duplicate}</Button>}
              {!trash&&<Button disabled={busy} size="sm" variant="secondary" onClick={()=>void run(()=>exportTemplatePack(template,name))}>{text.export}</Button>}
              {!trash&&template.source==='user'&&<Button disabled={busy} size="sm" variant="ghost" onClick={()=>setSelected(selected===template.id?null:template.id)}>{text.rename}</Button>}
              <Button disabled={busy} size="sm" variant="ghost" onClick={()=>void run(()=>updateResourceTemplate(template,{deleted:!template.deleted}))}>{trash?text.restore:text.remove}</Button>
            </div>
            <AnimatedCollapse open={selected===template.id&&template.source==='user'&&!trash}><form key={`${template.id}:${template.updated_at}`} className="mt-4 space-y-3 border-t border-border-color pt-3" onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);void run(()=>updateResourceTemplate(template,{name:String(data.get('name')),description:String(data.get('description'))}))}}><label className="block text-xs text-text-muted">{text.rename}<input required maxLength={160} name="name" aria-label={text.rename} defaultValue={template.name} className={`${fieldClass} mt-1`} /></label><label className="block text-xs text-text-muted">{text.description}<textarea name="description" aria-label={text.description} maxLength={1000} defaultValue={template.description} className={`${fieldClass} mt-1`} /></label><Button disabled={busy} size="sm" type="submit">{text.save}</Button></form></AnimatedCollapse>
          </div>
        </section>
      })}</ContentTransition>
      <ResourcePagination {...pagination} />
      </div>
    </div></main>
  </div>
}
