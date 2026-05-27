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
        className="block p-6 rounded-2xl bg-bg-card backdrop-blur-md border border-white/20 shadow-glass hover:shadow-xl transition-all duration-300"
      >
        <div className="flex flex-col items-center text-center gap-3">
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
          <div>
            <h3 className="text-lg font-semibold text-text-primary">{oshi.name}</h3>
            <p className="text-sm text-text-muted">{noteCount} notes</p>
          </div>
          {oshi.description && (
            <p className="text-xs text-text-secondary line-clamp-2">{oshi.description}</p>
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
