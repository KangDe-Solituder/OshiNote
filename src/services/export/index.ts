import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'
import { fetchAllOshis } from '../../features/oshis/oshiService'
import { fetchArchivesByOshi } from '../../features/oshis/archiveService'
import { getDb } from '../../database'
import type { Note, NoteRow, Oshi, Archive } from '../../types'

export type ExportFormat = 'json' | 'markdown' | 'txt'

function deserializeNote(row: NoteRow): Note {
  return {
    ...row,
    tags: JSON.parse(row.tags || '[]'),
    favorite: row.favorite === 1,
  }
}

async function fetchAllNotes(): Promise<Note[]> {
  const db = await getDb()
  const rows = await db.select<NoteRow[]>(
    'SELECT * FROM notes ORDER BY oshi_id, archive_id, created_at DESC'
  )
  return rows.map(deserializeNote)
}

async function fetchAllArchives(): Promise<Archive[]> {
  const oshis = await fetchAllOshis()
  const results: Archive[] = []
  for (const oshi of oshis) {
    const archives = await fetchArchivesByOshi(oshi.id)
    results.push(...archives)
  }
  return results
}

// ── JSON Format ────────────────────────────────────────────────────────

function formatAsJson(
  oshis: Oshi[],
  archives: Archive[],
  notes: Note[]
): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      totalOshis: oshis.length,
      totalArchives: archives.length,
      totalNotes: notes.length,
      oshis,
      archives,
      notes,
    },
    null,
    2
  )
}

// ── Tiptap JSON → Markdown ────────────────────────────────────────────

type TipTapNode = {
  type?: string
  attrs?: Record<string, unknown>
  content?: TipTapNode[]
  text?: string
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
}

function tiptapToMarkdown(contentJson: string): string {
  let doc: TipTapNode
  try {
    doc = JSON.parse(contentJson)
  } catch {
    return contentJson
  }
  if (!doc || !doc.content) return ''
  return doc.content.map((node) => nodeToMarkdown(node)).join('\n')
}

function nodeToMarkdown(node: TipTapNode): string {
  if (!node) return ''

  // Inline text with marks
  if (node.type === 'text') {
    let text = node.text || ''
    if (node.marks) {
      for (const mark of node.marks) {
        switch (mark.type) {
          case 'bold':
            text = `**${text}**`
            break
          case 'italic':
            text = `*${text}*`
            break
          case 'underline':
            text = `__${text}__`
            break
          case 'strike':
            text = `~~${text}~~`
            break
          case 'code':
            text = `\`${text}\``
            break
          case 'link':
            if (mark.attrs?.href) {
              text = `[${text}](${mark.attrs.href})`
            }
            break
          default:
            break
        }
      }
    }
    return text
  }

  // Block nodes
  const inner =
    node.content?.map((child) => nodeToMarkdown(child)).join('') || ''

  switch (node.type) {
    case 'paragraph':
      return `${inner}\n`
    case 'heading': {
      const level = (node.attrs?.level as number) || 1
      return `${'#'.repeat(Math.min(level, 6))} ${inner}\n`
    }
    case 'bulletList':
      return inner
    case 'listItem':
      return `- ${inner}\n`
    case 'orderedList':
      return inner
    case 'blockquote':
      return inner
        .split('\n')
        .filter(Boolean)
        .map((line) => `> ${line}`)
        .join('\n') + '\n'
    case 'codeBlock':
      return `\`\`\`\n${inner}\n\`\`\`\n`
    case 'horizontalRule':
      return '---\n'
    case 'hardBreak':
      return '\n'
    default:
      return inner
  }
}

// ── Markdown Format ────────────────────────────────────────────────────

