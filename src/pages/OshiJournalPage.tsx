import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { BookOpen } from 'lucide-react'
import { JournalWorkspace } from '../components/features/journal/JournalWorkspace'
import { OshiModuleHeader } from '../components/layout/OshiModuleHeader'
import { fetchOshiById } from '../features/oshis/oshiService'
import type { Oshi } from '../types'

export function OshiJournalPage() {
  const { oshiId } = useParams<{ oshiId: string }>()
  const [oshi, setOshi] = useState<Oshi | null>(null)

  useEffect(() => {
    if (!oshiId) return
    fetchOshiById(oshiId).then(setOshi).catch(() => {})
  }, [oshiId])

  if (!oshiId) return null
  return (
    <div className="flex h-full min-h-0 flex-col bg-bg-primary">
      <OshiModuleHeader
        oshiId={oshiId}
        title="Journal"
        subtitle={`Archives and loose pages${oshi ? ` for ${oshi.name}` : ''}.`}
        icon={BookOpen}
      />
      <div className="min-h-0 flex-1 overflow-hidden">
        <JournalWorkspace oshiId={oshiId} />
      </div>
    </div>
  )
}
