import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { useThemeStore } from '../stores/themeStore'
import { useAiStore } from '../stores/aiStore'
import type { ThemeId, UiMotionDuration } from '../types'
import type { AiProviderId } from '../services/ai'
import { getProviderName } from '../services/ai'
import clsx from 'clsx'

const THEMES: { id: ThemeId; label: string; description: string }[] = [
  { id: 'pink-cozy', label: 'Pink Cozy', description: 'Warm and sweet' },
  { id: 'dark-night', label: 'Dark Night', description: 'Calm and deep' },
  { id: 'soft-blue', label: 'Soft Blue', description: 'Gentle and airy' },
  { id: 'sakura', label: 'Sakura', description: 'Romantic and soft' },
  { id: 'rainy-cafe', label: 'Rainy Cafe', description: 'Moody and cozy' },
]

const AI_PROVIDERS: AiProviderId[] = ['openai', 'claude', 'gemini', 'local']

const UI_MOTION_OPTIONS: { value: UiMotionDuration; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'fast', label: 'Fast' },
  { value: 'normal', label: 'Normal' },
  { value: 'slow', label: 'Slow' },
]

export function SettingsPage() {
  const { currentTheme, setTheme, fontSize, setFontSize, uiMotionDuration, setUiMotionDuration } = useThemeStore()
  const { config, setProvider, setEnabled, setProviderConfig } = useAiStore()

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-text-primary mb-8">Settings</h1>

      {/* Theme */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Theme</h2>
        <div className="grid grid-cols-2 gap-3">
          {THEMES.map((theme) => (
            <button
              key={theme.id}
              onClick={() => setTheme(theme.id)}
              className={clsx(
                'p-4 rounded-xl border-2 text-left transition-all',
                currentTheme === theme.id
                  ? 'border-accent bg-accent/5'
                  : 'border-border-color hover:border-border-hover bg-bg-secondary'
              )}
            >
              <p className="font-medium text-text-primary">{theme.label}</p>
              <p className="text-sm text-text-muted">{theme.description}</p>
            </button>
          ))}
        </div>
        <p className="text-xs text-text-muted mt-3">
          Ctrl+1 ~ Ctrl+5 to quickly switch themes.
        </p>
      </section>

      {/* General */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-text-primary mb-4">General</h2>
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">Font Size</p>
              <p className="text-xs text-text-muted">Adjust interface text size.</p>
            </div>
            <select
              value={fontSize}
              onChange={(e) => setFontSize(e.target.value as 'small' | 'medium' | 'large')}
              className="px-3 py-1.5 rounded-lg border border-border-color bg-bg-secondary text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-soft"
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">Page Transition</p>
              <p className="text-xs text-text-muted">Adjust page fade movement.</p>
            </div>
            <select
              value={uiMotionDuration}
              onChange={(e) => setUiMotionDuration(e.target.value as UiMotionDuration)}
              className="px-3 py-1.5 rounded-lg border border-border-color bg-bg-secondary text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-soft"
            >
              {UI_MOTION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </Card>
      </section>

      {/* LLM Configuration */}
      <section>
        <h2 className="text-lg font-semibold text-text-primary mb-4">LLM Configuration</h2>

        <Card className="space-y-6">
          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">Enable AI Features</p>
              <p className="text-xs text-text-muted">Turn on translation and writing refinement.</p>
            </div>
            <button
              onClick={() => setEnabled(!config.enabled)}
              className={clsx(
                'relative w-11 h-6 rounded-full transition-colors',
                config.enabled ? 'bg-accent' : 'bg-bg-tertiary'
              )}
            >
              <div
                className={clsx(
                  'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                  config.enabled ? 'translate-x-5' : 'translate-x-0.5'
                )}
              />
            </button>
          </div>

          {/* Provider selector */}
          <div>
            <label className="text-sm font-medium text-text-secondary mb-2 block">Provider</label>
            <div className="flex gap-1 bg-bg-secondary rounded-xl p-1">
              {AI_PROVIDERS.map((id) => (
                <button
                  key={id}
                  onClick={() => setProvider(id)}
                  className={clsx(
                    'flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                    config.provider === id
                      ? 'bg-bg-primary text-accent shadow-sm'
                      : 'text-text-muted hover:text-text-primary'
                  )}
                >
                  {getProviderName(id)}
                </button>
              ))}
            </div>
          </div>

          {/* Selected provider config */}
          {AI_PROVIDERS.map((id) => (
            <div
              key={id}
              className={clsx('space-y-3', config.provider !== id && 'hidden')}
            >
              <Input
                label="API Key"
                type="password"
                placeholder={id === 'local' ? 'Optional for local APIs...' : 'sk-...'}
                value={config[id].apiKey}
                onChange={(e) => setProviderConfig(id, 'apiKey', e.target.value)}
              />
              <Input
                label="Model"
                placeholder="e.g. gpt-4o, claude-sonnet-4-6"
                value={config[id].model}
                onChange={(e) => setProviderConfig(id, 'model', e.target.value)}
              />
              <Input
                label="Base URL"
                placeholder={id === 'local' ? 'http://127.0.0.1:1234/v1 or /api/v1' : 'https://api.openai.com/v1'}
                value={config[id].baseUrl}
                onChange={(e) => setProviderConfig(id, 'baseUrl', e.target.value)}
              />
            </div>
          ))}
        </Card>

        <p className="text-xs text-text-muted mt-3">
          Your API keys are stored locally in SQLite and never sent anywhere except to the configured API endpoint.
          For LM Studio, use either OpenAI-compatible <span className="font-mono">http://127.0.0.1:1234/v1</span> or native <span className="font-mono">http://127.0.0.1:1234/api/v1</span>.
        </p>
      </section>
    </div>
  )
}
