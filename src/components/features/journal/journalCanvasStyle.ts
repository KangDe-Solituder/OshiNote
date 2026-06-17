import type { CSSProperties } from 'react'

export function getPageBackground(background: string): CSSProperties {
  const dotLayer = 'radial-gradient(var(--journal-canvas-dot) 1px, transparent 1px)'
  if (background === 'grid') {
    return {
      backgroundColor: 'var(--journal-canvas-bg)',
      backgroundImage: 'linear-gradient(var(--journal-canvas-dot) 1px, transparent 1px), linear-gradient(90deg, var(--journal-canvas-dot) 1px, transparent 1px)',
      backgroundSize: '24px 24px',
    }
  }
  if (background === 'blush') {
    return {
      backgroundColor: 'color-mix(in srgb, var(--color-bg-primary) 82%, var(--color-accent-soft))',
      backgroundImage: dotLayer,
      backgroundSize: '18px 18px',
    }
  }
  if (background === 'blue') {
    return {
      backgroundColor: 'color-mix(in srgb, var(--color-bg-primary) 76%, var(--color-bg-secondary))',
      backgroundImage: dotLayer,
      backgroundSize: '18px 18px',
    }
  }
  if (background === 'mint') {
    return {
      backgroundColor: 'color-mix(in srgb, var(--color-bg-primary) 82%, var(--color-text-secondary))',
      backgroundImage: dotLayer,
      backgroundSize: '18px 18px',
    }
  }
  if (background === 'postcard') {
    return {
      backgroundColor: 'var(--journal-canvas-bg)',
      backgroundImage: 'linear-gradient(90deg, color-mix(in srgb, var(--color-accent) 34%, transparent) 0 8px, transparent 8px), radial-gradient(var(--journal-canvas-dot) 1px, transparent 1px)',
      backgroundSize: '44px 100%, 18px 18px',
    }
  }
  return {
    backgroundColor: 'var(--journal-canvas-bg)',
    backgroundImage: dotLayer,
    backgroundSize: '18px 18px',
  }
}
