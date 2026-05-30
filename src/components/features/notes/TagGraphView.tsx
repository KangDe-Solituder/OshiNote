import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Note } from '../../../types'

interface GraphNode {
  id: string
  label: string
  count: number
  x: number
  y: number
  radius: number
}

interface GraphEdge {
  source: string
  target: string
  weight: number
}

interface TagGraphViewProps {
  notes: Note[]
}

const MIN_RADIUS = 14
const MAX_RADIUS = 40
const ITERATIONS = 80
const REPULSION = 6000
const ATTRACTION = 0.003
const DAMPING = 0.85

export function TagGraphView({ notes }: TagGraphViewProps) {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 })

  // Build graph from notes
  const { nodes, edges } = useMemo(() => {
    // Count tag occurrences
    const tagCounts: Record<string, number> = {}
    // Track co-occurrences
    const coOccurrences: Record<string, Record<string, number>> = {}

    for (const note of notes) {
      const tags = note.tags || []
      for (const tag of tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1
        if (!coOccurrences[tag]) coOccurrences[tag] = {}
        for (const other of tags) {
          if (other === tag) continue
          coOccurrences[tag][other] = (coOccurrences[tag][other] || 0) + 1
        }
      }
    }

    const maxCount = Math.max(...Object.values(tagCounts), 1)

    // Build node list
    const nodeList: GraphNode[] = Object.entries(tagCounts).map(([tag, count]) => {
      const scale = count / maxCount
      return {
        id: tag,
        label: tag,
        count,
        x: 0,
        y: 0,
        radius: MIN_RADIUS + scale * (MAX_RADIUS - MIN_RADIUS),
      }
    })

    // Build edge list (deduplicated)
    const edgeSet = new Set<string>()
    const edgeList: GraphEdge[] = []
    for (const [source, targets] of Object.entries(coOccurrences)) {
      for (const [target, weight] of Object.entries(targets)) {
        const key = [source, target].sort().join('::')
        if (!edgeSet.has(key)) {
          edgeSet.add(key)
          edgeList.push({ source, target, weight })
        }
      }
    }

    return { nodes: nodeList, edges: edgeList }
  }, [notes])

  const layout = useMemo(() => {
    const width = dimensions.width
    const height = dimensions.height

    if (nodes.length === 0) {
      return { nodes: [], edges }
    }

    const centerX = width / 2
    const centerY = height / 2

    const positions = nodes.map((node, i) => {
      const angle = (2 * Math.PI * i) / nodes.length
      const r = Math.min(width, height) * 0.3
      return {
        ...node,
        x: centerX + r * Math.cos(angle),
        y: centerY + r * Math.sin(angle),
      }
    })

    const velocity = positions.map(() => ({ dx: 0, dy: 0 }))

    for (let iter = 0; iter < ITERATIONS; iter++) {
      const cooling = 1 - iter / ITERATIONS

      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const dx = positions[i].x - positions[j].x
          const dy = positions[i].y - positions[j].y
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
          const force = (REPULSION * cooling) / (dist * dist)
          const fx = (dx / dist) * force
          const fy = (dy / dist) * force
          velocity[i].dx += fx
          velocity[i].dy += fy
          velocity[j].dx -= fx
          velocity[j].dy -= fy
        }
      }

      for (const edge of edges) {
        const si = positions.findIndex((n) => n.id === edge.source)
        const ti = positions.findIndex((n) => n.id === edge.target)
        if (si === -1 || ti === -1) continue

        const dx = positions[ti].x - positions[si].x
        const dy = positions[ti].y - positions[si].y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const force = dist * ATTRACTION * edge.weight * cooling
        const fx = (dx / (dist || 1)) * force
        const fy = (dy / (dist || 1)) * force
        velocity[si].dx += fx
        velocity[si].dy += fy
        velocity[ti].dx -= fx
        velocity[ti].dy -= fy
      }

      for (let i = 0; i < positions.length; i++) {
        const dx = centerX - positions[i].x
        const dy = centerY - positions[i].y
        velocity[i].dx += dx * 0.002 * cooling
        velocity[i].dy += dy * 0.002 * cooling
      }

      for (let i = 0; i < positions.length; i++) {
        velocity[i].dx *= DAMPING
        velocity[i].dy *= DAMPING
        positions[i].x += velocity[i].dx
        positions[i].y += velocity[i].dy

        positions[i].x = Math.max(
          positions[i].radius,
          Math.min(width - positions[i].radius, positions[i].x)
        )
        positions[i].y = Math.max(
          positions[i].radius,
          Math.min(height - positions[i].radius, positions[i].y)
        )
      }
    }

    return { nodes: positions, edges }
  }, [dimensions, nodes, edges])

  // Observe container size
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          setDimensions({ width, height })
        }
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  if (layout.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted">
        <div className="text-center">
          <p className="text-lg">Add tags to your notes to see the tag graph.</p>
          <p className="text-sm mt-1">
            Each tag becomes a node, and co-occurring tags are connected.
          </p>
        </div>
      </div>
    )
  }

  if (layout.nodes.length < 2) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted">
        <div className="text-center">
          <p className="text-lg">Add more tags to see the graph.</p>
          <p className="text-sm mt-1">
            At least 2 unique tags are needed to show connections.
          </p>
        </div>
      </div>
    )
  }

  // Find connected nodes to the hovered one
  const connectedNodes = new Set<string>()
  if (hoveredNode) {
    connectedNodes.add(hoveredNode)
    for (const edge of layout.edges) {
      if (edge.source === hoveredNode) connectedNodes.add(edge.target)
      if (edge.target === hoveredNode) connectedNodes.add(edge.source)
    }
  }

  const maxEdgeWeight = Math.max(...layout.edges.map((e) => e.weight), 1)

  return (
    <div ref={containerRef} className="h-full w-full overflow-hidden">
      <svg
        width={dimensions.width}
        height={dimensions.height}
        className="select-none"
      >
        {/* Edges */}
        {layout.edges.map((edge) => {
          const sourceNode = layout.nodes.find((n) => n.id === edge.source)
          const targetNode = layout.nodes.find((n) => n.id === edge.target)
          if (!sourceNode || !targetNode) return null

          const isActive = hoveredNode
            ? connectedNodes.has(edge.source) && connectedNodes.has(edge.target)
            : true

          return (
            <line
              key={`${edge.source}::${edge.target}`}
              x1={sourceNode.x}
              y1={sourceNode.y}
              x2={targetNode.x}
              y2={targetNode.y}
              stroke="var(--color-accent, #EC4899)"
              strokeOpacity={
                isActive ? Math.max(0.1, (edge.weight / maxEdgeWeight) * 0.5) : 0.04
              }
              strokeWidth={isActive ? 1 + (edge.weight / maxEdgeWeight) * 2 : 0.5}
            />
          )
        })}

        {/* Nodes */}
        {layout.nodes.map((node) => {
          const isActive = hoveredNode
            ? connectedNodes.has(node.id)
            : true

          return (
            <g
              key={node.id}
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/tags/${encodeURIComponent(node.label)}`)}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
            >
              <circle
                cx={node.x}
                cy={node.y}
                r={node.radius}
                fill="var(--color-accent-soft, #F9A8D4)"
                fillOpacity={isActive ? 0.7 : 0.25}
                stroke="var(--color-accent, #EC4899)"
                strokeOpacity={isActive ? 0.8 : 0.2}
                strokeWidth={isActive ? 2 : 1}
                className="transition-all duration-200"
              />
              <text
                x={node.x}
                y={node.y}
                textAnchor="middle"
                dominantBaseline="central"
                className="pointer-events-none fill-text-primary"
                style={{
                  fontSize: `${Math.max(9, node.radius * 0.38)}px`,
                  fill: 'var(--color-text-primary, #4A1942)',
                  fontFamily: 'var(--font-family, sans-serif)',
                  fontWeight: 500,
                }}
              >
                {node.label.length > 10
                  ? `${node.label.slice(0, 9)}...`
                  : node.label}
              </text>

              {/* Count badge */}
              {isActive && (
                <text
                  x={node.x}
                  y={node.y - node.radius - 4}
                  textAnchor="middle"
                  dominantBaseline="alphabetic"
                  style={{
                    fontSize: '10px',
                    fill: 'var(--color-text-muted, #9D174D)',
                  }}
                  className="pointer-events-none"
                >
                  {node.count}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
