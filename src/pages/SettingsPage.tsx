import { useRef } from 'react'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { useThemeStore } from '../stores/themeStore'
import { useAiStore } from '../stores/aiStore'
import type { ThemeId, UiMotionDuration } from '../types'
import type { AiProviderId } from '../services/ai'
import { getProviderName } from '../services/ai'
import { Sparkles, Trash2, Upload } from 'lucide-react'
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
  const {
    currentTheme, setTheme,
    glassEnabled, setGlassEnabled,
    customBackground, setCustomBackground,
    backgroundFilters, setFilter,
    fontSize, setFontSize,
    uiMotionDuration, setUiMotionDuration,
  } = useThemeStore()
  const { config, setProvider, setEnabled, setProviderConfig } = useAiStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

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

      {/* Appearance */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Appearance</h2>
        <button
          onClick={() => setGlassEnabled(!glassEnabled)}
          className={clsx(
            'w-full rounded-2xl border p-5 text-left transition-all flex items-center justify-between gap-4',
            glassEnabled
              ? 'border-accent bg-accent/5 text-accent'
              : 'border-border-color bg-bg-secondary text-text-secondary hover:border-border-hover hover:text-accent'
          )}
        >
          <span className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border-color bg-bg-primary">
              <Sparkles size={22} />
            </span>
            <span>
              <span className="block font-medium text-text-primary">Glass Effect</span>
              <span className="block text-sm text-text-muted">Apply frosted blur to cards and rounded surfaces.</span>
            </span>
          </span>
          <span
            className={clsx(
              'relative h-7 w-12 shrink-0 rounded-full transition-colors',
              glassEnabled ? 'bg-accent' : 'bg-bg-tertiary'
            )}
          >
            <span
              className={clsx(
                'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform',
                glassEnabled ? 'translate-x-6' : 'translate-x-1'
              )}
            />
          </span>
        </button>
      </section>

      {/* Background */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Background</h2>
        <Card className="space-y-4">
          {/* Background image selector */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">Custom Background</p>
              <p className="text-xs text-text-muted">Upload a wallpaper or fanart image.</p>
            </div>
            <div className="flex items-center gap-2">
              {customBackground && (
                <div className="w-10 h-10 rounded-lg overflow-hidden border border-border-color bg-bg-secondary">
                  <img
                    src={customBackground}
                    alt="Background preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = () => setCustomBackground(String(reader.result))
                  reader.onerror = () => {
                    // Ignore read errors.
                  }
                  reader.readAsDataURL(file)
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg border border-border-color bg-bg-secondary text-text-secondary text-sm hover:text-accent hover:border-accent transition-colors flex items-center gap-1.5"
              >
                <Upload size={14} />
                Choose
              </button>
              {customBackground && (
                <button
                  onClick={() => {
                    setCustomBackground(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  className="p-1.5 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Remove background"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>

          {customBackground && (
            <>
              {/* Blur */}
              <FilterSlider
                label="Blur"
                value={backgroundFilters.blur}
                min={0}
                max={20}
                step={1}
                unit="px"
                onChange={(v) => setFilter('blur', v)}
              />
              {/* Brightness */}
              <FilterSlider
                label="Brightness"
                value={backgroundFilters.brightness}
                min={50}
                max={150}
                step={5}
                unit="%"
                onChange={(v) => setFilter('brightness', v)}
              />
              {/* Opacity */}
              <FilterSlider
                label="Opacity"
                value={backgroundFilters.opacity}
                min={20}
                max={100}
                step={5}
                unit="%"
                onChange={(v) => setFilter('opacity', v)}
              />
              {/* Saturation */}
              <FilterSlider
                label="Saturation"
                value={backgroundFilters.saturation}
                min={0}
                max={200}
                step={5}
                unit="%"
                onChange={(v) => setFilter('saturation', v)}
              />
            </>
          )}
        </Card>
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
              <p className="text-sm font-medium text-text-primary">Animation Speed</p>
              <p className="text-xs text-text-muted">Adjust interface and page transition motion.</p>
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
              <p className="text-sm font-medium text-text-primary">Enable LLM Interface</p>
              <p className="text-xs text-text-muted">Keep provider settings available for future local or private workflows.</p>
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
          These settings are stored locally in SQLite and are not used unless an LLM feature is added or enabled later.
          For LM Studio, use either OpenAI-compatible <span className="font-mono">http://127.0.0.1:1234/v1</span> or native <span className="font-mono">http://127.0.0.1:1234/api/v1</span>.
        </p>
      </section>
    </div>
  )
}

// ── Filter Slider ─────────────────────────────────────────────────────

function FilterSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="w-24 shrink-0">
        <p className="text-sm font-medium text-text-primary">{label}</p>
      </div>
      <div className="flex-1 flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 h-1.5 rounded-full appearance-none bg-bg-tertiary cursor-pointer accent-accent"
        />
        <span className="text-xs text-text-muted w-12 text-right tabular-nums">
          {value}{unit}
        </span>
      </div>
    </div>
  )
}
