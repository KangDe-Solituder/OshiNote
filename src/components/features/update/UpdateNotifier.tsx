import { useEffect, useRef, useState } from 'react'
import { Download, RefreshCw, X } from 'lucide-react'
import clsx from 'clsx'
import { useUpdateStore } from '../../../stores/updateStore'
import {
  checkForUpdate,
  getCurrentAppVersion,
  installPendingUpdate,
  type UpdateInfo,
  type UpdateInstallProgress,
} from '../../../services/update/updateService'

type UpdateStatus = 'idle' | 'checking' | 'available' | 'installing' | 'error' | 'dismissed'

export function UpdateNotifier() {
  const { checkOnStartup, loaded, loadFromDB } = useUpdateStore()
  const [status, setStatus] = useState<UpdateStatus>('idle')
  const [update, setUpdate] = useState<UpdateInfo | null>(null)
  const [currentVersion, setCurrentVersion] = useState('')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState<UpdateInstallProgress | null>(null)
  const hasCheckedRef = useRef(false)

  useEffect(() => {
    loadFromDB()
  }, [loadFromDB])

  useEffect(() => {
    getCurrentAppVersion().then(setCurrentVersion).catch(() => setCurrentVersion(''))
  }, [])

  useEffect(() => {
    if (!loaded || !checkOnStartup || hasCheckedRef.current) return
    hasCheckedRef.current = true

    async function runStartupCheck() {
      setStatus('checking')
      try {
        const availableUpdate = await checkForUpdate()
        if (availableUpdate) {
          setUpdate(availableUpdate)
          setStatus('available')
        } else {
          setStatus('idle')
        }
      } catch (cause) {
        console.warn('Update check failed', cause)
        setStatus('idle')
      }
    }

    runStartupCheck()
  }, [checkOnStartup, loaded])

  if (status === 'idle' || status === 'checking' || status === 'dismissed') {
    return null
  }

  const install = async () => {
    setStatus('installing')
    setError('')
    try {
      await installPendingUpdate(setProgress)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not install the update.')
      setStatus('error')
    }
  }

  return (
    <div className="fixed left-1/2 top-4 z-50 w-[min(560px,calc(100vw-32px))] -translate-x-1/2">
      <div className="rounded-2xl border border-border-color bg-bg-primary/95 p-4 shadow-xl backdrop-blur">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/20 bg-accent/10 text-accent">
            <Download size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  {status === 'error' ? 'Update failed' : 'New version available'}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  {status === 'error'
                    ? error
                    : `OshiNote ${update?.version} is ready. You are currently on ${update?.currentVersion || currentVersion}.`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStatus('dismissed')}
                className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-bg-secondary hover:text-text-primary"
                title="Dismiss"
              >
                <X size={16} />
              </button>
            </div>

            {update?.body && status !== 'error' && (
              <p className="mt-3 max-h-16 overflow-hidden whitespace-pre-line text-xs text-text-secondary">{update.body}</p>
            )}

            {status === 'installing' && (
              <div className="mt-4">
                <div className="h-1.5 overflow-hidden rounded-full bg-bg-tertiary">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${progress?.percent ?? 12}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-text-muted">
                  {progress?.percent ? `Downloading ${progress.percent}%` : 'Downloading update...'}
                </p>
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              {status === 'error' && (
                <button
                  type="button"
                  onClick={install}
                  className="inline-flex items-center gap-2 rounded-lg border border-border-color bg-bg-secondary px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-accent hover:text-accent"
                >
                  <RefreshCw size={14} />
                  Retry
                </button>
              )}
              {status === 'available' && (
                <>
                  <button
                    type="button"
                    onClick={() => setStatus('dismissed')}
                    className="rounded-lg border border-border-color bg-bg-secondary px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary"
                  >
                    Later
                  </button>
                  <button
                    type="button"
                    onClick={install}
                    className={clsx(
                      'inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90'
                    )}
                  >
                    <Download size={14} />
                    Update now
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
