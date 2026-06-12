import { useRef } from 'react'
import { Card } from '../components/ui/Card'
import { useThemeStore } from '../stores/themeStore'
import { useUpdateStore } from '../stores/updateStore'
import type { ThemeId, UiMotionDuration } from '../types'
import { checkForUpdate, getCurrentAppVersion, installPendingUpdate, type UpdateInfo, type UpdateInstallProgress } from '../services/update/updateService'
import { Download, RefreshCw, Sparkles, Trash2, Upload } from 'lucide-react'
import clsx from 'clsx'
import { useEffect, useState } from 'react'
import { LOCALE_OPTIONS } from '../i18n/translations'
import { useI18n } from '../i18n/useI18n'
import { useLanguageStore } from '../stores/languageStore'
import { SelectMenu } from '../components/ui/SelectMenu'

const THEMES: { id: ThemeId }[] = [
  { id: 'pink-cozy' },
  { id: 'dark-night' },
  { id: 'soft-blue' },
  { id: 'sakura' },
  { id: 'rainy-cafe' },
]

const UI_MOTION_OPTIONS: { value: UiMotionDuration }[] = [
  { value: 'off' },
  { value: 'fast' },
  { value: 'normal' },
  { value: 'slow' },
]

export function SettingsPage() {
  const { locale, t } = useI18n()
  const setLocale = useLanguageStore((s) => s.setLocale)
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
      setUpdateError(error instanceof Error ? error.message : t('settings.updateCheckError'))
      setUpdateStatus('error')
    }
  }

  const handleInstallUpdate = async () => {
    setUpdateStatus('installing')
    setUpdateError('')
    try {
      await installPendingUpdate(setUpdateProgress)
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : t('settings.updateInstallError'))
      setUpdateStatus('error')
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-text-primary mb-8">{t('settings.title')}</h1>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-text-primary mb-4">{t('settings.theme')}</h2>
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
              <p className="font-medium text-text-primary">{t(`settings.theme.${theme.id}.label`)}</p>
              <p className="text-sm text-text-muted">{t(`settings.theme.${theme.id}.description`)}</p>
            </button>
          ))}
        </div>
        <p className="text-xs text-text-muted mt-3">
          {t('settings.themeShortcut')}
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-text-primary mb-4">{t('settings.appearance')}</h2>
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
              <span className="block font-medium text-text-primary">{t('settings.glassEffect')}</span>
              <span className="block text-sm text-text-muted">{t('settings.glassEffectDescription')}</span>
            </span>
          </span>
          <ToggleSwitch enabled={glassEnabled} />
        </button>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-text-primary mb-4">{t('settings.background')}</h2>
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">{t('settings.customBackground')}</p>
              <p className="text-xs text-text-muted">{t('settings.customBackgroundDescription')}</p>
            </div>
            <div className="flex items-center gap-2">
              {customBackground && (
                <div className="w-10 h-10 rounded-lg overflow-hidden border border-border-color bg-bg-secondary">
                  <img
                    src={customBackground}
                    alt={t('settings.backgroundPreview')}
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
                {t('common.choose')}
              </button>
              {customBackground && (
                <button
                  onClick={() => {
                    setCustomBackground(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  className="p-1.5 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-50 transition-colors"
                  title={t('settings.removeBackground')}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>

          {customBackground && (
            <>
              <FilterSlider
                label={t('settings.blur')}
                value={backgroundFilters.blur}
                min={0}
                max={20}
                step={1}
                unit="px"
                onChange={(v) => setFilter('blur', v)}
              />
              <FilterSlider
                label={t('settings.brightness')}
                value={backgroundFilters.brightness}
                min={50}
                max={150}
                step={5}
                unit="%"
                onChange={(v) => setFilter('brightness', v)}
              />
              <FilterSlider
                label={t('settings.opacity')}
                value={backgroundFilters.opacity}
                min={20}
                max={100}
                step={5}
                unit="%"
                onChange={(v) => setFilter('opacity', v)}
              />
              <FilterSlider
                label={t('settings.saturation')}
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

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-text-primary mb-4">{t('settings.general')}</h2>
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">{t('settings.language')}</p>
              <p className="text-xs text-text-muted">{t('settings.languageDescription')}</p>
            </div>
            <SelectMenu
              value={locale}
              onChange={(value) => setLocale(value as typeof locale)}
              options={LOCALE_OPTIONS.map((option) => ({ value: option.value, label: option.nativeLabel }))}
              ariaLabel={t('settings.language')}
              menuAlign="right"
              menuClassName="w-[168px]"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">{t('settings.fontSize')}</p>
              <p className="text-xs text-text-muted">{t('settings.fontSizeDescription')}</p>
            </div>
            <SelectMenu
              value={fontSize}
              onChange={(value) => setFontSize(value as 'small' | 'medium' | 'large')}
              options={[
                { value: 'small', label: t('settings.font.small') },
                { value: 'medium', label: t('settings.font.medium') },
                { value: 'large', label: t('settings.font.large') },
              ]}
              ariaLabel={t('settings.fontSize')}
              menuAlign="right"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">{t('settings.animationSpeed')}</p>
              <p className="text-xs text-text-muted">{t('settings.animationSpeedDescription')}</p>
            </div>
            <SelectMenu
              value={uiMotionDuration}
              onChange={(value) => setUiMotionDuration(value as UiMotionDuration)}
              options={UI_MOTION_OPTIONS.map((option) => ({
                value: option.value,
                label: t(`settings.motion.${option.value}`),
              }))}
              ariaLabel={t('settings.animationSpeed')}
              menuAlign="right"
            />
          </div>
        </Card>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-text-primary mb-4">{t('settings.updates')}</h2>
        <Card className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-text-primary">{t('settings.checkOnStartup')}</p>
              <p className="text-xs text-text-muted">{t('settings.checkOnStartupDescription')}</p>
            </div>
            <button
              onClick={() => setCheckOnStartup(!checkOnStartup)}
              className="shrink-0"
              aria-label={t('settings.toggleStartupUpdates')}
            >
              <ToggleSwitch enabled={checkOnStartup} />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-border-color pt-4">
            <div>
              <p className="text-sm font-medium text-text-primary">{t('settings.currentVersion')}</p>
              <p className="text-xs text-text-muted">{appVersion ? t('settings.versionLabel', { version: appVersion }) : t('settings.versionUnavailable')}</p>
            </div>
            <button
              onClick={handleCheckUpdate}
              disabled={updateStatus === 'checking' || updateStatus === 'installing'}
              className="inline-flex items-center gap-2 rounded-lg border border-border-color bg-bg-secondary px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={15} className={clsx(updateStatus === 'checking' && 'animate-spin')} />
              {updateStatus === 'checking' ? t('settings.checking') : t('settings.checkNow')}
            </button>
          </div>

          {updateStatus === 'none' && (
            <p className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3 text-sm text-text-secondary">
              {t('settings.latestVersion')}
            </p>
          )}

          {(updateStatus === 'available' || updateStatus === 'installing') && availableUpdate && (
            <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-text-primary">{t('settings.updateAvailable', { version: availableUpdate.version })}</p>
                  <p className="mt-1 text-xs text-text-muted">{t('settings.currentVersionInline', { version: availableUpdate.currentVersion || appVersion })}</p>
                </div>
                <button
                  onClick={handleInstallUpdate}
                  disabled={updateStatus === 'installing'}
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download size={15} />
                  {updateStatus === 'installing' ? t('settings.installing') : t('settings.update')}
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
                    {updateProgress?.percent ? t('settings.downloadingProgress', { percent: updateProgress.percent }) : t('settings.downloading')}
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
