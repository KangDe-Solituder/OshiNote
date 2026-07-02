import { useEditor, EditorContent } from '@tiptap/react'
import { editorExtensions } from './extensions'
import { EditorToolbar } from './EditorToolbar'
import { useEditorStore } from '../../stores/editorStore'
import { useCallback, useEffect, type ReactNode } from 'react'
import type { Mark, Node as ProseMirrorNode, Slice } from '@tiptap/pm/model'
import { Fragment, Slice as ProseMirrorSlice } from '@tiptap/pm/model'
import type { EditorView } from '@tiptap/pm/view'

interface TipTapEditorProps {
  content?: object
  onUpdate?: (json: object, text: string) => void
  afterToolbar?: ReactNode
}

function FallbackEditor({ onUpdate }: { onUpdate?: (json: object, text: string) => void }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-border-color bg-bg-secondary/30 text-xs text-text-muted">
        Rich text editor loading... If this persists, use plain text below.
      </div>
      <textarea
        className="flex-1 w-full bg-transparent text-text-primary placeholder:text-text-muted focus:outline-none resize-none p-4 text-base leading-relaxed"
        placeholder="Write your thoughts about your oshi..."
        onChange={(e) => {
          if (onUpdate) {
            onUpdate(
              { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: e.target.value }] }] },
              e.target.value
            )
          }
        }}
      />
    </div>
  )
}

export function TipTapEditor({ content, onUpdate, afterToolbar }: TipTapEditorProps) {
  const setEditorInstance = useEditorStore((s) => s.setEditorInstance)
  const markDirty = useEditorStore((s) => s.markDirty)

  const editor = useEditor({
    extensions: editorExtensions,
    content: content || '',
    onUpdate: ({ editor: ed }) => {
      markDirty()
      if (onUpdate) {
        onUpdate(ed.getJSON(), ed.getText())
      }
    },
    editorProps: {
      attributes: {
        class: 'oshinote-editor-content prose prose-sm max-w-none focus:outline-none min-h-[300px] px-4 py-3 text-text-primary',
      },
      clipboardTextSerializer: (slice) => serializeClipboardText(slice),
      handlePaste: (view, event) => {
        const text = event.clipboardData?.getData('text/plain')
        if (!text) return false
        event.preventDefault()
        insertPlainTextKeepingCurrentMarks(view, text)
        return true
      },
    },
    onSelectionUpdate: () => {},
  })

  useEffect(() => {
    if (editor) {
      setEditorInstance(editor)
    }
    return () => setEditorInstance(null)
  }, [editor, setEditorInstance])

  const insertText = useCallback((text: string) => {
    try {
      editor?.chain().focus().insertContent(text).run()
    } catch {
      // ignore
    }
  }, [editor])

  if (!editor && content === undefined) {
    return <FallbackEditor onUpdate={onUpdate} />
  }

  return (
    <div className="flex flex-col h-full">
      <EditorToolbar editor={editor} onInsertEmoji={insertText} />
      {afterToolbar}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  )
}

function serializeClipboardText(slice: Slice): string {
  const blocks: string[] = []

  slice.content.forEach((node) => {
    if (node.isBlock) {
      blocks.push(normalizeCopiedBlockText(getNodeText(node)))
      return
    }

    const inlineText = normalizeCopiedBlockText(getNodeText(node))
    if (inlineText) blocks.push(inlineText)
  })

  return blocks.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()
}

function getNodeText(node: ProseMirrorNode): string {
  if (node.isText) return node.text || ''
  if (node.type.name === 'hardBreak') return '\n'

  let text = ''
  node.forEach((child) => {
    text += getNodeText(child)
  })
  return text
}

function normalizeCopiedBlockText(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
}

function insertPlainTextKeepingCurrentMarks(view: EditorView, rawText: string) {
  const text = normalizePastedText(rawText)
  if (!text) return

  const { state } = view
  const { schema } = state
  const marks = getCurrentMarks(view)
  const paragraphs = text.split(/\n{2,}/)

  if (paragraphs.length === 1 && !paragraphs[0].includes('\n')) {
    const node = schema.text(paragraphs[0], marks)
    view.dispatch(state.tr.replaceSelectionWith(node, false).scrollIntoView())
    return
  }

  const nodes = paragraphs.map((paragraph) => {
    const lines = paragraph.split('\n')
    const inlineNodes: ProseMirrorNode[] = []

    lines.forEach((line, index) => {
      if (line) inlineNodes.push(schema.text(line, marks))
      if (index < lines.length - 1) inlineNodes.push(schema.nodes.hardBreak.create())
    })

    return schema.nodes.paragraph.create(null, inlineNodes.length > 0 ? inlineNodes : undefined)
  })

  const pastedSlice = new ProseMirrorSlice(Fragment.fromArray(nodes), 0, 0)
  view.dispatch(state.tr.replaceSelection(pastedSlice).scrollIntoView())
}

function normalizePastedText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\u200B/g, '')
}

function getCurrentMarks(view: EditorView): readonly Mark[] {
  const { state } = view
  return state.storedMarks || state.selection.$from.marks()
}
