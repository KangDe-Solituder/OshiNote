import { useState } from 'react'
import { inspectResourceCleanup, cleanResourceFiles, type CleanupCandidate } from '../../features/resources/resourceCleanup'
import { useResourceActions } from '../../features/resources/resourceActionsText'
import { Button } from '../ui/Button'
import { AnimatedCollapse } from '../ui/AnimatedCollapse'
export function ResourceCleanupPanel() {
  const text = useResourceActions()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<CleanupCandidate[] | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function scan() {
    setBusy(true); setError(''); setConfirm(false)
    try { setItems(await inspectResourceCleanup()); setSelected([]) } catch(e) { setError(String(e)) } finally { setBusy(false) }
  }
  async function clean() {
    setBusy(true); setError('')
    try { await cleanResourceFiles((items || []).filter(item => selected.includes(item.path))); await scan() } catch(e) { setError(String(e)) } finally { setBusy(false) }
  }
  return <div className="my-4">
    <Button variant="ghost" size="sm" aria-expanded={open} onClick={() => setOpen(!open)}>{text.cleanup}</Button>
    <AnimatedCollapse open={open}><section className="mt-2 rounded-xl border border-border-color bg-bg-card p-4">
      <p className="mb-3 text-sm text-text-secondary">{text.cleanupHint}</p>
      <Button variant="secondary" size="sm" disabled={busy} onClick={() => void scan()}>{text.inspect}</Button>
      {items && !items.length && <p className="mt-3 text-sm text-text-muted">{text.noFiles}</p>}
      {items?.map(item => <label key={item.path} className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" disabled={busy} checked={selected.includes(item.path)} onChange={e => { setConfirm(false); setSelected(e.target.checked ? [...selected,item.path] : selected.filter(path => path !== item.path)) }} /><span className="break-all">{item.path.split('/').pop()}</span><span className="ml-auto shrink-0 text-text-muted">{(item.size/1024).toFixed(1)} KB</span></label>)}
      {!!selected.length && <div className="mt-4 flex flex-wrap items-center gap-3">{confirm && <p className="text-sm">{text.confirmClean}</p>}<Button variant="danger" size="sm" disabled={busy} onClick={() => confirm ? void clean() : setConfirm(true)}>{text.clean} ({selected.length})</Button>{confirm && <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>{text.cancel}</Button>}</div>}
      {error && <p role="alert" className="mt-2 text-sm text-red-400">{error}</p>}
    </section></AnimatedCollapse>
  </div>
}
