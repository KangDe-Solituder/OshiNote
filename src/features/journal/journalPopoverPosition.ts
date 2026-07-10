export interface PopoverAnchor {
  clientX: number
  clientY: number
}

export interface PopoverRect {
  left: number
  top: number
  width: number
  height: number
}

export interface ViewportSize {
  width: number
  height: number
}

export interface PopoverPositionOptions {
  popoverWidth: number
  popoverHeight: number
  viewport: ViewportSize
  padding?: number
  gap?: number
  yOffset?: number
}

export function getAnchoredPopoverPosition(anchor: PopoverAnchor, options: PopoverPositionOptions) {
  const padding = options.padding ?? 16
  const gap = options.gap ?? 12
  const yOffset = options.yOffset ?? 24
  const maxLeft = options.viewport.width - options.popoverWidth - padding
  const maxTop = options.viewport.height - options.popoverHeight - padding
  const rightSpace = options.viewport.width - anchor.clientX
  const leftSpace = anchor.clientX
  const preferRight = rightSpace >= leftSpace
  const preferredLeft = preferRight
    ? anchor.clientX + gap
    : anchor.clientX - options.popoverWidth - gap

  return {
    left: clamp(preferredLeft, padding, maxLeft),
    top: clamp(anchor.clientY - yOffset, padding, maxTop),
  }
}

export function getElementAnchoredPopoverPosition(rect: PopoverRect, options: PopoverPositionOptions) {
  const padding = options.padding ?? 16
  const gap = options.gap ?? 12
  const maxLeft = options.viewport.width - options.popoverWidth - padding
  const maxTop = options.viewport.height - options.popoverHeight - padding
  const rightLeft = rect.left + rect.width + gap
  const leftLeft = rect.left - options.popoverWidth - gap
  const left = rightLeft + options.popoverWidth <= options.viewport.width - padding
    ? rightLeft
    : leftLeft >= padding
      ? leftLeft
      : rect.left
  const centeredTop = rect.top + rect.height / 2 - options.popoverHeight / 2

  return {
    left: clamp(left, padding, maxLeft),
    top: clamp(centeredTop, padding, maxTop),
  }
}

function clamp(value: number, min: number, max: number) {
  if (max < min) return min
  return Math.max(min, Math.min(value, max))
}
