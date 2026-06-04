import { useEditor, EditorContent } from '@tiptap/react'
import { editorExtensions } from './extensions'
import { EditorToolbar } from './EditorToolbar'
import { useEditorStore } from '../../stores/editorStore'
import { useCallback, useEffect, type ReactNode } from 'react'

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
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[300px] px-4 py-3 text-text-primary',
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
