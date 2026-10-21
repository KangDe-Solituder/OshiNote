import { useRef, useState } from 'react'
import { useI18n } from '../../../i18n/useI18n'

export function JournalNumberField({ label, value, min, max, onChange }: { label: string; value: number; min?: number; max?: number; onChange: (value: number) => void }) {
  const { t } = useI18n()
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const cancelBlur = useRef(false)
  function commit() {
    if (draft === null) return
    const number = Number(draft)
    if (!draft.trim()) { setDraft(null); setError(false); return }
    if (!Number.isFinite(number) || (min !== undefined && number < min) || (max !== undefined && number > max)) { setError(true); return }
    setDraft(null)
    setError(false)
    onChange(number)
  }
  return <label className="grid gap-1.5 text-xs font-semibold text-text-muted">
    {label}
    <input type="text" inputMode="decimal" aria-label={label} value={draft ?? String(Math.round(value * 100) / 100)} aria-invalid={error}
      onChange={event => { setDraft(event.target.value); setError(false) }} onBlur={() => { if (cancelBlur.current) cancelBlur.current = false; else commit() }}
      onKeyDown={event => {
        if (event.key === 'Enter') { event.preventDefault(); commit() }
        if (event.key === 'Escape') { event.stopPropagation(); cancelBlur.current = true; setDraft(null); setError(false); event.currentTarget.blur() }
      }} className="min-w-0 rounded-xl border border-border-color bg-transparent px-3 py-2 text-sm text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-soft" />
    {error && <span role="alert" className="font-normal text-red-400">{t('journalEdit.numberRange', { min: min ?? '−∞', max: max ?? '∞' })}</span>}
  </label>
}
