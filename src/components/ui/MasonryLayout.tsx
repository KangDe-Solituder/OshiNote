import { Children, useLayoutEffect, useRef, type ReactNode } from 'react'
import clsx from 'clsx'
import { calculateMasonryLayout } from './masonryLayoutGeometry'

interface MasonryLayoutProps {
  children: ReactNode
  className?: string
}

export function MasonryLayout({ children, className }: MasonryLayoutProps) {
  const items = Children.toArray(children)
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLDivElement | null>>([])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    let animationFrame = 0

    const layout = () => {
      animationFrame = 0
      const nodes = itemRefs.current.slice(0, items.length).filter((node): node is HTMLDivElement => Boolean(node))
      if (nodes.length === 0) {
        container.style.height = '0px'
        return
      }

      const computed = getComputedStyle(container)
      const tracks = computed.gridTemplateColumns.trim()
      const columnCount = tracks && tracks !== 'none' ? tracks.split(/\s+/).length : 1
      const gap = Number.parseFloat(computed.columnGap) || 0
      const itemWidth = Math.max(0, (container.clientWidth - gap * (columnCount - 1)) / columnCount)

      for (const node of nodes) node.style.width = `${itemWidth}px`
      const measured = calculateMasonryLayout(
        nodes.map((node) => node.getBoundingClientRect().height),
        columnCount,
        itemWidth,
        gap
      )

      nodes.forEach((node, index) => {
        const position = measured.positions[index]
        node.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`
        node.style.visibility = 'visible'
      })

      container.style.height = `${measured.height}px`
    }

    const scheduleLayout = () => {
      if (animationFrame) cancelAnimationFrame(animationFrame)
      animationFrame = requestAnimationFrame(layout)
    }

    layout()
    const observer = new ResizeObserver(scheduleLayout)
    observer.observe(container)
    for (const node of itemRefs.current) {
      if (node) observer.observe(node)
    }

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame)
      observer.disconnect()
    }
  }, [items.length])

  return (
    <div
      ref={containerRef}
      className={clsx(
        'relative grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5',
        className
      )}
    >
      {items.map((child, index) => (
        <div
          key={index}
          ref={(node) => {
            itemRefs.current[index] = node
            if (node && node.dataset.masonryReady !== 'true') {
              node.style.visibility = 'hidden'
              node.dataset.masonryReady = 'true'
            }
          }}
          className="absolute left-0 top-0"
        >
          {child}
        </div>
      ))}
    </div>
  )
}
