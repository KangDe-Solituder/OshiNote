import { useEffect, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  Archive,
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  ChevronDown,
  Cloud,
  Database,
  Download,
  FileJson,
  FileText,
  GitMerge,
  HardDrive,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Upload,
} from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { exportAllData, type ExportFormat } from '../services/export'
import { exportBackup, importBackup, type BackupMode } from '../services/backup'
import {
  clearSyncCache,
  downloadAndRestoreWebDavBackup,
  inspectSyncCache,
  readWebDavConfig,
  saveWebDavConfig,
  testWebDavConnection,
  uploadWebDavBackup,
  type SyncCacheSummary,
  type WebDavConfig,
  type WebDavRepositoryInspection,
} from '../services/sync/webdavService'
import {
  finishPendingMerge,
  listSyncConflicts,
  resetIncrementalSyncState,
  resolveSyncConflict,
  runIncrementalSync,
  type IncrementalSyncSummary,
  type StoredSyncConflict,
  type SyncMode,
} from '../services/sync/incrementalSync'
import { useI18n } from '../i18n/useI18n'
import { PAGE_CONTENT_CLASS, PAGE_FORM_FRAME_CLASS } from '../components/layout/pageShell'

type DataTab = 'sync' | 'backup' | 'export'
type BackupAction = BackupMode | 'import' | 'webdav-upload' | 'webdav-download' | null
type SyncAction = 'test' | SyncMode | 'merge' | null

