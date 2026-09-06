import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { JournalDraftItem, JournalPage, Stamp, StampInput } from '../types'
import { useJournalStore } from '../stores/journalStore'
import { createCompositionDraft, createDraftSavePlan, draftItemToJournalLayout } from '../features/journal/journalDraftAdapters'
import {
  createJournalItemForIllustration, createJournalItemForImage, createJournalItemForMaterial,
  createJournalItemForNote, fetchJournalPageById, fetchJournalBookById, removeJournalItem,
  setJournalItemStaged, updateJournalItemStyle, updateJournalPage,
} from '../features/journal/journalService'
import { JournalCreationFlow } from '../components/features/journal/JournalCreationFlow'
import { JournalPageView } from '../components/features/journal/JournalPageView'
import { useI18n } from '../i18n/useI18n'
import { fetchStampForTarget, persistStampForTarget } from '../features/stamps/stampService'

export function JournalEditorPage() {
  const { t } = useI18n()
  const { pageId = '' } = useParams<{ pageId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [readyPageId, setReadyPageId] = useState('')
  const [loadError, setLoadError] = useState('')
  const [loadedPage, setLoadedPage] = useState<JournalPage | null>(null)
  const [bookTitle, setBookTitle] = useState('')
  const [stampDraft, setStampDraft] = useState<Stamp | StampInput | null>(null)
  const { pages, items, error, openPageForEditing, updateItemLayout, updateItemStyle } = useJournalStore()
  // Keep the book view mounted when its initial page is deleted or detached;
  // JournalPageView then shows the remaining pages using the store's state.
  const activePage = pages.find((page) => page.id === pageId) || (loadedPage?.id === pageId ? loadedPage : null)
  const viewing = searchParams.get('view') === '1'

  useEffect(() => {
    let alive = true
    async function load() {
      if (!pageId) return
      const page = await fetchJournalPageById(pageId)
      if (!alive) return
      if (!page) throw new Error('Journal page not found')
      await openPageForEditing(pageId, page.oshi_id)
      const [stamp, book] = await Promise.all([
        fetchStampForTarget('journal_page', pageId),
        page.book_id ? fetchJournalBookById(page.book_id) : Promise.resolve(null),
      ])
      if (!alive) return
      setStampDraft(stamp)
      setLoadedPage(page)
      setBookTitle(book?.title || page.title)
      setReadyPageId(`${pageId}:${viewing}`)
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
    if (!activePage) return
    await updateJournalPage(activePage.id, {
      title: draft.title.trim() || t('journalEditor.defaultPageTitle'),
      description: draft.description.trim(),
      date_label: draft.dateLabel.trim(),
      background: draft.background,
      orientation: draft.orientation,
    })

    const savePlan = createDraftSavePlan(draft.items, items)
    await Promise.all(savePlan.existingItemsToRemove.map((item) => removeJournalItem(item.id)))

    await Promise.all(savePlan.itemsToUpdate.map(async (item) => {
      const layout = draftItemToJournalLayout(item)
      if (!item.originItemId) return
      await updateItemLayout(item.originItemId, layout)
      await setJournalItemStaged(item.originItemId, item.staged === true)
      if (item.stylePayload !== undefined) {
        await updateItemStyle(item.originItemId, { style_payload: item.stylePayload })
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

    setStampDraft(await persistStampForTarget('journal_page', activePage.id, draft.stamp))
    await openPageForEditing(activePage.id, activePage.oshi_id)
    navigate(`/journal/pages/${activePage.id}/edit?view=1`, { replace: true })
  }

  if (!pageId) return <JournalCreationFlow />
  if (readyPageId !== `${pageId}:${viewing}` || !activePage) return <div role="status" className="p-6 text-text-muted">{loadError || error || t('common.loading')}</div>
  if (viewing) return (
    <JournalPageView
      oshiId={activePage.oshi_id}
      bookId={activePage.book_id}
      bookTitle={bookTitle}
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
      initialDraft={createCompositionDraft(activePage, items, stampDraft)}
      onSaveDraft={handleSaveCompositionDraft}
      onCancelEdit={() => navigate(`/journal/pages/${pageId}/edit?view=1`, { replace: true })}
    />
  )
}
