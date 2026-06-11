import { useRef } from 'react'
import { Card } from '../components/ui/Card'
import { useThemeStore } from '../stores/themeStore'
import { useUpdateStore } from '../stores/updateStore'
import type { ThemeId, UiMotionDuration } from '../types'
import { checkForUpdate, getCurrentAppVersion, installPendingUpdate, type UpdateInfo, type UpdateInstallProgress } from '../services/update/updateService'
import { Download, RefreshCw, Sparkles, Trash2, Upload } from 'lucide-react'
import clsx from 'clsx'
import { useEffect, useState } from 'react'

const THEMES: { id: ThemeId; label: string; description: string }[] = [
  { id: 'pink-cozy', label: 'Pink Cozy', description: 'Warm and sweet' },
  { id: 'dark-night', label: 'Dark Night', description: 'Calm and deep' },
  { id: 'soft-blue', label: 'Soft Blue', description: 'Gentle and airy' },
  { id: 'sakura', label: 'Sakura', description: 'Romantic and soft' },
  { id: 'rainy-cafe', label: 'Rainy Cafe', description: 'Moody and cozy' },
]

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
  const { checkOnStartup, setCheckOnStartup, loadFromDB: loadUpdateSettings } = useUpdateStore()
  const [appVersion, setAppVersion] = useState('')
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'none' | 'installing' | 'error'>('idle')
  const [availableUpdate, setAvailableUpdate] = useState<UpdateInfo | null>(null)
  const [updateError, setUpdateError] = useState('')
  const [updateProgress, setUpdateProgress] = useState<UpdateInstallProgress | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadUpdateSettings()
    getCurrentAppVersion().then(setAppVersion).catch(() => setAppVersion(''))
  }, [loadUpdateSettings])

  const handleCheckUpdate = async () => {
    setUpdateStatus('checking')
    setUpdateError('')
    setAvailableUpdate(null)
    try {
      const update = await checkForUpdate()
      if (update) {
        setAvailableUpdate(update)
        setUpdateStatus('available')
      } else {
        setUpdateStatus('none')
      }
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : 'Could not check for updates.')
      setUpdateStatus('error')
    }
  }

  const handleInstallUpdate = async () => {
    setUpdateStatus('installing')
    setUpdateError('')
    try {
      await installPendingUpdate(setUpdateProgress)
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : 'Could not install the update.')
      setUpdateStatus('error')
    }
  }

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
                'p-4 rounded-xl border text-left transition-all',
                currentTheme === theme.id
                  ? 'border-accent bg-accent/5 ring-1 ring-accent/45'
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
          <ToggleSwitch enabled={glassEnabled} />
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

      {/* Updates */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Updates</h2>
        <Card className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-text-primary">Check on Startup</p>
              <p className="text-xs text-text-muted">Look for a new version when OshiNote opens. Updates install only after you confirm.</p>
            </div>
            <button
              onClick={() => setCheckOnStartup(!checkOnStartup)}
              className="shrink-0"
              aria-label="Toggle startup update checks"
            >
              <ToggleSwitch enabled={checkOnStartup} />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-border-color pt-4">
            <div>
              <p className="text-sm font-medium text-text-primary">Current Version</p>
              <p className="text-xs text-text-muted">{appVersion ? `OshiNote ${appVersion}` : 'Version unavailable in web preview.'}</p>
            </div>
            <button
              onClick={handleCheckUpdate}
              disabled={updateStatus === 'checking' || updateStatus === 'installing'}
              className="inline-flex items-center gap-2 rounded-lg border border-border-color bg-bg-secondary px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={15} className={clsx(updateStatus === 'checking' && 'animate-spin')} />
              {updateStatus === 'checking' ? 'Checking...' : 'Check Now'}
            </button>
          </div>

          {updateStatus === 'none' && (
            <p className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3 text-sm text-text-secondary">
              You are using the latest version.
            </p>
          )}

          {(updateStatus === 'available' || updateStatus === 'installing') && availableUpdate && (
            <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-text-primary">OshiNote {availableUpdate.version} is available</p>
                  <p className="mt-1 text-xs text-text-muted">Current version: {availableUpdate.currentVersion || appVersion}</p>
                </div>
                <button
                  onClick={handleInstallUpdate}
                  disabled={updateStatus === 'installing'}
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download size={15} />
                  {updateStatus === 'installing' ? 'Installing...' : 'Update'}
                </button>
              </div>
              {availableUpdate.body && (
                <p className="mt-3 max-h-20 overflow-hidden whitespace-pre-line text-xs text-text-secondary">{availableUpdate.body}</p>
              )}
              {updateStatus === 'installing' && (
                <div className="mt-4">
                  <div className="h-1.5 overflow-hidden rounded-full bg-bg-tertiary">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{ width: `${updateProgress?.percent ?? 12}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-text-muted">
                    {updateProgress?.percent ? `Downloading ${updateProgress.percent}%` : 'Downloading update...'}
                  </p>
                </div>
              )}
            </div>
          )}

          {updateStatus === 'error' && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {updateError}
            </p>
          )}
        </Card>
      </section>

      {/* LLM configuration is intentionally hidden for the first release. */}
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

function ToggleSwitch({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={clsx(
        'relative block h-[24px] w-[44px] rounded-full transition-colors',
        enabled ? 'bg-accent' : 'bg-bg-tertiary'
      )}
    >
      <span
        className={clsx(
          'absolute left-[2px] top-[2px] h-[20px] w-[20px] rounded-full bg-white shadow transition-transform',
          enabled && 'translate-x-[20px]'
        )}
      />
    </span>
  )
}
