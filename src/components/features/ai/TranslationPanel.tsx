import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Loader2, Copy, Check, Languages } from 'lucide-react'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { useAiStore } from '../../../stores/aiStore'
import type { Language } from '../../../services/ai'
import { LANGUAGE_LABELS } from '../../../services/ai'

const SUPPORTED_LANGS: Language[] = ['ja', 'zh', 'en']

export function TranslationPanel() {
  const { getActiveProvider } = useAiStore()

  const [sourceText, setSourceText] = useState('')
  const [fromLang, setFromLang] = useState<Language>('ja')
  const [toLang, setToLang] = useState<Language>('zh')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  async function handleTranslate() {
    if (!sourceText.trim()) return
    const provider = getActiveProvider()
    if (!provider) { setError('No AI provider configured. Check Settings.'); return }

    setLoading(true)
    setError('')
    setResult('')
    try {
      const translation = await provider.translate(sourceText, fromLang, toLang)
      setResult(translation)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  function swapLanguages() {
    if (loading) return
    setFromLang(toLang)
    setToLang(fromLang)
    setSourceText(result)
    setResult('')
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="h-full flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <Languages size={20} className="text-accent" />
          Translation
        </h2>
        <div className="flex items-center gap-2 text-sm">
          <select
            value={fromLang}
            onChange={(e) => setFromLang(e.target.value as Language)}
            className="px-3 py-1.5 rounded-lg border border-border-color bg-bg-secondary text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-soft"
          >
            {SUPPORTED_LANGS.map((l) => (
              <option key={l} value={l}>{LANGUAGE_LABELS[l]}</option>
            ))}
          </select>
          <button
            onClick={swapLanguages}
            className="p-1.5 rounded-lg hover:bg-bg-tertiary text-text-muted hover:text-accent transition-colors"
          >
            <ArrowRight size={18} />
          </button>
          <select
            value={toLang}
            onChange={(e) => setToLang(e.target.value as Language)}
            className="px-3 py-1.5 rounded-lg border border-border-color bg-bg-secondary text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-soft"
          >
            {SUPPORTED_LANGS.map((l) => (
              <option key={l} value={l}>{LANGUAGE_LABELS[l]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
        <Card className="flex flex-col" padding="none">
          <div className="px-3 py-2 border-b border-border-color text-xs font-medium text-text-muted">
            Original
          </div>
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="Paste your text here... (JP / EN / ZH)"
            className="flex-1 w-full bg-transparent text-text-primary placeholder:text-text-muted focus:outline-none resize-none p-4 text-sm leading-relaxed"
          />
        </Card>

        <Card className="flex flex-col relative" padding="none">
          <div className="px-3 py-2 border-b border-border-color text-xs font-medium text-text-muted flex items-center justify-between">
            <span>Translation</span>
            {result && (
              <button
                onClick={handleCopy}
                className="p-1 rounded hover:bg-bg-tertiary text-text-muted hover:text-accent transition-colors"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            )}
          </div>
          <div className="flex-1 p-4 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center h-full">
                <Loader2 size={24} className="animate-spin text-accent" />
              </div>
            )}
            {error && (
              <div className="text-sm text-red-500">
                <p>{error}</p>
              </div>
            )}
            {!loading && !error && result && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed"
              >
                {result}
              </motion.p>
            )}
            {!loading && !error && !result && (
              <p className="text-sm text-text-muted">Translation will appear here...</p>
            )}
          </div>
        </Card>
      </div>

      <div className="shrink-0">
        <Button onClick={handleTranslate} disabled={loading || !sourceText.trim()} className="w-full">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Languages size={16} />}
          {loading ? 'Translating...' : 'Translate'}
        </Button>
      </div>
    </div>
  )
}
