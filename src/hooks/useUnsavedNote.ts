import { useEffect, useRef, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { registerWindowCloseGuard } from '../services/windowClose'

// Manual saving only: no timer and no draft persistence.
export function useUnsavedNote(dirty: boolean, saving: boolean) {
  const [closing, setClosing] = useState(false)
  const bypass = useRef(false)
  const blocker = useBlocker(() => (dirty || saving) && !bypass.current)
  useEffect(() => { if (dirty) bypass.current = false }, [dirty])
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if ((!dirty && !saving) || bypass.current) return
      event.preventDefault(); event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    const stop = registerWindowCloseGuard(() => {
      if ((!dirty && !saving) || bypass.current) return false
      setClosing(true)
      return true
    })
    return () => { stop(); window.removeEventListener('beforeunload', handler) }
  }, [dirty, saving])
  return {
    leaving: closing || blocker.state === 'blocked',
    allow: () => { bypass.current = true },
    cancel: () => { setClosing(false); if (blocker.state === 'blocked') blocker.reset() },
    discard: async () => {
      if (saving) return
      bypass.current = true
      if (closing) await getCurrentWindow().close()
      else if (blocker.state === 'blocked') blocker.proceed()
    },
  }
}
