import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { JournalDraftItem, JournalPage, Stamp, StampInput } from '../types'
import { useJournalStore } from '../stores/journalStore'
import { createCompositionDraft, createDraftSavePlan, draftItemToJournalLayout } from '../features/journal/journalDraftAdapters'
import {
  createJournalItemForIllustration, createJournalItemForImage, createJournalItemForMaterial,
  createJournalItemForNote, removeJournalItem,
  setJournalItemStaged, updateJournalItemStyle, updateJournalItemLayout, updateJournalPage,
} from '../features/journal/journalService'
import { JournalCreationFlow } from '../components/features/journal/JournalCreationFlow'
import { JournalPageView } from '../components/features/journal/JournalPageView'
import { useI18n } from '../i18n/useI18n'
import { persistStampForTarget } from '../features/stamps/stampService'
import { loadJournalEditorSnapshot, type JournalEditorSnapshot } from '../features/journal/journalEditorSnapshot'

export function JournalEditorPage() {
  const { pageId = '' } = useParams<{ pageId: string }>()
  const [searchParams] = useSearchParams()
  // View/edit transitions create a new session, including a return to a URL
  // visited earlier. A previous ready flag must never expose a stale draft.
  return <JournalEditorSession key={`${pageId}:${searchParams.get('view') === '1'}`} />
}

function JournalEditorSession() {
  const { t } = useI18n()
  const { pageId = '' } = useParams<{ pageId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loadError, setLoadError] = useState('')
  const [snapshot, setSnapshot] = useState<JournalEditorSnapshot | null>(null)
  const openPageForEditing = useJournalStore((state) => state.openPageForEditing)
  const activePage = snapshot?.page
  const viewing = searchParams.get('view') === '1'

  useEffect(() => {
    let alive = true
    async function load() {
      if (!pageId) return
      const next = await loadJournalEditorSnapshot(pageId)
      if (!alive) return
      if (viewing) await openPageForEditing(pageId, next.page.oshi_id)
      if (!alive) return
      setSnapshot(next)
    }
    setLoadError('')
    void load().catch((error: unknown) => { if (alive) setLoadError(String(error)) })
    return () => { alive = false }
  }, [pageId, openPageForEditing, viewing])

  async function handleSaveCompositionDraft(draft: {
    oshiId: string
    title: string
    dateLabel: string
    description: string
    background: string
    orientation: JournalPage['orientation']
    items: JournalDraftItem[]
    stamp: Stamp | StampInput | null
  }) {
    if (!activePage || !snapshot) return
    await updateJournalPage(activePage.id, {
      title: draft.title.trim() || t('journalEditor.defaultPageTitle'),
      description: draft.description.trim(),
      date_label: draft.dateLabel.trim(),
      background: draft.background,
      orientation: draft.orientation,
    })

    const savePlan = createDraftSavePlan(draft.items, snapshot.items)
    await Promise.all(savePlan.existingItemsToRemove.map((item) => removeJournalItem(item.id)))

    await Promise.all(savePlan.itemsToUpdate.map(async (item) => {
      const layout = draftItemToJournalLayout(item)
      if (!item.originItemId) return
      await updateJournalItemLayout(item.originItemId, layout)
      await setJournalItemStaged(item.originItemId, item.staged === true)
      if (item.stylePayload !== undefined) {
        await updateJournalItemStyle(item.originItemId, { style_payload: item.stylePayload })
      }
    }))

    await Promise.all(savePlan.itemsToCreate.map(async (item) => {
      const layout = draftItemToJournalLayout(item)
      const staged = item.staged === true
      if (item.itemType === 'note' && item.sourceId) {
        const created = await createJournalItemForNote(activePage.id, item.sourceId, layout, staged)
        if (item.stylePayload !== undefined) await updateJournalItemStyle(created.id, { style_payload: item.stylePayload })
      } else if (item.itemType === 'illustration' && item.sourceId) {
        const created = await createJournalItemForIllustration(activePage.id, item.sourceId, layout, staged)
        if (item.stylePayload !== undefined) await updateJournalItemStyle(created.id, { style_payload: item.stylePayload })
      } else if (item.itemType === 'image' && item.sourceId) {
        const created = await createJournalItemForImage(activePage.id, item.sourceId, layout, staged)
        if (item.stylePayload !== undefined) await updateJournalItemStyle(created.id, { style_payload: item.stylePayload })
      } else if (item.itemType === 'material' && item.materialId) {
        await createJournalItemForMaterial(activePage.id, item.materialId, layout, item.stylePayload, staged)
      }
    }))

    await persistStampForTarget('journal_page', activePage.id, draft.stamp)
    navigate(`/journal/pages/${activePage.id}/edit?view=1`, { replace: true })
  }

  if (!pageId) return <JournalCreationFlow />
  if (!snapshot || !activePage) return <div role="status" className="p-6 text-text-muted">{loadError || t('common.loading')}</div>
  if (viewing) return (
    <JournalPageView
      oshiId={activePage.oshi_id}
      bookId={activePage.book_id}
      bookTitle={snapshot.bookTitle}
      initialPageId={pageId}
      standalonePostcard={activePage.standalone ? activePage : null}
      onBack={() => navigate('/journal')}
    />
  )
  return (
    <JournalCreationFlow
      key={pageId}
      mode="edit"
      initialStep={searchParams.get('setup') === '1' ? 'setup' : 'draft'}
      initialDraft={createCompositionDraft(activePage, snapshot.items, snapshot.stamp)}
      onSaveDraft={handleSaveCompositionDraft}
      onCancelEdit={() => navigate(`/journal/pages/${pageId}/edit?view=1`, { replace: true })}
    />
  )
}
