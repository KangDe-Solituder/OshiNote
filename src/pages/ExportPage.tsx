import { useState } from 'react'
import { Check, Cloud, Download, HardDrive, Loader2, Upload, RefreshCw, ShieldAlert } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { exportAllData, type ExportFormat } from '../services/export'
import { exportBackup, importBackup, type BackupMode } from '../services/backup'
import { downloadAndRestoreWebDavBackup, readWebDavConfig, saveWebDavConfig, testWebDavConnection, uploadWebDavBackup, type WebDavConfig } from '../services/sync/webdavService'
import { useI18n } from '../i18n/useI18n'

const FORMATS: { format: ExportFormat; label: string; descriptionKey: 'export.json.description' | 'export.markdown.description' | 'export.txt.description' }[] = [
  {
    format: 'json',
    label: 'JSON',
    descriptionKey: 'export.json.description',
  },
  {
    format: 'markdown',
    label: 'Markdown',
    descriptionKey: 'export.markdown.description',
  },
  {
    format: 'txt',
    label: 'TXT',
    descriptionKey: 'export.txt.description',
  },
]

export function ExportPage() {
  const { t } = useI18n()
  const [exporting, setExporting] = useState<ExportFormat | null>(null)
  const [backupAction, setBackupAction] = useState<BackupMode | 'import' | null>(null)
  const [done, setDone] = useState<ExportFormat | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [backupMessage, setBackupMessage] = useState<string | null>(null)
  const [webDav, setWebDav] = useState<WebDavConfig>(() => readWebDavConfig())
  const [webDavAction, setWebDavAction] = useState<'test' | 'upload' | 'download' | null>(null)
  const [webDavMessage, setWebDavMessage] = useState<string | null>(null)

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
    setBackupMessage(null)
    setError(null)
    try {
      await importBackup()
    } catch (err) {
      setError(String(err))
      setBackupAction(null)
    }
  }

  function updateWebDav(field: keyof WebDavConfig, value: string | boolean) {
    setWebDav((current) => ({ ...current, [field]: value }))
    setWebDavMessage(null)
  }

  async function handleWebDav(action: 'test' | 'upload' | 'download') {
    saveWebDavConfig(webDav)
    setWebDavAction(action)
    setWebDavMessage(null)
    setError(null)
    try {
      if (action === 'test') {
        await testWebDavConnection(webDav)
        setWebDavMessage(t('export.webdav.connected'))
      } else if (action === 'upload') {
        await uploadWebDavBackup(webDav)
        setWebDavMessage(t('export.webdav.uploaded'))
      } else {
        if (!window.confirm(t('export.webdav.downloadConfirm'))) return
        await downloadAndRestoreWebDavBackup(webDav)
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setWebDavAction(null)
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold text-text-primary mb-2">{t('export.title')}</h1>
      <p className="text-text-secondary mb-8">{t('export.subtitle')}</p>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {t('export.failed', { error })}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {FORMATS.map(({ format, label, descriptionKey }) => (
          <Card key={format} className="flex min-h-[196px] flex-col" hover={false}>
            <Download size={24} className="mb-3 shrink-0 text-accent" />
            <h3 className="mb-1 font-semibold text-text-primary">{label}</h3>
            <p className="min-h-[44px] text-sm text-text-muted">{t(descriptionKey)}</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-auto w-full whitespace-nowrap"
              onClick={() => handleExport(format)}
              disabled={exporting !== null}
            >
              {exporting === format ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {t('export.exporting')}
                </>
              ) : done === format ? (
                <>
                  <Check size={14} />
                  {t('common.saved')}
                </>
              ) : (
                <>
                  <Download size={14} />
                  {t('export.action', { format: label })}
                </>
              )}
            </Button>
          </Card>
        ))}
      </div>

      <section className="mt-10">
        <div className="mb-4 flex items-center gap-3">
          <HardDrive size={22} className="text-accent" />
          <div>
            <h2 className="text-xl font-bold text-text-primary">{t('export.backup.title')}</h2>
            <p className="text-sm text-text-muted">{t('export.backup.subtitle')}</p>
          </div>
        </div>
        {backupMessage && <p className="mb-4 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">{backupMessage}</p>}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <BackupCard
            title={t('export.backup.dataOnly.title')}
            description={t('export.backup.dataOnly.description')}
            button={t('export.backup.dataOnly.action')}
            busy={backupAction === 'data'}
            onClick={() => handleBackup('data')}
          />
          <BackupCard
            title={t('export.backup.complete.title')}
            description={t('export.backup.complete.description')}
            button={t('export.backup.complete.action')}
            busy={backupAction === 'complete'}
            onClick={() => handleBackup('complete')}
          />
          <BackupCard
            title={t('export.backup.import.title')}
            description={t('export.backup.import.description')}
            button={t('export.backup.import.action')}
            busy={backupAction === 'import'}
            onClick={handleImport}
            danger
          />
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-center gap-3">
          <Cloud size={22} className="text-accent" />
          <div>
            <h2 className="text-xl font-bold text-text-primary">{t('export.webdav.title')}</h2>
            <p className="text-sm text-text-muted">{t('export.webdav.subtitle')}</p>
          </div>
        </div>
        <Card hover={false}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
          {webDavMessage && <p className="mt-4 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">{webDavMessage}</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => handleWebDav('test')} disabled={webDavAction !== null}>
              {webDavAction === 'test' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {webDavAction === 'test' ? t('export.webdav.testing') : t('export.webdav.test')}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleWebDav('upload')} disabled={webDavAction !== null}>
              {webDavAction === 'upload' ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {webDavAction === 'upload' ? t('export.webdav.uploading') : t('export.webdav.upload')}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleWebDav('download')} disabled={webDavAction !== null}>
              {webDavAction === 'download' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {webDavAction === 'download' ? t('export.webdav.downloading') : t('export.webdav.download')}
            </Button>
          </div>
        </Card>
      </section>
    </div>
  )
}

function BackupCard({ title, description, button, busy, onClick, danger = false }: { title: string; description: string; button: string; busy: boolean; onClick: () => void; danger?: boolean }) {
  return (
    <Card hover={false} className="flex min-h-[190px] flex-col">
      <HardDrive size={24} className={danger ? 'mb-3 text-amber-600' : 'mb-3 text-accent'} />
      <h3 className="mb-1 font-semibold text-text-primary">{title}</h3>
      <p className="text-sm leading-relaxed text-text-muted">{description}</p>
      <Button variant={danger ? 'danger' : 'secondary'} size="sm" className="mt-auto w-full" onClick={onClick} disabled={busy}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : danger ? <Upload size={14} /> : <Download size={14} />}
        {busy ? '...' : button}
      </Button>
    </Card>
  )
}
