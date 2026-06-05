import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { invoke } from '@tauri-apps/api/core'
import { BookOpen, Edit3, ExternalLink, FileText, Heart, ImageIcon, Link2, Loader2, Plus, Tag } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { PAGE_CONTENT_CLASS } from '../components/layout/pageShell'
import { OshiForm } from '../features/oshis/OshiForm'
import { fetchOshiById, getOshiNoteCount, updateOshi } from '../features/oshis/oshiService'
import { fetchRecentNotesByOshi, getTagsByOshi } from '../features/notes/noteService'
import { fetchIllustrations, getIllustrationCountByOshi } from '../features/illustrations/illustrationService'
import { fetchJournalBooks, getJournalBookCountByOshi } from '../features/journal/journalService'
import { resolveMediaUrl } from '../services/media/illustrationMedia'
import type { CreateOshiInput, Illustration, JournalBook, Note, Oshi } from '../types'

export function OshiOverviewPage() {
  const { oshiId } = useParams<{ oshiId: string }>()
  const [oshi, setOshi] = useState<Oshi | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [illustrations, setIllustrations] = useState<Illustration[]>([])
  const [books, setBooks] = useState<JournalBook[]>([])
  const [stats, setStats] = useState({ notes: 0, illustrations: 0, books: 0, tags: 0 })
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!oshiId) return
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [oshiRecord, noteCount, illustrationCount, bookCount, tags, recentNotes, recentIllustrations, recentBooks] = await Promise.all([
          fetchOshiById(oshiId!),
          getOshiNoteCount(oshiId!),
          getIllustrationCountByOshi(oshiId!),
          getJournalBookCountByOshi(oshiId!),
          getTagsByOshi(oshiId!),
          fetchRecentNotesByOshi(oshiId!, 5),
          fetchIllustrations({ oshiId: oshiId!, sort: 'newest' }),
          fetchJournalBooks(oshiId!),
        ])
        if (cancelled) return
        setOshi(oshiRecord)
        setStats({ notes: noteCount, illustrations: illustrationCount, books: bookCount, tags: tags.length })
        setNotes(recentNotes)
        setIllustrations(recentIllustrations.slice(0, 4))
        setBooks(recentBooks.slice(0, 4))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [oshiId])

  async function handleUpdate(input: CreateOshiInput) {
    if (!oshiId) return
    await updateOshi(oshiId, input)
    setEditing(false)
    setOshi(await fetchOshiById(oshiId))
  }

  async function openExternal(value: string) {
    const url = normalizeWebUrl(value)
    if (!url) return
    try {
      await invoke('open_external_url', { url })
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={30} className="animate-spin text-accent" />
      </div>
    )
  }

  if (!oshi || !oshiId) {
    return (
      <div className="flex h-full items-center justify-center text-text-muted">
        Oshi not found
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-bg-primary">
      <main className={`${PAGE_CONTENT_CLASS} mx-auto max-w-6xl`}>
        <section className="mb-5 rounded-2xl border border-border-color bg-bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-start gap-4">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full text-xl font-bold text-white shadow-lg"
              style={{ backgroundColor: oshi.color || '#EC4899' }}
            >
              {oshi.avatar ? <img src={oshi.avatar} alt="" className="h-full w-full object-cover" /> : oshi.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold text-text-primary">{oshi.name}</h1>
                <Heart size={18} className="text-accent" />
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
                {oshi.description || 'No description yet.'}
              </p>
            </div>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Edit3 size={16} />
              Edit Profile
            </Button>
          </div>

          {oshi.activity_links.length > 0 && (
            <div className="mt-4 grid gap-2 md:grid-cols-3">
              {oshi.activity_links.slice(0, 6).map((url) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => openExternal(url)}
                  className="flex min-w-0 items-center gap-2 rounded-xl border border-border-color bg-bg-secondary px-3 py-2 text-left text-sm text-text-secondary transition-colors hover:border-accent hover:text-accent"
                >
                  <Link2 size={15} className="shrink-0" />
                  <span className="truncate">{formatLinkLabel(url)}</span>
                  <ExternalLink size={13} className="ml-auto shrink-0" />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={FileText} label="Notes" value={stats.notes} to={`/oshis/${oshiId}/notes`} />
          <StatCard icon={ImageIcon} label="Illustrations" value={stats.illustrations} to={`/oshis/${oshiId}/illustrations`} />
          <StatCard icon={BookOpen} label="Journal Books" value={stats.books} to={`/oshis/${oshiId}/journal`} />
          <StatCard icon={Tag} label="Tags" value={stats.tags} to={`/oshis/${oshiId}/tags`} />
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <section className="rounded-2xl border border-border-color bg-bg-card p-5">
            <SectionHeader title="Recent Notes" to={`/oshis/${oshiId}/notes`} />
            {notes.length === 0 ? (
              <EmptyLine text="No notes yet." action="New Note" to={`/oshis/${oshiId}/notes/new`} />
            ) : (
              <div className="divide-y divide-border-color">
                {notes.map((note) => (
                  <Link key={note.id} to={`/oshis/${oshiId}/notes/${note.id}`} className="block py-3 transition-colors hover:text-accent">
                    <div className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-xs text-text-muted">{new Date(note.created_at).toLocaleDateString()}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-text-primary">{note.title || 'Untitled'}</p>
                        <p className="mt-1 truncate text-xs text-text-muted">{note.plain_text || 'No content'}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <div className="grid gap-5">
            <section className="rounded-2xl border border-border-color bg-bg-card p-5">
              <SectionHeader title="Recent Illustrations" to={`/oshis/${oshiId}/illustrations`} />
              {illustrations.length === 0 ? (
                <EmptyLine text="No illustrations yet." action="Add Illustration" to={`/oshis/${oshiId}/illustrations`} />
              ) : (
                <div className="grid grid-cols-4 gap-3">
                  {illustrations.map((illustration) => (
                    <Link key={illustration.id} to={`/oshis/${oshiId}/illustrations`} className="aspect-square overflow-hidden rounded-xl bg-bg-tertiary">
                      <OverviewMediaImage path={illustration.thumbnail_path || illustration.original_path} alt={illustration.title} />
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-border-color bg-bg-card p-5">
              <SectionHeader title="Recent Journal Books" to={`/oshis/${oshiId}/journal`} />
              {books.length === 0 ? (
                <EmptyLine text="No journal books yet." action="Open Journal" to={`/oshis/${oshiId}/journal`} />
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {books.map((book) => (
                    <Link key={book.id} to={`/oshis/${oshiId}/journal`} className="rounded-xl border border-border-color bg-bg-secondary p-3 transition-colors hover:border-accent">
                      <div className="aspect-[0.72] rounded-lg border border-white/20" style={{ backgroundColor: book.cover_color }} />
                      <p className="mt-2 truncate text-xs font-semibold text-text-primary">{book.title}</p>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      <OshiForm
        open={editing}
        editing={oshi}
        onClose={() => setEditing(false)}
        onSubmit={handleUpdate}
      />
    </div>
  )
}

function StatCard({ icon: Icon, label, value, to }: { icon: typeof FileText; label: string; value: number; to: string }) {
  return (
    <Link to={to} className="rounded-2xl border border-border-color bg-bg-card p-3.5 transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-lg">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft/25 text-accent">
          <Icon size={18} />
        </span>
        <div>
          <p className="text-lg font-bold text-text-primary">{value}</p>
          <p className="text-xs text-text-secondary">{label}</p>
        </div>
      </div>
    </Link>
  )
}

function SectionHeader({ title, to }: { title: string; to: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="font-semibold text-text-primary">{title}</h2>
      <Link to={to} className="text-xs font-semibold text-accent hover:text-accent-hover">View all</Link>
    </div>
  )
}

function EmptyLine({ text, action, to }: { text: string; action: string; to: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border-color p-5 text-center">
      <p className="text-sm text-text-muted">{text}</p>
      <Link to={to} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent">
        <Plus size={15} />
        {action}
      </Link>
    </div>
  )
}

function OverviewMediaImage({ path, alt }: { path: string | null; alt: string }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let alive = true
    resolveMediaUrl(path).then((url) => {
      if (alive) setSrc(url)
    })
    return () => { alive = false }
  }, [path])
  if (!src) return <div className="flex h-full w-full items-center justify-center text-text-muted"><ImageIcon size={20} /></div>
  return <img src={src} alt={alt} className="h-full w-full object-cover" />
}

function normalizeWebUrl(value: string): string | null {
  try {
    const withProtocol = /^[a-z]+:\/\//i.test(value) ? value : `https://${value}`
    const url = new URL(withProtocol)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function formatLinkLabel(value: string): string {
  const url = normalizeWebUrl(value)
  if (!url) return value
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return value
  }
}
