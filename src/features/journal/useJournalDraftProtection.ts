import { useCallback, useEffect, useRef, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { parseEditorDraft, type JournalEditorDocument } from './journalEditorState'
import { readLocalStorage } from '../../utils/safeLocalStorage'

export function useJournalDraftProtection(key: string, document: JournalEditorDocument) {
  const [initial] = useState(document)
  const baseline = JSON.stringify(initial)
  const [recovery, setRecovery] = useState(() => parseEditorDraft(readLocalStorage(key)))
  const [storageFailed, setStorageFailed] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [closing, setClosing] = useState(false)
  const bypass = useRef(false)
  const saving = useRef(false)
  const latest = useRef(document)
  // Choosing the first available person automatically isn't a user edit.
  const dirty = JSON.stringify(initial.oshiId ? document : { ...document, oshiId: initial.oshiId }) !== baseline
  const blocker = useBlocker(() => dirty && !bypass.current)
  const persist = useCallback((value: JournalEditorDocument) => {
    try { localStorage.setItem(key, JSON.stringify({ version: 1, document: value })); return true }
    catch { return false }
  }, [key])
  const clear = useCallback(() => { try { localStorage.removeItem(key) } catch { /* Report failures when writing. */ } }, [key])

  useEffect(() => { latest.current = document }, [document])
  useEffect(() => {
    if (recovery || bypass.current) return
    if (!dirty) { clear(); setSavedAt(null); return }
    const timeout = window.setTimeout(() => {
      const ok = persist(document)
      setStorageFailed(!ok)
      if (ok) setSavedAt(Date.now())
    }, 400)
    return () => window.clearTimeout(timeout)
  }, [document, dirty, recovery, persist, clear])
  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!dirty || bypass.current) return
      if (!recovery) persist(latest.current)
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty, recovery, persist])
  useEffect(() => {
    if (!isTauri()) return
    let disposed = false
    let unlisten: (() => void) | undefined
    void getCurrentWindow().onCloseRequested(event => {
      if (!dirty || bypass.current) return
      event.preventDefault()
      setClosing(true)
    }).then(stop => { if (disposed) stop(); else unlisten = stop }).catch(() => {})
    return () => { disposed = true; unlisten?.() }
  }, [dirty])
  useEffect(() => () => { if (!bypass.current && !recovery && dirty) persist(latest.current) }, [dirty, persist, recovery])

  async function leave(keep: boolean) {
    if (saving.current) return
    if (keep && !persist(latest.current)) { setStorageFailed(true); return }
    bypass.current = true
    if (!keep) clear()
    if (closing) {
      try { await getCurrentWindow().close() } catch { bypass.current = false; setClosing(false) }
    } else if (blocker.state === 'blocked') blocker.proceed()
  }
  return {
    recovery, storageFailed, savedAt, dirty,
    resolveRecovery: () => { setRecovery(null); clear() },
    leaving: blocker.state === 'blocked' || closing,
    cancelLeave: () => { setClosing(false); if (blocker.state === 'blocked') blocker.reset() },
    leave,
    startSave: () => { saving.current = true; persist(latest.current) },
    saveFailed: () => { saving.current = false; bypass.current = false; setStorageFailed(!persist(latest.current)) },
    saveSucceeded: () => { saving.current = false; bypass.current = true; if (blocker.state === 'blocked') blocker.reset(); clear() },
  }
}
