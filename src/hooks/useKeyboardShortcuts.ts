import { useEffect } from 'react'
import { useThemeStore } from '../stores/themeStore'

export function useKeyboardShortcuts() {
  const themeHotkeys = useThemeStore((s) => s.themeHotkeys)
  const setTheme = useThemeStore((s) => s.setTheme)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return

      const key = e.key.toLowerCase()
      const combo = `ctrl+${key}`
      const targetTheme = themeHotkeys[combo]
      if (targetTheme) {
        e.preventDefault()
        setTheme(targetTheme)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [themeHotkeys, setTheme])
}
