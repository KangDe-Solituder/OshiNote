import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Heart } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { useOshiStore } from '../stores/oshiStore'
import { OshiCard } from '../features/oshis/OshiCard'
import { OshiForm } from '../features/oshis/OshiForm'
import type { Oshi, CreateOshiInput } from '../types'
import { PAGE_CONTENT_CLASS, PAGE_DASHBOARD_FRAME_CLASS } from '../components/layout/pageShell'
import { useI18n } from '../i18n/useI18n'
import { PageLoadingState } from '../components/ui/PageLoadingState'

export function OshiListPage() {
  const { t } = useI18n()
  const { oshis, oshiNoteCounts, loading, error, fetchAll, createOshi, updateOshi, deleteOshi } = useOshiStore()
  const [formOpen, setFormOpen] = useState(false)
  const [editingOshi, setEditingOshi] = useState<Oshi | null>(null)
  const initialLoading = loading && oshis.length === 0

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
    const noteLabel = noteCount === 1 ? t('oshis.noteSingular') : t('oshis.notePlural')
    const message = noteCount > 0
      ? t('oshis.delete.confirmWithNotes', { count: noteCount, noteLabel })
      : t('oshis.delete.confirm')
    if (!confirm(message)) return
    deleteOshi(id)
  }

  return (
    <div className={PAGE_CONTENT_CLASS}>
      <div className={PAGE_DASHBOARD_FRAME_CLASS}>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-text-primary">{t('oshis.title')}</h1>
          <p className="text-sm text-text-secondary">{t('oshis.subtitle')}</p>
        </div>
        <Button className="rounded-2xl px-5" onClick={() => { setEditingOshi(null); setFormOpen(true) }}>
          <Plus size={18} />
          {t('nav.addOshi')}
        </Button>
      </div>

      {initialLoading && <PageLoadingState label={t('common.loading')} layout="cards" />}

      {error && (
        <div className="text-center py-12 bg-red-50 rounded-2xl">
          <p className="text-red-500 mb-4">{error}</p>
          <Button variant="secondary" onClick={fetchAll}>{t('common.retry')}</Button>
        </div>
      )}

      {!initialLoading && !error && oshis.length === 0 && (
        <div className="text-center py-20">
          <div>
            <Heart size={64} className="mx-auto mb-6 text-accent-soft" />
          </div>
          <h2 className="text-xl font-semibold text-text-primary mb-2">{t('oshis.empty.title')}</h2>
          <p className="text-text-muted mb-6">{t('oshis.empty.body')}</p>
          <Button size="lg" onClick={() => { setEditingOshi(null); setFormOpen(true) }}>
            <Plus size={18} />
            {t('oshis.empty.action')}
          </Button>
        </div>
      )}

      {!initialLoading && !error && oshis.length > 0 && (
        <div className="adaptive-library-grid">
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
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              onClick={() => { setEditingOshi(null); setFormOpen(true) }}
              className="flex min-h-[164px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border-hover p-5 text-text-muted transition-colors hover:border-accent hover:text-accent"
            >
              <Plus size={28} />
              <span className="text-sm font-semibold">{t('nav.addOshi')}</span>
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
    </div>
  )
}
