import { useEffect, useRef, useState } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { Loader2 } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { SelectMenu } from '../components/ui/SelectMenu'
import { UiHint } from '../components/ui/UiHint'
import { PAGE_CONTENT_CLASS, PAGE_FORM_FRAME_CLASS } from '../components/layout/pageShell'
import { useI18n } from '../i18n/useI18n'
import { useDataText } from './dataText'
import { DataLocationEditor } from './DataLocationEditor'
import { ConflictChoice } from './dataSyncPresentation'
import { conflictPreview, formatBytes, formatRemoteTime, formatSyncResult, shortEntityKey } from './dataFormatting'
import { loadLocations, saveLocations, type DataLocation, type LocationSettings } from '../services/backup/locations'
import { createLocationBackup, listLocationBackups, resolveBackupFile, type BackupEntry } from '../services/backup/catalog'
import { prepareRestore, discardRestore, activateRestore, type PreparedRestore } from '../services/backup/restore'
import { testWebDavConnection, type WebDavRepositoryInspection } from '../services/sync/webdavService'
import { finishPendingMerge, listSyncConflicts, resetIncrementalSyncState, resolveSyncConflict, runIncrementalSync, type StoredSyncConflict, type SyncMode } from '../services/sync/incrementalSync'
import { DATABASE_SCHEMA_VERSION } from '../database'

type FeedbackArea = 'locations' | 'sync' | 'backup' | 'restore'
type Feedback = { message: string; error?: boolean }

function OperationFeedback({ value }: { value?: Feedback }) {
  return value ? <p role={value.error ? 'alert' : 'status'} className={`min-w-0 break-words text-sm ${value.error ? 'text-red-400' : 'text-accent'}`}>{value.message}</p> : null
}

