import { useId, useState } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { Loader2 } from 'lucide-react'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { SelectMenu } from '../components/ui/SelectMenu'
import { useI18n } from '../i18n/useI18n'
import { useDataText } from './dataText'
import { validateLocation, type DataLocation } from '../services/backup/locations'
import { testWebDavConnection } from '../services/sync/webdavService'

export function DataLocationEditor({ location, onClose, onSave }: { location: DataLocation | null; onClose: () => void; onSave: (value: DataLocation) => void }) {
  const formId = useId()
  const text = useDataText()
  const { t } = useI18n()
  const [draft, setDraft] = useState<DataLocation>(location || { id: crypto.randomUUID(), name: '', kind: 'local', directory: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [tested, setTested] = useState(false)
  function update(value: DataLocation) { setDraft(value); setTested(false); setError('') }
  return <Modal open onClose={() => { if (!busy) onClose() }} title={location ? text.editLocation : text.newLocation}>
    <form onSubmit={event => { event.preventDefault(); try { validateLocation(draft); onSave({ ...draft, name: draft.name.trim() }) } catch (e) { setError(String(e)) } }}>
      <fieldset disabled={busy} className="space-y-4">
        <Input id={`${formId}-name`} required maxLength={80} label={text.name} value={draft.name} onChange={e => update({ ...draft, name: e.target.value })} />
        <SelectMenu ariaLabel={text.kind} disabled={Boolean(location)} value={draft.kind} options={[{ value: 'local', label: text.local }, { value: 'webdav', label: text.cloud }]} onChange={kind => update(kind === 'local' ? { id: draft.id, name: draft.name, kind, directory: '' } : { id: draft.id, name: draft.name, kind: 'webdav', config: { baseUrl: '', remotePath: '', username: '', password: '', allowInvalidCert: false } })} />
        {draft.kind === 'local' ? <div className="space-y-3"><Input id={`${formId}-directory`} required label={text.directory} value={draft.directory} onChange={e => update({ ...draft, directory: e.target.value })} /><Button type="button" variant="secondary" onClick={() => { void open({ directory: true, multiple: false }).then(path => { if (typeof path === 'string') update({ ...draft, directory: path }) }).catch(e => setError(String(e))) }}>{text.browse}</Button></div> : <>
          <Input id={formId + '-url'} required label={t('export.webdav.url')} value={draft.config.baseUrl} onChange={e => update({ ...draft, config: { ...draft.config, baseUrl: e.target.value } })} />
          <Input id={formId + '-remote'} required label={t('export.webdav.remotePath')} value={draft.config.remotePath} onChange={e => update({ ...draft, config: { ...draft.config, remotePath: e.target.value } })} />
          <Input id={formId + '-username'} label={t('export.webdav.username')} value={draft.config.username} onChange={e => update({ ...draft, config: { ...draft.config, username: e.target.value } })} />
          <Input id={`${formId}-password`} type="password" autoComplete="new-password" label={t('export.webdav.password')} value={draft.config.password} onChange={e => update({ ...draft, config: { ...draft.config, password: e.target.value } })} />
          <label className="flex items-center gap-2 text-sm text-text-secondary"><input type="checkbox" checked={draft.config.allowInvalidCert} onChange={e => update({ ...draft, config: { ...draft.config, allowInvalidCert: e.target.checked } })} />{t('export.webdav.allowInvalidCert')}</label>
          <div className="flex flex-wrap items-center gap-3"><Button type="button" variant="secondary" aria-busy={busy} onClick={async () => { setError(''); setTested(false); setBusy(true); try { validateLocation(draft); await testWebDavConnection(draft.config); setTested(true) } catch (e) { setError(String(e)) } finally { setBusy(false) } }}>{busy && <Loader2 aria-hidden="true" size={16} className="animate-spin" />}{text.test}</Button>
          {(busy || tested) && <p role="status" className="text-sm text-accent">{busy ? text.busy : t('export.webdav.connected')}</p>}</div>
        </>}
        {error && <p role="alert" className="break-words text-sm text-red-400">{error}</p>}
        <div className="flex justify-end gap-3 pt-3"><Button type="button" variant="secondary" onClick={onClose}>{text.cancel}</Button><Button type="submit">{text.save}</Button></div>
      </fieldset>
    </form>
  </Modal>
}
