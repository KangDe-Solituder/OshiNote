import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Heart, Loader2 } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { useOshiStore } from '../stores/oshiStore'
import { OshiCard } from '../features/oshis/OshiCard'
import { OshiForm } from '../features/oshis/OshiForm'
import type { Oshi, CreateOshiInput } from '../types'

export function OshiListPage() {
  const { oshis, oshiNoteCounts, loading, error, fetchAll, createOshi, updateOshi, deleteOshi } = useOshiStore()
  const [formOpen, setFormOpen] = useState(false)
  const [editingOshi, setEditingOshi] = useState<Oshi | null>(null)

  useEffect(() => { fetchAll() }, [fetchAll])

  function handleCreate(input: CreateOshiInput) {
    createOshi(input)
  }

  function handleUpdate(input: CreateOshiInput) {
    if (editingOshi) {
      updateOshi(editingOshi.id, input)
      setEditingOshi(null)
    }
  }

  function handleDelete(id: string) {
    const noteCount = oshiNoteCounts[id] || 0
    const message = noteCount > 0
      ? `Delete this oshi? Its ${noteCount} note${noteCount === 1 ? '' : 's'} will be kept in All Notes as unassigned.`
      : 'Delete this oshi?'
    if (!confirm(message)) return
    deleteOshi(id)
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-text-primary mb-1">My Oshis</h1>
          <p className="text-text-secondary">Manage your favorite streamers and creators.</p>
        </div>
        <Button onClick={() => { setEditingOshi(null); setFormOpen(true) }}>
          <Plus size={18} />
          Add Oshi
        </Button>
      </div>

      {loading && (
        <div className="text-center py-20">
          <Loader2 size={32} className="mx-auto mb-4 text-accent animate-spin" />
          <p className="text-text-muted">Loading...</p>
        </div>
      )}

      {error && (
        <div className="text-center py-12 bg-red-50 rounded-2xl">
          <p className="text-red-500 mb-4">{error}</p>
          <Button variant="secondary" onClick={fetchAll}>Retry</Button>
        </div>
      )}

      {!loading && !error && oshis.length === 0 && (
        <div className="text-center py-20">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Heart size={64} className="mx-auto mb-6 text-accent-soft" />
          </motion.div>
          <h2 className="text-xl font-semibold text-text-primary mb-2">No oshis yet</h2>
          <p className="text-text-muted mb-6">Create your first oshi to start recording memories.</p>
          <Button size="lg" onClick={() => { setEditingOshi(null); setFormOpen(true) }}>
            <Plus size={18} />
            Create Your First Oshi
          </Button>
        </div>
      )}

      {!loading && !error && oshis.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <AnimatePresence>
            {oshis.map((oshi) => (
              <OshiCard
                key={oshi.id}
                oshi={oshi}
                noteCount={oshiNoteCounts[oshi.id] || 0}
                onEdit={() => { setEditingOshi(oshi); setFormOpen(true) }}
                onDelete={() => handleDelete(oshi.id)}
              />
            ))}
            <motion.button
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => { setEditingOshi(null); setFormOpen(true) }}
              className="p-6 rounded-2xl border-2 border-dashed border-border-hover hover:border-accent text-text-muted hover:text-accent transition-colors flex flex-col items-center justify-center gap-2 min-h-[200px]"
            >
              <Plus size={32} />
              <span className="text-sm font-medium">Add Oshi</span>
            </motion.button>
          </AnimatePresence>
        </div>
      )}

      <OshiForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingOshi(null) }}
        onSubmit={editingOshi ? handleUpdate : handleCreate}
        editing={editingOshi}
      />
    </div>
  )
}
