import { useEffect, useState } from 'react'
import type { ResourceTemplate, StampInput, StampTemplateId } from '../../../types'
import { fetchResourceTemplates, createResourceTemplate } from '../../../features/templates/templateService'
import { createStampInputFromTemplate, normalizeStampInput } from '../../../features/stamps/stampService'
import { useResourceActions } from '../../../features/resources/resourceActionsText'
import { useI18n } from '../../../i18n/useI18n'
import { Button } from '../../ui/Button'
import { isRecord } from '../../../utils/safeJson'
export function ResourceStampPresets({ stamp, onSelect }: { stamp: StampInput; onSelect: (stamp: StampInput) => void }) {
  const { t } = useI18n()
  const text = useResourceActions()
  const [templates, setTemplates] = useState<ResourceTemplate[]>([])
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(()=>{let alive=true;fetchResourceTemplates('stamp').then(rows=>{if(alive)setTemplates(rows)}).catch(e=>{if(alive)setError(String(e))});return ()=>{alive=false}},[])
  function apply(id:string) {
    try {
      const template=templates.find(item=>item.id===id)
      if(!template)return
      const payload:unknown=JSON.parse(template.payload)
      if(!isRecord(payload))throw Error('Invalid stamp template')
      const raw=isRecord(payload.stamp)?payload.stamp:payload
      if(typeof raw.template_id!=='string')throw Error('Invalid stamp template')
      const base=createStampInputFromTemplate(raw.template_id as StampTemplateId,typeof raw.label==='string'?raw.label:template.source==='builtin'?t(template.name as never):template.name)
      onSelect(normalizeStampInput({...base,...raw} as StampInput));setError('')
    }catch(e){setError(String(e))}
  }
  async function save() {
    setBusy(true);setError('')
    try {await createResourceTemplate({type:'stamp',name:name.trim(),payload:JSON.stringify({version:1,stamp:normalizeStampInput(stamp)})});setTemplates(await fetchResourceTemplates('stamp'));setName('')}catch(e){setError(String(e))}finally{setBusy(false)}
  }
  return <section className="mb-4 flex flex-wrap items-center gap-2 border-b border-border-color pb-4">
    <select aria-label={text.savedTemplates} value="" onChange={e=>apply(e.target.value)} className="max-w-64 rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm"><option value="">{text.savedTemplates}</option>{templates.map(item=><option key={item.id} value={item.id}>{item.source==='builtin'?t(item.name as never):item.name}</option>)}</select>
    <input aria-label={text.rename} placeholder={text.rename} value={name} maxLength={160} onChange={e=>setName(e.target.value)} className="min-w-0 rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm" />
    <Button size="sm" variant="secondary" disabled={busy||!name.trim()} onClick={()=>void save()}>{text.saveTemplate}</Button>
    {error&&<p role="alert" className="w-full text-sm text-red-400">{error}</p>}
  </section>
}