function formatAsMarkdown(
  oshis: Oshi[],
  archives: Archive[],
  notes: Note[]
): string {
  const lines: string[] = []
  lines.push(`# OshiNote Export\n`)
  lines.push(`*Exported on ${new Date().toLocaleString()}*\n`)
  lines.push('---\n')

  for (const oshi of oshis) {
    lines.push(`# ${oshi.name}\n`)
    if (oshi.description) {
      lines.push(`${oshi.description}\n`)
    }
    if (oshi.activity_links.length > 0) {
      lines.push(
        oshi.activity_links
          .map((url) => `- [${formatLinkLabel(url)}](${url})`)
          .join('\n') + '\n'
      )
    }
    lines.push('')

    const oshiArchives = archives.filter((a) => a.oshi_id === oshi.id)
    for (const archive of oshiArchives) {
      const archiveNotes = notes.filter(
        (n) => n.oshi_id === oshi.id && n.archive_id === archive.id
      )
      if (archiveNotes.length === 0) continue

      lines.push(`## ${archive.name}\n`)

      for (const note of archiveNotes) {
        const dateLabel = new Date(note.created_at).toLocaleDateString()
        lines.push(`### ${note.title || 'Untitled'} (${dateLabel})\n`)
        if (note.tags.length > 0) {
          lines.push(
            note.tags.map((tag) => `\`#${tag}\``).join(' ') + '\n'
          )
        }
        lines.push('')
        const md = tiptapToMarkdown(note.content)
        lines.push(md || (note.plain_text ? `${note.plain_text}\n` : ''))
        if (note.favorite) {
          lines.push('⭐ Favorite\n')
        }
        lines.push('---\n')
      }
    }
  }

  return lines.join('\n')
}

// ── TXT Format ─────────────────────────────────────────────────────────

function formatAsTxt(
  oshis: Oshi[],
  archives: Archive[],
  notes: Note[]
): string {
  const lines: string[] = []
  lines.push('OshiNote Export')
  lines.push(`Exported on ${new Date().toLocaleString()}`)
  lines.push('='.repeat(60))
  lines.push('')

  for (const oshi of oshis) {
    lines.push(`★ ${oshi.name}`)
    if (oshi.description) lines.push(`  ${oshi.description}`)
    lines.push('')

    const oshiArchives = archives.filter((a) => a.oshi_id === oshi.id)
    for (const archive of oshiArchives) {
      const archiveNotes = notes.filter(
        (n) => n.oshi_id === oshi.id && n.archive_id === archive.id
      )
      if (archiveNotes.length === 0) continue

      lines.push(`── ${archive.name} ──`)
      lines.push('')

      for (const note of archiveNotes) {
        const dateLabel = new Date(note.created_at).toLocaleString()
        lines.push(`${note.title || 'Untitled'}  [${dateLabel}]`)
        if (note.tags.length > 0) {
          lines.push(`Tags: ${note.tags.map((t) => `#${t}`).join(', ')}`)
        }
        if (note.favorite) lines.push('⭐ Favorite')
        lines.push('-'.repeat(40))
        lines.push(note.plain_text || '(empty)')
        lines.push('-'.repeat(40))
        lines.push('')
      }
    }
  }

  return lines.join('\n')
}

// ── Main Export Entry ──────────────────────────────────────────────────

export async function exportAllData(format: ExportFormat): Promise<void> {
  const oshis = await fetchAllOshis()
  const archives = await fetchAllArchives()
  const notes = await fetchAllNotes()

  let content: string
  let defaultName: string
  const filters: { name: string; extensions: string[] }[] = []

  switch (format) {
    case 'json':
      content = formatAsJson(oshis, archives, notes)
      defaultName = `oshinote-export.json`
      filters.push({ name: 'JSON', extensions: ['json'] })
      break
    case 'markdown':
      content = formatAsMarkdown(oshis, archives, notes)
      defaultName = `oshinote-export.md`
      filters.push({ name: 'Markdown', extensions: ['md'] })
      break
    case 'txt':
      content = formatAsTxt(oshis, archives, notes)
      defaultName = `oshinote-export.txt`
      filters.push({ name: 'Text', extensions: ['txt'] })
      break
  }

  const filePath = await save({
    defaultPath: defaultName,
    filters,
  })

  if (!filePath) return // user cancelled

  await writeTextFile(filePath, content)
}

function formatLinkLabel(value: string): string {
  try {
    const url = new URL(value)
    return url.hostname.replace(/^www\./, '')
  } catch {
    return value
  }
}
