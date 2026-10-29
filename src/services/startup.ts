/** Local Performance entries only; never records SQL, user content or credentials. */
export async function measureStartup<T>(name: string, action: () => Promise<T>): Promise<T> {
  const start = performance.now()
  try {
    return await action()
  } finally {
    performance.measure(`startup:${name}`, { start, end: performance.now() })
  }
}

export function markStartup(name: string) {
  if (!performance.getEntriesByName(`startup:${name}`).length) performance.mark(`startup:${name}`)
  if (typeof document !== 'undefined' && name !== 'splash-dismissed'
    && performance.getEntriesByName('startup:shell-mounted').length
    && performance.getEntriesByName('startup:theme-ready').length) dismissStartupScreen()
}

let dismissing = false
function dismissStartupScreen() {
  const splash = document.getElementById('startup-screen')
  if (!splash || dismissing) return
  dismissing = true
  // Allow the selected theme and the mounted shell to paint before revealing it.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.dispatchEvent(new Event('oshinote:startup-ready'))
    splash.classList.add('startup-finished')
    splash.setAttribute('aria-busy', 'false')
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 160
    window.setTimeout(() => { splash.remove(); markStartup('splash-dismissed') }, delay)
  }))
}

export function readStartupTheme(): string {
  try {
    const saved = localStorage.getItem('oshinote:startup-theme')
    if (saved && ['warm-paper', 'pink-cozy', 'dark-night', 'soft-blue', 'sakura', 'rainy-cafe'].includes(saved)) return saved
  } catch { /* Storage may be unavailable; the database remains authoritative. */ }
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark-night' : 'warm-paper'
}

export function rememberStartupTheme(theme: string) {
  try { localStorage.setItem('oshinote:startup-theme', theme) } catch { /* Optional paint cache only. */ }
}
