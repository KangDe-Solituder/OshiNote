import { useEffect, useState } from 'react'

type PageLoadingLayout = 'cards' | 'detail' | 'editor' | 'rows'

interface PageLoadingStateProps {
  label: string
  layout?: PageLoadingLayout
  className?: string
  delay?: number
}

export function PageLoadingState({
  label,
  layout = 'cards',
  className = '',
  delay = 140,
}: PageLoadingStateProps) {
  const [visible, setVisible] = useState(delay === 0)

  useEffect(() => {
    if (delay === 0) return
    const timeout = window.setTimeout(() => setVisible(true), delay)
    return () => window.clearTimeout(timeout)
  }, [delay])

  return (
    <div
      role="status"
      aria-label={label}
      aria-busy="true"
      className={`min-h-64 transition-opacity ${visible ? 'opacity-100' : 'opacity-0'} ${className}`}
    >
      <span className="sr-only">{label}</span>
      {layout === 'detail' && <DetailSkeleton />}
      {layout === 'editor' && <EditorSkeleton />}
      {layout === 'rows' && <RowsSkeleton />}
      {layout === 'cards' && <CardsSkeleton />}
    </div>
  )
}

function CardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="rounded-2xl border border-border-color/70 bg-bg-card/70 p-4">
          <div className="page-loading-placeholder h-28 rounded-xl" />
          <div className="page-loading-placeholder mt-4 h-4 w-2/3 rounded-full" />
          <div className="page-loading-placeholder mt-2 h-3 w-5/6 rounded-full opacity-70" />
        </div>
      ))}
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border-color/70 bg-bg-card/70 p-5">
        <div className="flex items-center gap-4">
          <div className="page-loading-placeholder h-16 w-16 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1">
            <div className="page-loading-placeholder h-5 w-48 max-w-[66%] rounded-full" />
            <div className="page-loading-placeholder mt-3 h-3 w-72 max-w-full rounded-full opacity-70" />
          </div>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="page-loading-placeholder h-24 rounded-2xl border border-border-color/60" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="page-loading-placeholder h-72 rounded-2xl border border-border-color/60" />
        <div className="page-loading-placeholder h-72 rounded-2xl border border-border-color/60" />
      </div>
    </div>
  )
}

function EditorSkeleton() {
  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-4 p-6">
      <div className="flex items-center gap-3">
        <div className="page-loading-placeholder h-10 w-10 rounded-xl" />
        <div className="page-loading-placeholder h-6 w-52 rounded-full" />
        <div className="page-loading-placeholder ml-auto h-10 w-24 rounded-xl" />
      </div>
      <div className="page-loading-placeholder h-12 rounded-xl" />
      <div className="page-loading-placeholder min-h-80 flex-1 rounded-2xl" />
    </div>
  )
}

function RowsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="flex items-center gap-4 rounded-xl border border-border-color/60 bg-bg-card/60 p-4">
          <div className="page-loading-placeholder h-11 w-11 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <div className="page-loading-placeholder h-4 w-1/3 rounded-full" />
            <div className="page-loading-placeholder mt-2 h-3 w-2/3 rounded-full opacity-70" />
          </div>
        </div>
      ))}
    </div>
  )
}
