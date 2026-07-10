import { useEffect } from 'react'

export function useWindowEvent<K extends keyof WindowEventMap>(
  type: K,
  listener: (event: WindowEventMap[K]) => void,
  options?: AddEventListenerOptions
): void {
  useEffect(() => {
    window.addEventListener(type, listener as EventListener, options)
    return () => window.removeEventListener(type, listener as EventListener, options)
  }, [listener, options, type])
}

export function useDocumentEvent<K extends keyof DocumentEventMap>(
  type: K,
  listener: (event: DocumentEventMap[K]) => void,
  options?: AddEventListenerOptions
): void {
  useEffect(() => {
    document.addEventListener(type, listener as EventListener, options)
    return () => document.removeEventListener(type, listener as EventListener, options)
  }, [listener, options, type])
}
