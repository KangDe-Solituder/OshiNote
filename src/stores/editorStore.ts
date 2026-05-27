import { create } from 'zustand'
import type { Editor } from '@tiptap/react'

interface EditorState {
  editor: Editor | null
  isDirty: boolean
  lastSaved: string | null

  setEditorInstance: (editor: Editor | null) => void
  markDirty: () => void
  markSaved: () => void
}

export const useEditorStore = create<EditorState>((set) => ({
  editor: null,
  isDirty: false,
  lastSaved: null,

  setEditorInstance: (editor) => set({ editor }),
  markDirty: () => set({ isDirty: true }),
  markSaved: () => set({ isDirty: false, lastSaved: new Date().toISOString() }),
}))
