import { useState } from 'react'
import { motion } from 'framer-motion'
import { Wand2, Loader2, Copy, Check, Sparkles } from 'lucide-react'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { useAiStore } from '../../../stores/aiStore'
import type { RefineOptions } from '../../../services/ai'

const TONES: { value: RefineOptions['tone']; label: string }[] = [
  { value: 'emotional', label: 'Emotional' },
  { value: 'polite', label: 'Polite' },
  { value: 'casual', label: 'Casual' },
  { value: 'neutral', label: 'Neutral' },
]

const FOCUSES: { value: RefineOptions['focus']; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'grammar', label: 'Grammar' },
  { value: 'phrasing', label: 'Phrasing' },
  { value: 'politeness', label: 'Politeness' },
]

export function RefinementPanel() {
  const { getActiveProvider } = useAiStore()

  const [draft, setDraft] = useState('')
  const [tone, setTone] = useState<RefineOptions['tone']>('emotional')
  const [focus, setFocus] = useState<RefineOptions['focus']>('general')
  const [context, setContext] = useState('')
  const [showContext, setShowContext] = useState(false)
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  async function handleRefine() {
    if (!draft.trim()) return
    const provider = getActiveProvider()
    if (!provider) { setError('No AI provider configured. Check Settings.'); return }

    setLoading(true)
    setError('')
    setResult('')
    try {
      const refined = await provider.refine(draft, { tone, focus, context: context || undefined })
      setResult(refined)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-full flex flex-col gap-4 p-4">
      <div className="shrink-0">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-3">
          <Wand2 size={20} className="text-accent" />
          Writing Refinement
        </h2>

        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1 bg-bg-secondary rounded-lg p-1">
            {TONES.map((t) => (
              <button
                key={t.value}
                onClick={() => setTone(t.value)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  tone === t.value
                    ? 'bg-bg-primary text-accent shadow-sm'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="w-px h-8 bg-border-color" />
          <div className="flex gap-1 bg-bg-secondary rounded-lg p-1">
            {FOCUSES.map((f) => (
              <button
                key={f.value}
                onClick={() => setFocus(f.value)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  focus === f.value
                    ? 'bg-bg-primary text-accent shadow-sm'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowContext(!showContext)}
            className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
              showContext || context
                ? 'border-accent text-accent bg-accent/5'
                : 'border-border-color text-text-muted hover:text-text-primary'
            }`}
          >
            <Sparkles size={14} className="inline mr-1" />
            Context
          </button>
        </div>

        {showContext && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-2"
          >
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Add context about your oshi (tweets, stream summary, style hints...)"
              rows={3}
              className="w-full px-3 py-2 rounded-xl border border-accent/30 bg-bg-secondary text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-soft resize-none"
            />
          </motion.div>
        )}
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[320px]">
        <Card className="flex flex-col" padding="none">
          <div className="px-3 py-2 border-b border-border-color text-xs font-medium text-text-muted">
            Your Draft
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write your draft message to your oshi here..."
            className="flex-1 w-full bg-transparent text-text-primary placeholder:text-text-muted focus:outline-none resize-none p-4 text-sm leading-relaxed"
          />
        </Card>

        <Card className="flex flex-col" padding="none">
          <div className="px-3 py-2 border-b border-border-color text-xs font-medium text-text-muted flex items-center justify-between">
            <span>Refined Version</span>
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
            {error && <p className="text-sm text-red-500">{error}</p>}
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
              <p className="text-sm text-text-muted">Refined text will appear here...</p>
            )}
          </div>
        </Card>
      </div>

      <div className="shrink-0 pb-1">
        <Button onClick={handleRefine} disabled={loading || !draft.trim()} className="w-full">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
          {loading ? 'Refining...' : 'Refine Writing'}
        </Button>
      </div>
    </div>
  )
}
