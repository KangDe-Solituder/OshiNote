import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Oshi } from '../../types'

interface OshiModuleHeaderProps {
  oshiId: string
  title: string
  subtitle?: string
  icon?: LucideIcon
  oshi?: Oshi | null
  actions?: React.ReactNode
}

export function OshiModuleHeader({
  oshiId,
  title,
  subtitle,
  icon: Icon,
  oshi,
  actions,
}: OshiModuleHeaderProps) {
  return (
    <header className="flex h-20 shrink-0 items-center gap-4 border-b border-border-color bg-bg-primary/95 px-6 lg:px-10">
      <Link
        to={`/oshis/${oshiId}`}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-text-muted transition-colors hover:bg-bg-secondary hover:text-text-primary"
        title="Back to overview"
      >
        <ArrowLeft size={22} />
      </Link>

      {oshi ? (
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white shadow-md"
          style={{ backgroundColor: oshi.color || '#EC4899' }}
        >
          {oshi.avatar ? <img src={oshi.avatar} alt="" className="h-full w-full object-cover" /> : oshi.name.charAt(0).toUpperCase()}
        </div>
      ) : Icon ? (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-soft/25 text-accent">
          <Icon size={23} />
        </span>
      ) : null}

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-2xl font-bold text-text-primary">{title}</h1>
        {subtitle && <p className="mt-0.5 truncate text-sm text-text-secondary">{subtitle}</p>}
      </div>

      {actions && <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}
