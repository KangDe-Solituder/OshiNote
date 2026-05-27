import { useEffect, type ReactNode } from 'react'
import { useThemeStore } from '../../../stores/themeStore'
import { useAiStore } from '../../../stores/aiStore'
import { useKeyboardShortcuts } from '../../../hooks/useKeyboardShortcuts'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const currentTheme = useThemeStore((s) => s.currentTheme)
  const customBackground = useThemeStore((s) => s.customBackground)
  const backgroundFilters = useThemeStore((s) => s.backgroundFilters)
  const loadTheme = useThemeStore((s) => s.loadFromDB)
  const loadAi = useAiStore((s) => s.loadFromDB)

  useKeyboardShortcuts()

  useEffect(() => {
    loadTheme()
    loadAi()
  }, [loadTheme, loadAi])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme)
  }, [currentTheme])

  useEffect(() => {
    const styleId = 'custom-bg-style'
    let style = document.getElementById(styleId)
    if (customBackground) {
      if (!style) {
        style = document.createElement('style')
        style.id = styleId
        document.head.appendChild(style)
      }
      style.textContent = `
        body::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image: url('${customBackground}');
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          filter: blur(${backgroundFilters.blur}px)
                  brightness(${backgroundFilters.brightness}%)
                  saturate(${backgroundFilters.saturation}%);
          opacity: ${backgroundFilters.opacity / 100};
          z-index: -1;
          pointer-events: none;
        }
      `
    } else {
      style?.remove()
    }
  }, [customBackground, backgroundFilters])

  return <>{children}</>
}
