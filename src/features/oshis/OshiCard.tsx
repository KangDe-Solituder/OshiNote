import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Link2, Pencil, Trash2 } from 'lucide-react'
import type { Oshi } from '../../types'


interface OshiCardProps {
  oshi: Oshi
  noteCount: number
  onEdit: () => void
  onDelete: () => void
}

export function OshiCard({ oshi, noteCount, onEdit, onDelete }: OshiCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="relative group"
    >
      <Link
        to={`/oshis/${oshi.id}`}
        className="block overflow-hidden rounded-2xl border border-white/20 bg-bg-card p-6 shadow-glass backdrop-blur-md transition-all duration-300 hover:shadow-xl"
      >
        <div className="flex min-w-0 flex-col items-center gap-3 overflow-hidden text-center">
          <div
            className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center text-2xl font-bold text-white shadow-lg"
            style={{ backgroundColor: oshi.color || '#EC4899' }}
          >
            {oshi.avatar ? (
              <img src={oshi.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              oshi.name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0 max-w-full">
            <h3 className="truncate text-lg font-semibold text-text-primary">{oshi.name}</h3>
            <p className="text-sm text-text-muted">{noteCount} notes</p>
          </div>
          {oshi.description && (
            <p className="w-full overflow-hidden break-words text-xs text-text-secondary [overflow-wrap:anywhere] line-clamp-2">
              {oshi.description}
            </p>
          )}
          {oshi.activity_links.length > 0 && (
            <p className="inline-flex items-center gap-1 text-xs text-text-muted">
              <Link2 size={12} />
              {oshi.activity_links.length} related {oshi.activity_links.length === 1 ? 'link' : 'links'}
            </p>
          )}
        </div>
      </Link>

      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.preventDefault(); onEdit() }}
          className="p-1.5 rounded-lg bg-bg-secondary text-text-muted hover:text-accent hover:bg-accent-soft transition-colors"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={(e) => { e.preventDefault(); onDelete() }}
          className="p-1.5 rounded-lg bg-bg-secondary text-text-muted hover:text-red-500 hover:bg-red-50 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </motion.div>
  )
}
