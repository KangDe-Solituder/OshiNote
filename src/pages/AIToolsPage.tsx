import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Languages, Wand2, AlertCircle } from 'lucide-react'
import { TranslationPanel } from '../components/features/ai/TranslationPanel'
import { RefinementPanel } from '../components/features/ai/RefinementPanel'
import { useAiStore } from '../stores/aiStore'
import { Card } from '../components/ui/Card'
import { useUiMotionSeconds } from '../components/features/themes/uiMotion'

type Tab = 'translate' | 'refine'

export function AIToolsPage() {
  const motionSeconds = useUiMotionSeconds()
  const [tab, setTab] = useState<Tab>('translate')
  const config = useAiStore((s) => s.config)
  const needsApiKey = config.provider !== 'local' && !config[config.provider].apiKey

  return (
    <div className="min-h-full flex flex-col">
      <div className="p-6 border-b border-border-color bg-bg-secondary/20 shrink-0">
        <h1 className="text-3xl font-bold text-text-primary mb-1">AI Tools</h1>
        <p className="text-text-secondary">AI-assisted translation and writing refinement.</p>

        <div className="flex gap-1 mt-4 bg-bg-secondary rounded-xl p-1 w-fit">
          {[
            { id: 'translate' as Tab, icon: Languages, label: 'Translation' },
            { id: 'refine' as Tab, icon: Wand2, label: 'Refinement' },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === id
                  ? 'bg-bg-primary text-accent shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {!config.enabled || needsApiKey ? (
          <div className="flex items-center justify-center h-full p-8">
            <Card className="text-center py-16 max-w-md">
              <AlertCircle size={48} className="mx-auto mb-4 text-accent-soft" />
              <h2 className="text-lg font-semibold text-text-primary mb-2">AI not configured</h2>
              <p className="text-sm text-text-muted mb-6">
                Set up an AI provider in Settings to use translation and writing refinement.
                Supports OpenAI, Claude, Gemini, and local APIs.
              </p>
            </Card>
          </div>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: motionSeconds }}
              className="min-h-full"
            >
              {tab === 'translate' ? <TranslationPanel /> : <RefinementPanel />}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
