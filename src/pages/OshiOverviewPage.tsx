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
import { releaseMediaUrl, resolveMediaUrl } from '../services/media/illustrationMedia'
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
          <StatCard icon={BookOpen} label="Journal Archives" value={stats.books} to={`/oshis/${oshiId}/journal`} />
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
              <SectionHeader title="Recent Journal Archives" to={`/oshis/${oshiId}/journal`} />
              {books.length === 0 ? (
                <EmptyLine text="No journal archives yet." action="Open Journal" to={`/oshis/${oshiId}/journal`} />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {books.map((book) => (
                    <Link
                      key={book.id}
                      to={`/oshis/${oshiId}/journal`}
                      className="flex min-h-[132px] gap-3 rounded-xl border border-border-color bg-bg-secondary p-3 transition-colors hover:border-accent"
                    >
                      <OverviewJournalBookCover book={book} />
                      <div className="min-w-0 flex-1 self-center">
                        <p className="truncate text-sm font-semibold text-text-primary">{book.title}</p>
                        <p className="mt-1 text-xs text-text-muted">{book.date_label || new Date(book.created_at).getFullYear()}</p>
                        <p className="mt-1 text-xs text-text-muted">{book.page_count} page{book.page_count === 1 ? '' : 's'}</p>
                      </div>
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
    let currentUrl = ''
    resolveMediaUrl(path)
      .then((url) => {
        currentUrl = url
        if (alive) setSrc(url)
        else releaseMediaUrl(url)
      })
      .catch(() => {
        if (alive) setSrc('')
      })
    return () => {
      alive = false
      releaseMediaUrl(currentUrl)
    }
  }, [path])
  if (!src) return <div className="flex h-full w-full items-center justify-center text-text-muted"><ImageIcon size={20} /></div>
  return <img src={src} alt={alt} className="h-full w-full object-cover" />
}

function OverviewJournalBookCover({ book }: { book: JournalBook }) {
  const isDark = book.cover_style === 'night'
  return (
    <div
      className="journal-book-cover relative h-[108px] w-[76px] shrink-0 overflow-hidden rounded-r-xl rounded-l-lg border shadow-sm"
      style={{
        backgroundColor: book.cover_color || '#c9c5f3',
        borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(80,95,130,0.16)',
      }}
    >
      <span className="absolute inset-y-0 left-0 w-3 bg-black/10 shadow-[inset_-2px_0_2px_rgba(255,255,255,0.22)]" />
      <span className="pointer-events-none absolute inset-0 opacity-55 [background-image:linear-gradient(90deg,rgba(255,255,255,0.24)_0,rgba(255,255,255,0)_28%),radial-gradient(circle_at_20%_18%,rgba(255,255,255,0.5)_0,rgba(255,255,255,0)_18%),radial-gradient(circle_at_82%_70%,rgba(0,0,0,0.09)_0,rgba(0,0,0,0)_22%)]" />
      <span className="pointer-events-none absolute inset-2 rounded-lg border border-white/24" />
      <div className={`absolute inset-x-4 top-[32%] truncate text-center text-xs font-semibold ${isDark ? 'text-white/80' : 'text-[#56667f]'}`}>
        {book.title}
      </div>
      <div className={`absolute inset-x-4 top-[52%] truncate text-center text-[10px] ${isDark ? 'text-white/55' : 'text-[#7c8da5]'}`}>
        {book.date_label || new Date(book.created_at).getFullYear()}
      </div>
      <BookOpen size={20} className={`absolute bottom-5 left-1/2 -translate-x-1/2 ${isDark ? 'text-white/58' : 'text-[#64748b]'}`} />
    </div>
  )
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