export function ExportPage() {
  const { locale, t } = useI18n()
  const [activeTab, setActiveTab] = useState<DataTab>('sync')
  const [exporting, setExporting] = useState<ExportFormat | null>(null)
  const [done, setDone] = useState<ExportFormat | null>(null)
  const [backupAction, setBackupAction] = useState<BackupAction>(null)
  const [syncAction, setSyncAction] = useState<SyncAction>(null)
  const [cacheAction, setCacheAction] = useState<'inspect' | 'clear' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [backupMessage, setBackupMessage] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [cacheMessage, setCacheMessage] = useState<string | null>(null)
  const [webDav, setWebDav] = useState<WebDavConfig>(() => readWebDavConfig())
  const [inspection, setInspection] = useState<WebDavRepositoryInspection | null>(null)
  const [conflicts, setConflicts] = useState<StoredSyncConflict[]>([])
  const [cacheSummary, setCacheSummary] = useState<SyncCacheSummary | null>(null)

  useEffect(() => {
    listSyncConflicts().then(setConflicts).catch(() => undefined)
  }, [])

  function updateWebDav(field: keyof WebDavConfig, value: string | boolean) {
    setWebDav((current) => ({ ...current, [field]: value }))
    setInspection(null)
    setSyncMessage(null)
  }

  async function handleExport(format: ExportFormat) {
    setExporting(format)
    setDone(null)
    setError(null)
    try {
      await exportAllData(format)
      setDone(format)
    } catch (err) {
      setError(String(err))
    } finally {
      setExporting(null)
    }
  }

  async function handleBackup(mode: BackupMode) {
    setBackupAction(mode)
    setBackupMessage(null)
    setError(null)
    try {
      const result = await exportBackup(mode)
      if (result) setBackupMessage(t('export.backup.saved'))
    } catch (err) {
      setError(String(err))
    } finally {
      setBackupAction(null)
    }
  }

  async function handleImport() {
    if (!window.confirm(t('export.backup.importConfirm'))) return
    setBackupAction('import')
    setError(null)
    try {
      await importBackup()
    } catch (err) {
      setError(String(err))
      setBackupAction(null)
    }
  }

  async function handleSnapshotAction(action: 'webdav-upload' | 'webdav-download') {
    saveWebDavConfig(webDav)
    if (action === 'webdav-download' && !window.confirm(t('export.webdav.downloadConfirm'))) return
    setBackupAction(action)
    setBackupMessage(null)
    setError(null)
    try {
      if (action === 'webdav-upload') {
        const synced = await runIncrementalSync(webDav, 'sync')
        if (synced.status === 'conflicts') {
          setConflicts(await listSyncConflicts())
          throw new Error(t('export.sync.status.conflicts', { count: synced.conflicts }))
        }
        await uploadWebDavBackup(webDav)
        setBackupMessage(t('export.webdav.uploaded'))
      } else {
        await downloadAndRestoreWebDavBackup(webDav)
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setBackupAction(null)
    }
  }

  async function handleConnectionTest() {
    saveWebDavConfig(webDav)
    setSyncAction('test')
    setSyncMessage(null)
    setError(null)
    try {
      const result = await testWebDavConnection(webDav)
      setInspection(result)
      setSyncMessage(t('export.webdav.connected'))
    } catch (err) {
      setError(String(err))
    } finally {
      setSyncAction(null)
    }
  }

  async function handleSync(mode: SyncMode) {
    saveWebDavConfig(webDav)
    setSyncAction(mode)
    setSyncMessage(null)
    setError(null)
    try {
      const result = await runIncrementalSync(webDav, mode)
      setSyncMessage(formatSyncResult(result, t))
      setInspection(await testWebDavConnection(webDav))
      setConflicts(await listSyncConflicts())
    } catch (err) {
      setError(String(err))
    } finally {
      setSyncAction(null)
    }
  }

  async function handleConflictResolution(id: string, resolution: 'local' | 'remote') {
    setError(null)
    try {
      await resolveSyncConflict(id, resolution)
      setConflicts(await listSyncConflicts())
    } catch (err) {
      setError(String(err))
    }
  }

  async function handleFinishMerge() {
    setSyncAction('merge')
    setError(null)
    try {
      const result = await finishPendingMerge(webDav)
      setSyncMessage(formatSyncResult(result, t))
      setConflicts(await listSyncConflicts())
      setInspection(await testWebDavConnection(webDav))
    } catch (err) {
      setError(String(err))
    } finally {
      setSyncAction(null)
    }
  }

  async function handleInspectCache() {
    setCacheAction('inspect')
    setCacheMessage(null)
    setError(null)
    try {
      const result = await inspectSyncCache()
      setCacheSummary(result)
      if (result.bytes === 0) setCacheMessage(t('export.sync.cacheEmpty'))
    } catch (err) {
      setError(String(err))
    } finally {
      setCacheAction(null)
    }
  }

  async function handleClearCache() {
    if (!cacheSummary || cacheSummary.bytes === 0) return
    const size = formatBytes(cacheSummary.bytes)
    if (!window.confirm(t('export.sync.clearCacheConfirm', { size }))) return
    setCacheAction('clear')
    setError(null)
    try {
      const cleared = await clearSyncCache()
      setCacheSummary({ bytes: 0, files: 0 })
      setCacheMessage(t('export.sync.cacheCleared', { size: formatBytes(cleared.bytes) }))
    } catch (err) {
      setError(String(err))
    } finally {
      setCacheAction(null)
    }
  }

  async function handleResetSyncLink() {
    if (!window.confirm(t('export.sync.resetConfirm'))) return
    setError(null)
    try {
      await resetIncrementalSyncState()
      setInspection(null)
      setConflicts([])
      setSyncMessage(t('export.sync.resetDone'))
    } catch (err) {
      setError(String(err))
    }
  }

  const remoteTime = inspection?.remote_updated_at
    ? formatRemoteTime(inspection.remote_updated_at, locale)
    : null
  const unresolvedConflicts = conflicts.filter((conflict) => !conflict.resolution).length

  return (
    <div className={PAGE_CONTENT_CLASS}>
      <div className={PAGE_FORM_FRAME_CLASS}>
      <h1 className="mb-2 text-3xl font-bold text-text-primary">{t('export.title')}</h1>
      <p className="mb-6 text-text-secondary">{t('export.subtitle')}</p>

      <div className="mb-8 inline-flex rounded-xl border border-border-color bg-bg-secondary p-1">
        {(['sync', 'backup', 'export'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-accent text-white shadow-sm' : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
            }`}
          >
            {t(`export.tabs.${tab}`)}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-300/60 bg-red-50/80 p-4 text-sm text-red-700">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>{t('export.failed', { error })}</span>
        </div>
      )}

      {activeTab === 'sync' && (
        <section>
          <SectionHeader icon={<Cloud size={22} />} title={t('export.sync.title')} subtitle={t('export.sync.subtitle')} />
          <Card hover={false}>
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div className="flex items-start gap-3">
                <span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${inspection?.connected ? 'bg-emerald-500 ring-4 ring-emerald-500/15' : 'bg-text-muted/40'}`} />
                <div>
                  <p className="font-semibold text-text-primary">
                    {inspection?.connected ? `${t('export.sync.connected')} · WebDAV` : t('export.sync.notChecked')}
                  </p>
                  <p className="mt-1 text-sm text-text-muted">
                    {remoteTime
                      ? `${t('export.sync.remoteUpdated')}：${remoteTime}（${t('export.sync.serverTime')}）`
                      : t('export.sync.remoteTimeUnavailable')}
                  </p>
                  {inspection && (
                    <p className="mt-1 text-xs text-text-muted">
                      {inspection.repository_initialized ? t('export.sync.repositoryReady') : t('export.sync.repositoryMissing')}
                      {inspection.remote_head ? ` · ${t('export.sync.remoteHead')} ${inspection.remote_head.slice(0, 8)}` : ''}
                    </p>
                  )}
                </div>
              </div>
              <Button onClick={() => handleSync('sync')} disabled={syncAction !== null || backupAction !== null || cacheAction !== null}>
                {syncAction === 'sync' ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                {t('export.sync.checkAndSync')}
              </Button>
            </div>

            {syncMessage && <p className="mt-5 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">{syncMessage}</p>}

            <div className="mt-5 flex flex-wrap gap-2 border-t border-border-color pt-5">
              <Button variant="secondary" size="sm" onClick={() => handleSync('pull')} disabled={syncAction !== null || backupAction !== null || cacheAction !== null}>
                {syncAction === 'pull' ? <Loader2 size={14} className="animate-spin" /> : <ArrowDownToLine size={14} />}
                {t('export.sync.onlyPull')}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => handleSync('push')} disabled={syncAction !== null || backupAction !== null || cacheAction !== null}>
                {syncAction === 'push' ? <Loader2 size={14} className="animate-spin" /> : <ArrowUpFromLine size={14} />}
                {t('export.sync.onlyPush')}
              </Button>
              <span className="flex items-center gap-2 px-2 text-sm text-text-muted">
                <GitMerge size={14} />
                {conflicts.length ? t('export.sync.status.conflicts', { count: conflicts.length }) : t('export.sync.noConflicts')}
              </span>
            </div>

            <details className="mt-5 border-t border-border-color pt-5">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-text-primary">
                <ChevronDown size={15} />{t('export.sync.connectionSettings')}
              </summary>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input label={t('export.webdav.url')} value={webDav.baseUrl} onChange={(event) => updateWebDav('baseUrl', event.target.value)} />
                <Input label={t('export.webdav.remotePath')} value={webDav.remotePath} onChange={(event) => updateWebDav('remotePath', event.target.value)} />
                <Input label={t('export.webdav.username')} value={webDav.username} onChange={(event) => updateWebDav('username', event.target.value)} />
                <Input label={t('export.webdav.password')} type="password" value={webDav.password} onChange={(event) => updateWebDav('password', event.target.value)} autoComplete="new-password" />
              </div>
              <label className="mt-4 flex items-start gap-3 text-sm text-text-secondary">
                <input type="checkbox" checked={webDav.allowInvalidCert} onChange={(event) => updateWebDav('allowInvalidCert', event.target.checked)} className="mt-1 accent-accent" />
                <span>
                  <span className="flex items-center gap-2 font-medium text-text-primary"><ShieldAlert size={15} />{t('export.webdav.allowInvalidCert')}</span>
                  <span className="mt-1 block text-xs text-text-muted">{t('export.webdav.allowInvalidCertHint')}</span>
                </span>
              </label>
              <p className="mt-4 rounded-xl border border-amber-300/50 bg-amber-50/70 px-4 py-3 text-xs leading-relaxed text-amber-800">{t('export.webdav.securityNote')}</p>
              {inspection && !inspection.supports_etag && (
                <p className="mt-3 rounded-xl border border-amber-300/50 bg-amber-50/70 px-4 py-3 text-xs leading-relaxed text-amber-800">
                  {t('export.sync.noEtagWarning')}
                </p>
              )}
              <Button className="mt-4" variant="secondary" size="sm" onClick={handleConnectionTest} disabled={syncAction !== null || backupAction !== null || cacheAction !== null}>
                {syncAction === 'test' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {syncAction === 'test' ? t('export.webdav.testing') : t('export.webdav.test')}
              </Button>
              <Button className="mt-4 ml-2" variant="ghost" size="sm" onClick={handleResetSyncLink} disabled={syncAction !== null || backupAction !== null || cacheAction !== null}>
                {t('export.sync.resetLink')}
              </Button>
            </details>
          </Card>

          {conflicts.length > 0 && (
            <Card hover={false} className="mt-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-text-primary">{t('export.sync.conflicts')}</h3>
                  <p className="mt-1 text-sm text-text-muted">{t('export.sync.status.conflicts', { count: unresolvedConflicts })}</p>
                </div>
                <Button size="sm" onClick={handleFinishMerge} disabled={unresolvedConflicts > 0 || syncAction !== null || backupAction !== null || cacheAction !== null}>
                  {syncAction === 'merge' ? <Loader2 size={14} className="animate-spin" /> : <GitMerge size={14} />}
                  {t('export.sync.finishMerge')}
                </Button>
              </div>
              <div className="space-y-3">
                {conflicts.map((conflict) => (
                  <div key={conflict.id} className="rounded-xl border border-border-color bg-bg-secondary p-4">
                    <p className="text-sm font-medium text-text-primary">{conflict.entity_type} · {shortEntityKey(conflict.entity_key)}</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <ConflictChoice
                        label={t('export.sync.localVersion')}
                        preview={conflictPreview(conflict.local_value)}
                        selected={conflict.resolution === 'local'}
                        action={t('export.sync.keepLocal')}
                        onClick={() => handleConflictResolution(conflict.id, 'local')}
                        disabled={syncAction !== null || backupAction !== null || cacheAction !== null}
                      />
                      <ConflictChoice
                        label={t('export.sync.remoteVersion')}
                        preview={conflictPreview(conflict.remote_value)}
                        selected={conflict.resolution === 'remote'}
                        action={t('export.sync.keepRemote')}
                        onClick={() => handleConflictResolution(conflict.id, 'remote')}
                        disabled={syncAction !== null || backupAction !== null || cacheAction !== null}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card hover={false} className="mt-4">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div className="flex items-start gap-3">
                <Trash2 size={20} className="mt-0.5 shrink-0 text-accent" />
                <div>
                  <h3 className="font-semibold text-text-primary">{t('export.sync.cacheTitle')}</h3>
                  <p className="mt-1 text-sm text-text-muted">{t('export.sync.cacheDescription')}</p>
                  {cacheMessage && <p className="mt-2 text-sm text-accent">{cacheMessage}</p>}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={handleInspectCache} disabled={cacheAction !== null || syncAction !== null || backupAction !== null}>
                  {cacheAction === 'inspect' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  {t('export.sync.inspectCache')}
                </Button>
                {cacheSummary && cacheSummary.bytes > 0 && (
                  <Button variant="secondary" size="sm" onClick={handleClearCache} disabled={cacheAction !== null || syncAction !== null || backupAction !== null}>
                    {cacheAction === 'clear' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    {t('export.sync.clearCache', { size: formatBytes(cacheSummary.bytes) })}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </section>
      )}

      {activeTab === 'backup' && (
        <section>
          <SectionHeader icon={<Archive size={22} />} title={t('export.backup.title')} subtitle={t('export.backup.subtitle')} />
          {backupMessage && <p className="mb-4 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">{backupMessage}</p>}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DataActionCard
              icon={<HardDrive size={23} />}
              title={t('export.backup.snapshotTitle')}
              description={t('export.backup.snapshotDescription')}
              action={t('export.backup.snapshotAction')}
              busy={backupAction === 'complete'}
              disabled={backupAction !== null || syncAction !== null || cacheAction !== null}
              onClick={() => handleBackup('complete')}
            />
            <DataActionCard
              icon={<Upload size={23} />}
              title={t('export.backup.restoreTitle')}
              description={t('export.backup.restoreDescription')}
              action={t('export.backup.import.action')}
              busy={backupAction === 'import'}
              disabled={backupAction !== null || syncAction !== null || cacheAction !== null}
              onClick={handleImport}
              danger
            />
          </div>

          <Card hover={false} className="mt-4">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <div className="flex items-start gap-3">
                <Cloud size={22} className="mt-0.5 shrink-0 text-accent" />
                <div>
                  <h3 className="font-semibold text-text-primary">{t('export.backup.webdavTitle')}</h3>
                  <p className="mt-1 text-sm text-text-muted">{t('export.backup.webdavDescription')}</p>
                  {inspection?.remote_updated_at && <p className="mt-2 text-xs text-text-muted">{t('export.sync.remoteUpdated')}：{formatRemoteTime(inspection.remote_updated_at, locale)}</p>}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => handleSnapshotAction('webdav-upload')} disabled={backupAction !== null || syncAction !== null || cacheAction !== null}>
                  {backupAction === 'webdav-upload' ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {t('export.webdav.upload')}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => handleSnapshotAction('webdav-download')} disabled={backupAction !== null || syncAction !== null || cacheAction !== null}>
                  {backupAction === 'webdav-download' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  {t('export.webdav.download')}
                </Button>
              </div>
            </div>
          </Card>

          <details className="mt-4 rounded-xl border border-border-color bg-bg-card p-5">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-text-primary">
              <ChevronDown size={15} />{t('export.backup.advanced')}
            </summary>
            <div className="mt-4 flex flex-col justify-between gap-4 border-t border-border-color pt-4 md:flex-row md:items-center">
              <div>
                <h3 className="font-medium text-text-primary">{t('export.backup.diagnosticTitle')}</h3>
                <p className="mt-1 text-sm text-text-muted">{t('export.backup.diagnosticDescription')}</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => handleBackup('data')} disabled={backupAction !== null || syncAction !== null || cacheAction !== null}>
                {backupAction === 'data' ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                {t('export.backup.dataOnly.action')}
              </Button>
            </div>
          </details>
        </section>
      )}

      {activeTab === 'export' && (
        <section>
          <SectionHeader icon={<Download size={22} />} title={t('export.content.title')} subtitle={t('export.content.subtitle')} />
          <Card hover={false}>
            <ExportRow
              icon={<FileJson size={21} />}
              label="JSON"
              description={t('export.json.description')}
              busy={exporting === 'json'}
              disabled={syncAction !== null || backupAction !== null || cacheAction !== null || exporting !== null}
              done={done === 'json'}
              action={t('export.action', { format: 'JSON' })}
              onClick={() => handleExport('json')}
            />
            <ExportRow
              icon={<FileText size={21} />}
              label="Markdown"
              description={t('export.markdown.description')}
              busy={exporting === 'markdown'}
              disabled={syncAction !== null || backupAction !== null || cacheAction !== null || exporting !== null}
              done={done === 'markdown'}
              action={t('export.action', { format: 'Markdown' })}
              onClick={() => handleExport('markdown')}
            />
            <details className="border-t border-border-color pt-4">
              <summary className="mb-2 flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-text-primary">
                <ChevronDown size={15} />{t('export.content.more')}
              </summary>
              <ExportRow
                icon={<FileText size={21} />}
                label="TXT"
                description={t('export.txt.description')}
                busy={exporting === 'txt'}
                disabled={syncAction !== null || backupAction !== null || cacheAction !== null || exporting !== null}
                done={done === 'txt'}
                action={t('export.action', { format: 'TXT' })}
                onClick={() => handleExport('txt')}
                last
              />
            </details>
          </Card>
        </section>
      )}
      </div>
    </div>
  )
}

function SectionHeader({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span className="rounded-lg bg-accent-soft p-2 text-accent">{icon}</span>
      <div>
        <h2 className="text-xl font-bold text-text-primary">{title}</h2>
        <p className="mt-1 text-sm text-text-muted">{subtitle}</p>
      </div>
    </div>
  )
}

function DataActionCard({ icon, title, description, action, busy, disabled, onClick, danger = false }: {
  icon: ReactNode
  title: string
  description: string
  action: string
  busy: boolean
  disabled: boolean
  onClick: () => void
  danger?: boolean
}) {
  return (
    <Card hover={false} className="flex min-h-[190px] flex-col">
      <span className={danger ? 'mb-3 text-amber-600' : 'mb-3 text-accent'}>{icon}</span>
      <h3 className="font-semibold text-text-primary">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-text-muted">{description}</p>
      <Button variant={danger ? 'danger' : 'secondary'} size="sm" className="mt-auto w-full" onClick={onClick} disabled={disabled}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : icon}
        {busy ? '...' : action}
      </Button>
    </Card>
  )
}

function ExportRow({ icon, label, description, busy, disabled, done, action, onClick, last = false }: {
  icon: ReactNode
  label: string
  description: string
  busy: boolean
  disabled: boolean
  done: boolean
  action: string
  onClick: () => void
  last?: boolean
}) {
  return (
    <div className={`flex flex-col justify-between gap-4 py-4 md:flex-row md:items-center ${last ? '' : 'border-b border-border-color'}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-accent">{icon}</span>
        <div><h3 className="font-medium text-text-primary">{label}</h3><p className="mt-1 text-sm text-text-muted">{description}</p></div>
      </div>
      <Button variant="secondary" size="sm" onClick={onClick} disabled={disabled}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : done ? <Check size={14} /> : <Download size={14} />}
        {action}
      </Button>
    </div>
  )
}

function ConflictChoice({ label, preview, selected, action, onClick, disabled }: {
  label: string
  preview: string
  selected: boolean
  action: string
  onClick: () => void
  disabled: boolean
}) {
  return (
    <div className={`rounded-lg border p-3 ${selected ? 'border-accent bg-accent-soft' : 'border-border-color bg-bg-card'}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
      <p className="my-3 line-clamp-3 text-sm text-text-secondary">{preview}</p>
      <Button variant={selected ? 'primary' : 'secondary'} size="sm" onClick={onClick} disabled={disabled}>
        {selected && <Check size={13} />}{action}
      </Button>
    </div>
  )
}

function formatSyncResult(
  result: IncrementalSyncSummary,
  t: ReturnType<typeof useI18n>['t']
): string {
  if (result.status === 'up-to-date') return t('export.sync.status.upToDate')
  if (result.status === 'pushed') return t('export.sync.status.pushed', { count: result.uploadedRecords, size: formatBytes(result.transferredBytes) })
  if (result.status === 'pulled') return t('export.sync.status.pulled', { count: result.downloadedRecords, size: formatBytes(result.transferredBytes) })
  if (result.status === 'merged') return t('export.sync.status.merged', { size: formatBytes(result.transferredBytes) })
  return t('export.sync.status.conflicts', { count: result.conflicts })
}

function formatRemoteTime(value: string, locale: string): string {
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) return value
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'medium' }).format(timestamp)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function shortEntityKey(value: string): string {
  const [table, id] = value.split(':')
  return `${table}:${id?.slice(0, 8) || ''}`
}

function conflictPreview(value: string | null): string {
  if (!value) return '∅'
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    for (const key of ['title', 'name', 'label', 'description', 'hash']) {
      if (typeof parsed[key] === 'string' && parsed[key]) return String(parsed[key])
    }
    return JSON.stringify(parsed).slice(0, 180)
  } catch {
    return value.slice(0, 180)
  }
}
