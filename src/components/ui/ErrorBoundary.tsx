import { Component, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Home, RotateCcw } from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: string | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error.message }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[OshiNote] UI crash captured by ErrorBoundary:', error, info.componentStack)
  }

  reset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <ErrorFallback error={this.state.error} onReset={this.reset} />
    }
    return this.props.children
  }
}

function ErrorFallback({ error, onReset }: { error: string | null; onReset: () => void }) {
  const { t } = useI18n()
  const navigate = useNavigate()

  return (
    <div className="flex h-full min-h-0 flex-1 items-center justify-center p-8">
      <div className="w-full max-w-sm rounded-2xl border border-border-color bg-bg-card p-8 text-center shadow-e2">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
          <AlertTriangle size={24} />
        </span>
        <h2 className="text-base font-semibold text-text-primary">{t('errorBoundary.title')}</h2>
        <p className="mt-1.5 text-sm text-text-muted">{t('errorBoundary.description')}</p>
        {error && (
          <p className="mt-3 max-h-24 overflow-y-auto rounded-lg bg-bg-secondary/60 px-3 py-2 text-left text-xs text-text-muted">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-center gap-2">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            <RotateCcw size={15} />
            {t('common.retry')}
          </button>
          <button
            type="button"
            onClick={() => {
              onReset()
              navigate('/')
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-border-color bg-bg-secondary px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-bg-tertiary"
          >
            <Home size={15} />
            {t('errorBoundary.goHome')}
          </button>
        </div>
      </div>
    </div>
  )
}
