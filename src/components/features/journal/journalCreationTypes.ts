import type { JournalDraftItem, JournalMaterialKind, JournalPageOrientation, Stamp, StampInput } from '../../../types'

export type JournalCreationStepId = 'setup' | 'notes' | 'images' | 'materials' | 'stamp' | 'review'
export type JournalNoteFilter = 'all' | 'favorite' | 'tagged' | 'untagged'
export type JournalImageFilter = 'all' | 'official' | 'fanart' | 'favorite'
export type JournalDrawerDock = 'left' | 'right' | 'top' | 'bottom'
export type JournalMaterialFilter = 'all' | JournalMaterialKind

export interface JournalCreationFlowDraft {
  oshiId: string
  title: string
  dateLabel: string
  description: string
  background: string
  orientation: JournalPageOrientation
  items: JournalDraftItem[]
  stamp: Stamp | StampInput | null
}
