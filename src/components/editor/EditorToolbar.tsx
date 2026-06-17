import type { Editor } from '@tiptap/react'
import { Bold, Italic, Underline as UnderlineIcon, Strikethrough, Palette } from 'lucide-react'
import { EmojiPicker } from '../ui/EmojiPicker'
import { useState, useRef, useEffect } from 'react'
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { SelectMenu } from '../ui/SelectMenu'

interface EditorToolbarProps {
  editor: Editor | null
  onInsertEmoji: (text: string) => void
}

const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px']
const COLORS = ['#EC4899', '#8B5CF6', '#60A5FA', '#34D399', '#FBBF24', '#F87171', '#4A1942', '#3B82F6', '#000000', '#FFFFFF']
const HIGHLIGHTS = ['#FEF08A', '#FBCFE8', '#BFDBFE', '#BBF7D0', '#FED7AA', '#E9D5FF', 'transparent']

function keepEditorFocus(event: ReactMouseEvent) {
  event.preventDefault()
}

function ToolBtn({ active, onClick, children, title }: { active?: boolean; onClick: () => void; children: ReactNode; title: string }) {
  return (
    <button
      type="button"
      onMouseDown={keepEditorFocus}
      onClick={onClick}
      title={title}
      className={`px-2.5 py-1.5 rounded text-sm transition-colors ${
        active ? 'bg-accent-soft text-accent' : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
      }`}
    >
      {children}
    </button>
  )
}

export function EditorToolbar({ editor, onInsertEmoji }: EditorToolbarProps) {
  const [showColor, setShowColor] = useState(false)
  const [showHighlight, setShowHighlight] = useState(false)
  const colorRef = useRef<HTMLDivElement>(null)
  const highlightRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) setShowColor(false)
      if (highlightRef.current && !highlightRef.current.contains(e.target as Node)) setShowHighlight(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!editor) return null

  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border-color bg-bg-secondary/30 flex-wrap">
      <ToolBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
        <Bold size={16} />
      </ToolBtn>
      <ToolBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
        <Italic size={16} />
      </ToolBtn>
      <ToolBtn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline">
        <UnderlineIcon size={16} />
      </ToolBtn>
      <ToolBtn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
        <Strikethrough size={16} />
      </ToolBtn>

      <div className="w-px h-5 bg-border-color mx-1" />

      <SelectMenu
        value=""
        onChange={(value) => {
          if (value) editor.chain().focus().setFontSize(value).run()
        }}
        options={FONT_SIZES.map((size) => ({ value: size, label: size }))}
        placeholder="Size"
        ariaLabel="Font size"
        size="sm"
        buttonClassName="rounded-lg bg-transparent"
        menuClassName="w-[104px]"
        preserveFocusOnMouseDown
      />

      <SelectMenu
        value=""
        onChange={(value) => {
          if (value) editor.chain().focus().setFontFamily(value).run()
        }}
        options={[
          { value: 'Quicksand', label: 'Quicksand' },
          { value: 'Nunito', label: 'Nunito' },
          { value: 'serif', label: 'Serif' },
          { value: 'monospace', label: 'Mono' },
          { value: 'cursive', label: 'Cursive' },
        ]}
        placeholder="Font"
        ariaLabel="Font family"
        size="sm"
        buttonClassName="rounded-lg bg-transparent"
        menuClassName="w-[148px]"
        preserveFocusOnMouseDown
      />

      <div className="w-px h-5 bg-border-color mx-1" />

      <div ref={colorRef} className="relative">
        <button
          type="button"
          onMouseDown={keepEditorFocus}
          onClick={() => setShowColor(!showColor)}
          className="px-2.5 py-1.5 rounded text-sm text-text-secondary hover:bg-bg-tertiary transition-colors flex items-center gap-1"
        >
          <Palette size={14} />
          <span className="text-xs">Color</span>
        </button>
        {showColor && (
          <div className="absolute top-full mt-1 left-0 p-2 bg-bg-primary border border-border-color rounded-xl shadow-xl z-50 flex gap-1">
            {COLORS.map((color) => (
              <button
                key={color}
                onMouseDown={keepEditorFocus}
                onClick={() => { editor.chain().focus().setColor(color === '#000000' ? color : color).run(); setShowColor(false) }}
                className="w-6 h-6 rounded-full border border-border-color"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        )}
      </div>

      <div ref={highlightRef} className="relative">
        <button
          type="button"
          onMouseDown={keepEditorFocus}
          onClick={() => setShowHighlight(!showHighlight)}
          className="px-2.5 py-1.5 rounded text-sm text-text-secondary hover:bg-bg-tertiary transition-colors"
        >
          <span className="text-xs">Highlight</span>
        </button>
        {showHighlight && (
          <div className="absolute top-full mt-1 left-0 p-2 bg-bg-primary border border-border-color rounded-xl shadow-xl z-50 flex gap-1">
            {HIGHLIGHTS.map((color) => (
              <button
                key={color}
                onMouseDown={keepEditorFocus}
                onClick={() => {
                  if (color === 'transparent') editor.chain().focus().unsetHighlight().run()
                  else editor.chain().focus().toggleHighlight({ color }).run()
                  setShowHighlight(false)
                }}
                className={`w-6 h-6 rounded-full border border-border-color ${color === 'transparent' ? 'bg-white' : ''}`}
                style={{ backgroundColor: color === 'transparent' ? 'white' : color }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-5 bg-border-color mx-1" />

      <EmojiPicker onSelect={onInsertEmoji} />
    </div>
  )
}
