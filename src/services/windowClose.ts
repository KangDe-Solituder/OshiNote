import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'

// One native listener per document. Route changes only replace synchronous guards.
// Register again after a full reload: an old WebView listener can otherwise leave
// the native close request intercepted without a live JavaScript callback.
const guards = new Set<() => boolean>()
let initialization: Promise<void> | undefined

export function registerWindowCloseGuard(guard: () => boolean): () => void {
  guards.add(guard)
  return () => { guards.delete(guard) }
}

export function initializeWindowCloseHandling(): Promise<void> {
  if (!isTauri()) return Promise.resolve()
  if (!initialization) {
    initialization = getCurrentWindow().onCloseRequested(event => {
      for (const guard of guards) {
        if (guard()) { event.preventDefault(); break }
      }
      // onCloseRequested destroys the window when no guard vetoes the request.
    }).then(() => undefined).catch(error => { initialization = undefined; throw error })
  }
  return initialization
}