export function ExportPage() {
  const { t, locale } = useI18n()
  const text = useDataText()
  const [settings, setSettings] = useState<LocationSettings>({ locations: [], syncId: '', backupId: '' })
  const [locationsLoading, setLocationsLoading] = useState(true)
  const [editor, setEditor] = useState<DataLocation | 'new' | null>(null)
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Partial<Record<FeedbackArea, Feedback>>>({})
  const busy = locationsLoading || activeAction !== null
  function report(area: FeedbackArea, message: string, error = false) {
    setFeedback(current => ({ ...current, [area]: { message, error } }))
  }
  function clearFeedback(area: FeedbackArea) {
    setFeedback(current => ({ ...current, [area]: undefined }))
  }
  function spinner(action: string) {
    return activeAction === action ? <Loader2 aria-hidden="true" size={16} className="shrink-0 animate-spin" /> : null
  }
  const [inspection, setInspection] = useState<WebDavRepositoryInspection | null>(null)
  const [conflicts, setConflicts] = useState<StoredSyncConflict[]>([])
  const [sourceId, setSourceId] = useState(settings.backupId)
  const [entries, setEntries] = useState<BackupEntry[] | null>(null)
  const [entryPath, setEntryPath] = useState('')
  const [prepared, setPrepared] = useState<PreparedRestore | null>(null)
  const pendingRestore = useRef<PreparedRestore | null>(null)
  const operation = useRef(false)
  const cloud = settings.locations.find(x => x.id === settings.syncId && x.kind === 'webdav')
  const backup = settings.locations.find(x => x.id === settings.backupId)
  const source = settings.locations.find(x => x.id === sourceId)
  const entry = entries?.find(x => x.path === entryPath)

  useEffect(() => {
    let active = true
    void loadLocations().then(({ settings: loaded, locked }) => {
      if (!active) return
      setSettings(loaded); setSourceId(loaded.backupId)
      if (locked) report('locations', '本机凭据无法解锁，请编辑对应目录并重新输入密码 / Re-enter the password for this device.', true)
    }).catch(e => { if (active) report('locations', String(e), true) }).finally(() => { if (active) setLocationsLoading(false) })
    listSyncConflicts().then(setConflicts).catch(e => report('sync', String(e), true))
    return () => { active = false; if (pendingRestore.current) void discardRestore(pendingRestore.current).catch(() => undefined) }
  }, [])
  async function run(area: FeedbackArea, id: string, action: () => Promise<void>) {
    if (operation.current) return
    operation.current = true; setActiveAction(id); report(area, text.busy)
    try { await action(); setFeedback(current => current[area]?.message === text.busy ? { ...current, [area]: undefined } : current) }
    catch (e) { report(area, String(e), true) }
    finally { operation.current = false; setActiveAction(null) }
  }
  async function persist(next: LocationSettings) { await saveLocations(next); setSettings(next) }
  function clearList() { setEntries(null); setEntryPath('') }
  async function chooseSync(id: string) {
    if (id === settings.syncId) return
    if (settings.syncId && !window.confirm(text.switching)) return
    await run('sync', 'choose-sync', async () => {
      await resetIncrementalSyncState()
      await persist({ ...settings, syncId: id }); setConflicts([]); setInspection(null)
    })
  }
  async function sync(mode: SyncMode) {
    if (cloud?.kind !== 'webdav') return
    await run('sync', mode, async () => {
      const result = await runIncrementalSync(cloud.config, mode)
      setConflicts(await listSyncConflicts()); report('sync', formatSyncResult(result, t))
      setInspection(await testWebDavConnection(cloud.config))
    })
  }
  async function inspectFile(path: string) {
    const value = await prepareRestore(path)
    pendingRestore.current = value; setPrepared(value)
    report('restore', text.validated)
  }
  async function cancelRestore() {
    if (!prepared || busy) return
    await run('restore', 'cancel-restore', async () => { await discardRestore(prepared); pendingRestore.current = null; setPrepared(null) })
  }
  const locationOptions = [{ value: '', label: text.select }, ...settings.locations.map(x => ({ value: x.id, label: x.name }))]
  const unresolved = conflicts.filter(x => !x.resolution).length
  return <div className={PAGE_CONTENT_CLASS}><div className={`${PAGE_FORM_FRAME_CLASS} compact-page-blocks`}>
    <h1 className="mb-8 text-3xl font-bold text-text-primary">{t('export.title')}</h1>
    <div className="settings-layout-grid">
      <section className="settings-section settings-section-wide">
        <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">{text.locations}</h2><Button size="sm" disabled={busy} onClick={() => setEditor('new')}>{text.add}</Button></div>
        <UiHint className="mb-4 text-sm text-text-muted">{text.locationHint}</UiHint>
        <OperationFeedback value={feedback.locations} />
        <div className="data-location-grid">
          {settings.locations.map(location => <Card key={location.id} hover={false} className="min-w-0">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs text-text-muted">{location.kind === 'local' ? text.local : text.cloud}</p><h3 className="mt-1 truncate font-semibold">{location.name}</h3></div><div className="flex flex-wrap justify-end gap-1 text-xs text-accent">{location.id === settings.syncId && <span className="rounded-lg bg-accent/10 px-2 py-1">{text.sync}</span>}{location.id === settings.backupId && <span className="rounded-lg bg-accent/10 px-2 py-1">{text.backup}</span>}</div></div>
            <p className="my-3 break-all text-sm text-text-secondary">{location.kind === 'local' ? location.directory : `${location.config.baseUrl.replace(/\/$/, '')}/${location.config.remotePath}`}</p>
            <div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" disabled={busy} onClick={() => setEditor(location)}>{text.edit}</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => { if (window.confirm(text.removeConfirm)) void run('locations', `remove-${location.id}`, async () => { await persist({ locations: settings.locations.filter(x => x.id !== location.id), syncId: settings.syncId === location.id ? '' : settings.syncId, backupId: settings.backupId === location.id ? '' : settings.backupId }); if (location.id === sourceId) { setSourceId(''); clearList() } if (location.id === settings.syncId) setInspection(null) }) }}>{spinner(`remove-${location.id}`)}{text.remove}</Button></div>
          </Card>)}
          {!settings.locations.length && <Card hover={false}><p className="text-sm text-text-muted">{text.noLocations}</p></Card>}
        </div>
      </section>
      <section className="settings-section settings-section-wide">
        <h2 className="mb-4 text-lg font-semibold">{text.sync}</h2>
        <Card hover={false}>
          <div className="flex flex-wrap items-end gap-4"><div className="min-w-0"><label className="mb-2 block text-sm text-text-secondary">{text.syncTarget}</label><SelectMenu ariaLabel={text.syncTarget} disabled={busy} value={settings.syncId} onChange={id => void chooseSync(id)} options={[{ value: '', label: text.select }, ...settings.locations.filter(x => x.kind === 'webdav').map(x => ({ value: x.id, label: x.name }))]} /></div><div className="min-w-0 flex-1 basis-48 self-center"><OperationFeedback value={feedback.sync} /></div><Button aria-busy={activeAction === 'sync'} disabled={busy || !cloud} onClick={() => void sync('sync')}>{spinner('sync')}{t('export.sync.checkAndSync')}</Button></div>
          <UiHint className="mt-3 text-sm text-text-muted">{text.syncHint}</UiHint>
          <p className="mt-3 text-sm text-text-secondary">{inspection?.connected ? t('export.sync.connected') : t('export.sync.notChecked')}{inspection?.remote_updated_at ? ` · ${formatRemoteTime(inspection.remote_updated_at, locale)}` : ''}</p>
          {inspection && !inspection.supports_etag && <p className="mt-3 text-sm text-amber-500">{t('export.sync.noEtagWarning')}</p>}
          <details className="mt-4 border-t border-border-color pt-4"><summary className="cursor-pointer text-sm text-text-secondary">{text.advanced}</summary><div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={busy || !cloud} onClick={() => void sync('pull')}>{spinner('pull')}{t('export.sync.onlyPull')}</Button><Button size="sm" variant="secondary" disabled={busy || !cloud} onClick={() => void sync('push')}>{spinner('push')}{t('export.sync.onlyPush')}</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => { if (window.confirm(t('export.sync.resetConfirm'))) void run('sync', 'reset-sync', async () => { await resetIncrementalSyncState(); setConflicts([]); setInspection(null); report('sync', t('export.sync.resetDone')) }) }}>{spinner('reset-sync')}{t('export.sync.resetLink')}</Button>
          </div></details>
          {conflicts.length > 0 && <div className="mt-4 space-y-3 border-t border-border-color pt-4"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{t('export.sync.status.conflicts', { count: unresolved })}</h3><Button size="sm" disabled={busy || unresolved > 0 || cloud?.kind !== 'webdav'} onClick={() => void run('sync', 'merge', async () => { if (cloud?.kind !== 'webdav') return; const result = await finishPendingMerge(cloud.config); report('sync', formatSyncResult(result, t)); setConflicts(await listSyncConflicts()) })}>{spinner('merge')}{t('export.sync.finishMerge')}</Button></div>
            {conflicts.map(conflict => <div key={conflict.id}><p className="mb-2 text-sm">{shortEntityKey(conflict.entity_key)}</p><div className="grid gap-3 sm:grid-cols-2">{(['local', 'remote'] as const).map(side => <ConflictChoice key={side} label={t(side === 'local' ? 'export.sync.localVersion' : 'export.sync.remoteVersion')} preview={conflictPreview(side === 'local' ? conflict.local_value : conflict.remote_value)} selected={conflict.resolution === side} action={t(side === 'local' ? 'export.sync.keepLocal' : 'export.sync.keepRemote')} disabled={busy} onClick={() => void run('sync', `conflict-${conflict.id}`, async () => { await resolveSyncConflict(conflict.id, side); setConflicts(await listSyncConflicts()) })} />)}</div></div>)}
          </div>}
        </Card>
      </section>
      <section className="settings-section settings-section-half">
        <h2 className="mb-4 text-lg font-semibold">{text.backup}</h2><Card hover={false} className="space-y-4">
          <UiHint className="text-sm text-text-muted">{text.backupHint}</UiHint>
          <div className="flex flex-wrap items-center gap-4"><div className="min-w-0"><label className="mb-2 block text-sm text-text-secondary">{text.backupTarget}</label><SelectMenu ariaLabel={text.backupTarget} disabled={busy} value={settings.backupId} options={locationOptions} onChange={id => void run('backup', 'choose-backup', async () => { await persist({ ...settings, backupId: id }); clearFeedback('backup') })} /></div><div className="min-w-0 flex-1 basis-40"><OperationFeedback value={feedback.backup} /></div></div>
          <Button disabled={busy || !backup} onClick={() => void run('backup', 'create-backup', async () => { if (!backup) return; const path = await createLocationBackup(backup); report('backup', `${text.saved}：${path}`); if (sourceId === backup.id) { setEntries(await listLocationBackups(backup)); setEntryPath('') } })}>{spinner('create-backup')}{text.create}</Button>
        </Card>
      </section>
      <section className="settings-section settings-section-half">
        <h2 className="mb-4 text-lg font-semibold">{text.restore}</h2><Card hover={false} className="space-y-4">
          <UiHint className="text-sm text-text-muted">{text.restoreHint}</UiHint>
          <div className="flex flex-wrap items-center gap-4"><div className="min-w-0"><label className="mb-2 block text-sm text-text-secondary">{text.restoreSource}</label><SelectMenu ariaLabel={text.restoreSource} disabled={busy} value={sourceId} options={locationOptions} onChange={id => { setSourceId(id); clearList(); clearFeedback('restore') }} /></div><div className="min-w-0 flex-1 basis-40"><OperationFeedback value={feedback.restore} /></div></div>
          <div className="flex flex-wrap gap-2"><Button variant="secondary" size="sm" disabled={busy || !source} onClick={() => void run('restore', 'list-backups', async () => { if (source) { const list = await listLocationBackups(source); setEntries(list); setEntryPath(''); report('restore', list.length ? text.listLoaded.replace('{count}', String(list.length)) : text.empty) } })}>{spinner('list-backups')}{text.refresh}</Button><Button variant="secondary" size="sm" disabled={busy} onClick={() => void run('restore', 'select-file', async () => { const path = await open({ multiple: false, filters: [{ name: 'OshiNote', extensions: ['zip'] }] }); if (typeof path === 'string') await inspectFile(path) })}>{spinner('select-file')}{text.file}</Button></div>
          {entries && (entries.length ? <><SelectMenu ariaLabel={text.backupFile} disabled={busy} value={entryPath} options={[{ value: '', label: text.select }, ...entries.map(x => ({ value: x.path, label: `${x.name === 'oshinote-latest-full.oshi.zip' ? text.oldBackup : x.name} · ${formatBytes(x.bytes)}` }))]} onChange={path => { setEntryPath(path); clearFeedback('restore') }} /><Button disabled={busy || !entry} onClick={() => void run('restore', 'inspect-backup', async () => { if (source && entry) await inspectFile(await resolveBackupFile(source, entry)) })}>{spinner('inspect-backup')}{text.inspect}</Button></> : null)}
        </Card>
      </section>
    </div>
    {editor && <DataLocationEditor location={editor === 'new' ? null : editor} onClose={() => setEditor(null)} onSave={async value => {
      const previous = settings.locations.find(x => x.id === value.id)
      if (previous?.kind === 'webdav' && value.kind === 'webdav' && previous.id === settings.syncId && (previous.config.baseUrl !== value.config.baseUrl || previous.config.remotePath !== value.config.remotePath)) {
        await persist({ ...settings, locations: settings.locations.map(x => x.id === value.id ? value : x), syncId: '' }); setInspection(null)
      } else await persist({ ...settings, locations: previous ? settings.locations.map(x => x.id === value.id ? value : x) : [...settings.locations, value] })
      if (value.kind === 'webdav' && value.id === settings.syncId) {
        setInspection(null)
      }
      clearList(); setEditor(null)
    }} />}
    <Modal open={Boolean(prepared)} onClose={() => void cancelRestore()} title={text.ready}>
      {prepared && <div className="space-y-4"><p className="text-sm text-accent">{text.validated}</p><dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm"><dt>{text.created}</dt><dd>{/^\d+$/.test(prepared.created_at) ? new Date(Number(prepared.created_at)).toLocaleString() : prepared.created_at}</dd><dt>{text.appVersion}</dt><dd>{prepared.app_version || text.unknown}</dd><dt>{text.schema}</dt><dd>{prepared.database_schema_version} → {DATABASE_SCHEMA_VERSION}</dd></dl><p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-text-primary">{text.replaceWarning}</p><OperationFeedback value={feedback.restore?.error || busy ? feedback.restore : undefined} /><div className="flex justify-end gap-3"><Button disabled={busy} variant="secondary" onClick={() => void cancelRestore()}>{spinner('cancel-restore')}{text.cancel}</Button><Button disabled={busy} variant="danger" onClick={() => void run('restore', 'activate-restore', async () => { await activateRestore(prepared); pendingRestore.current = null })}>{spinner('activate-restore')}{text.confirmRestore}</Button></div></div>}
    </Modal>
  </div></div>
}
