import { create } from 'zustand'
import type { Editor } from '@tiptap/react'

interface EditorState {
  editor: Editor | null
  isDirty: boolean
  revision: number
  lastSaved: string | null

  setEditorInstance: (editor: Editor | null) => void
  markDirty: () => void
  markSaved: () => void
}

export const useEditorStore = create<EditorState>((set) => ({
  editor: null,
  isDirty: false,
  revision: 0,
  lastSaved: null,

  setEditorInstance: (editor) => set({ editor }),
  markDirty: () => set(s => ({ isDirty: true, revision: s.revision + 1 })),
  markSaved: () => set({ isDirty: false, lastSaved: new Date().toISOString() }),
}))
