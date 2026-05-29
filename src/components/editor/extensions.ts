import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import FontFamily from '@tiptap/extension-font-family'
import Placeholder from '@tiptap/extension-placeholder'
import { Extension } from '@tiptap/core'

type FontSizeChain = {
  setMark: (name: string, attrs: Record<string, unknown>) => FontSizeChain
  removeEmptyTextStyle: () => FontSizeChain
  run: () => boolean
}

type FontSizeCommandProps = {
  chain: () => FontSizeChain
}

const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return { types: ['textStyle'] }
  },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (el: HTMLElement) => el.style.fontSize || null,
          renderHTML: (attrs: Record<string, unknown>) => {
            if (!attrs.fontSize) return {}
            return { style: `font-size: ${attrs.fontSize}` }
          },
        },
      },
    }]
  },
  addCommands() {
    return {
      setFontSize: (fontSize: string) => ({ chain }: FontSizeCommandProps) => chain().setMark('textStyle', { fontSize }).run(),
      unsetFontSize: () => ({ chain }: FontSizeCommandProps) => chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    }
  },
})

export const editorExtensions = [
  StarterKit.configure({
    code: false,
    heading: { levels: [1, 2, 3] },
  }),
  Underline,
  TextStyle,
  Color,
  Highlight.configure({ multicolor: true }),
  FontFamily,
  FontSize,
  Placeholder.configure({ placeholder: 'Write your thoughts about your oshi...' }),
]
