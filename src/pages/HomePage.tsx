import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Heart, FileText, Tag } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { getTotalOshiCount, getTotalNoteCount, getTotalTagCount } from '../features/notes/noteService'

export function HomePage() {
  const [stats, setStats] = useState({ oshis: 0, notes: 0, tags: 0 })

  useEffect(() => {
    async function load() {
      try {
        const [oshis, notes, tags] = await Promise.all([
          getTotalOshiCount(), getTotalNoteCount(), getTotalTagCount()
        ])
        setStats({ oshis, notes, tags })
      } catch {}
    }
    load()
  }, [])

  const statCards = [
    { icon: Heart, label: 'Oshis', value: stats.oshis, color: 'text-pink-400', link: '/oshis' },
    { icon: FileText, label: 'Notes', value: stats.notes, color: 'text-blue-400', link: '/oshis' },
    { icon: Tag, label: 'Tags', value: stats.tags, color: 'text-purple-400', link: '/tags' },
  ]

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-text-primary mb-2">Welcome back</h1>
        <p className="text-text-secondary">Your cozy memory space for your oshi.</p>
      </motion.div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {statCards.map((stat) => (
          <Link key={stat.label} to={stat.link}>
            <Card className="flex items-center gap-4">
              <div className={`p-3 rounded-xl bg-bg-tertiary ${stat.color}`}>
                <stat.icon size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-text-primary">{stat.value}</p>
                <p className="text-sm text-text-muted">{stat.label}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {stats.notes === 0 && (
        <div className="text-center py-16">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Heart size={48} className="mx-auto mb-4 text-accent-soft" />
          </motion.div>
          <h2 className="text-xl font-semibold text-text-primary mb-2">No recent activity</h2>
          <p className="text-text-muted">Start by creating your first oshi to record memories with.</p>
        </div>
      )}
    </div>
  )
}
