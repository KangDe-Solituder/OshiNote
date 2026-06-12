import { useState } from 'react'
import { Download, Loader2, Check } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { exportAllData, type ExportFormat } from '../services/export'
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
  const [done, setDone] = useState<ExportFormat | null>(null)
  const [error, setError] = useState<string | null>(null)

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
    </div>
  )
}
