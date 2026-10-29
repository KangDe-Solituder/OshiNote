import { Check } from 'lucide-react'
import { Button } from '../components/ui/Button'


export function ConflictChoice({ label, preview, selected, action, onClick, disabled }: {
  label: string
  preview: string
  selected: boolean
  action: string
  onClick: () => void
  disabled: boolean
}) {
  return (
    <div className={`rounded-lg border p-3 ${selected ? 'border-accent bg-accent-soft' : 'border-border-color bg-bg-card'}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
      <p className="my-3 line-clamp-3 text-sm text-text-secondary">{preview}</p>
      <Button variant={selected ? 'primary' : 'secondary'} size="sm" onClick={onClick} disabled={disabled}>
        {selected && <Check size={13} />}{action}
      </Button>
    </div>
  )
}

