import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate, useParams } from 'react-router-dom'
import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { ArrowLeft, ArrowRight, BookOpen, Copy, Layers3, Minus, Square, X } from 'lucide-react'
import clsx from 'clsx'
import { useI18n } from '../../i18n/useI18n'
import { useOshiStore } from '../../stores/oshiStore'
import appIconUrl from '../../assets/app-icon.svg'

export function TopBar() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const { oshiId = '' } = useParams<{ oshiId: string }>()
  const oshis = useOshiStore((state) => state.oshis)
  const currentOshi = oshis.find((oshi) => oshi.id === oshiId)
  const title = getTitle(location.pathname, t, currentOshi?.name)

  return (
    <header className="flex h-10 shrink-0 items-center gap-2 border-b bg-bg-primary/80 px-2 backdrop-blur-md [border-color:var(--color-shell-border)]">
      <DragRegion className="flex min-w-[176px] items-center gap-2 pl-0.5" title={t('window.drag')}>
        <img src={appIconUrl} alt="" className="h-5 w-5 shrink-0 rounded-md" />
        <span className="truncate text-sm font-semibold text-text-primary">OshiNote</span>
      </DragRegion>

      <div className="flex items-center gap-1">
        <TopBarButton onClick={() => navigate(-1)} label={t('topbar.back')}>
          <ArrowLeft size={17} />
        </TopBarButton>
        <TopBarButton onClick={() => navigate(1)} label={t('topbar.forward')}>
          <ArrowRight size={17} />
        </TopBarButton>
      </div>

      <DragRegion className="flex h-full min-w-0 max-w-[280px] shrink items-center px-1 sm:max-w-[360px]" title={t('window.drag')}>
        <p data-tauri-drag-region="" className="truncate text-sm font-semibold text-text-primary">{title}</p>
      </DragRegion>

      <DragRegion className="h-full min-w-6 flex-1" title={t('window.drag')} />

      <nav className="hidden items-center gap-0.5 rounded-lg bg-bg-secondary/30 p-0.5 md:flex">
        <TopModuleLink to="/journal" label={t('nav.journal')} icon={BookOpen} active={location.pathname.startsWith('/journal')} />
        <TopModuleLink
          to="/resources"
          label={t('nav.resources')}
          icon={Layers3}
          active={isResourcePath(location.pathname)}
        />
      </nav>

      <WindowControls
        minimizeLabel={t('window.minimize')}
        maximizeLabel={t('window.maximize')}
        restoreLabel={t('window.restore')}
        closeLabel={t('window.close')}
      />
    </header>
  )
}

function DragRegion({ className, title, children }: { className: string; title: string; children?: ReactNode }) {
  return (
    <div className={className} title={title} data-tauri-drag-region="">
      {children}
    </div>
  )
}

function TopBarButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-bg-secondary/50 hover:text-text-primary"
      title={label}
      aria-label={label}
    >
      {children}
    </button>
  )
}

function WindowControls({
  minimizeLabel,
  maximizeLabel,
  restoreLabel,
  closeLabel,
}: {
  minimizeLabel: string
  maximizeLabel: string
  restoreLabel: string
  closeLabel: string
}) {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    if (!isTauri()) return
    let unlisten: (() => void) | undefined
    let mounted = true

    async function updateMaximized() {
      try {
        const maximized = await getCurrentWindow().isMaximized()
        if (mounted) setIsMaximized(maximized)
      } catch {
        // Browser preview does not expose Tauri window state.
      }
    }

    updateMaximized()
    getCurrentWindow().onResized(updateMaximized).then((fn) => {
      unlisten = fn
    }).catch(() => {
      // Browser preview does not expose Tauri window events.
    })

    return () => {
      mounted = false
      unlisten?.()
    }
  }, [])

  async function toggleMaximize() {
    await handleWindowAction('toggleMaximize')
    try {
      setIsMaximized(await getCurrentWindow().isMaximized())
    } catch {
      // Browser preview does not expose Tauri window state.
    }
  }

  const MaximizeIcon = isMaximized ? Copy : Square

  return (
    <div className="ml-1 flex h-full shrink-0 items-center">
      <WindowControlButton label={minimizeLabel} onClick={() => handleWindowAction('minimize')}>
        <Minus size={15} />
      </WindowControlButton>
      <WindowControlButton label={isMaximized ? restoreLabel : maximizeLabel} onClick={toggleMaximize}>
        <MaximizeIcon size={isMaximized ? 14 : 13} />
      </WindowControlButton>
      <WindowControlButton label={closeLabel} danger onClick={() => handleWindowAction('close')}>
        <X size={15} />
      </WindowControlButton>
    </div>
  )
}

function WindowControlButton({ label, danger, onClick, children }: { label: string; danger?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={clsx(
        'flex h-10 w-11 items-center justify-center text-text-muted transition-colors hover:text-text-primary',
        danger ? 'hover:bg-red-500/80 hover:text-white' : 'hover:bg-bg-secondary/50'
      )}
    >
      {children}
    </button>
  )
}

async function handleWindowAction(action: 'minimize' | 'toggleMaximize' | 'close') {
  if (!isTauri()) return
  try {
    const win = getCurrentWindow()
    if (action === 'minimize') await win.minimize()
    if (action === 'toggleMaximize') await win.toggleMaximize()
    if (action === 'close') await win.close()
  } catch {
    // Browser preview does not expose Tauri window controls.
  }
}

function TopModuleLink({ to, label, icon: Icon, active }: { to: string; label: string; icon: typeof BookOpen; active: boolean }) {
  return (
    <NavLink to={to} className={topBarTabClass(active)}>
      <Icon size={15} />
      <span>{label}</span>
    </NavLink>
  )
}

function topBarTabClass(active: boolean): string {
  return clsx(
    'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium transition-colors',
    active ? 'bg-bg-primary/70 text-accent shadow-sm shadow-black/5' : 'text-text-secondary hover:bg-bg-primary/30 hover:text-text-primary'
  )
}

function getTitle(pathname: string, t: ReturnType<typeof useI18n>['t'], oshiName?: string): string {
  if (oshiName) return oshiName
  if (pathname === '/') return t('nav.home')
  if (pathname.startsWith('/journal')) return pathname.includes('/create') ? t('nav.journalCreate') : t('nav.journal')
  if (pathname.startsWith('/resources/templates')) return t('nav.templates')
  if (pathname.startsWith('/resources/materials')) return t('nav.materials')
  if (pathname.startsWith('/resources')) return t('nav.resources')
  if (pathname.startsWith('/notes')) return t('nav.allNotes')
  if (pathname.startsWith('/illustrations')) return t('nav.illustrations')
  if (pathname.startsWith('/tags')) return t('nav.tags')
  if (pathname.startsWith('/export')) return t('nav.export')
  if (pathname.startsWith('/settings')) return t('nav.settings')
  if (pathname.startsWith('/oshis')) return t('nav.myOshis')
  return 'OshiNote'
}

function isResourcePath(pathname: string): boolean {
  return pathname.startsWith('/resources') ||
    pathname.startsWith('/notes') ||
    pathname.startsWith('/illustrations') ||
    pathname.startsWith('/tags')
}
