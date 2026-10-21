import type { JournalCompositionDraft } from './journalDraftAdapters'
import type { ResourceTemplate } from '../../types'
import { getJournalPageSize } from './journalLayout'
import { getJournalMaterialDefinition } from './journalMaterials'
import { parseStylePayload } from './journalItemStyles'
import { isRecord } from '../../utils/safeJson'
import { registerJournalTemplate, type JournalPageTemplateDefinition, type NormalizedJournalLayout } from './journalPageTemplates'
import type { JournalBackgroundPresetId } from './journalBackgrounds'

export function captureJournalLayout(draft: JournalCompositionDraft, id: string, name: string): JournalPageTemplateDefinition {
  const page = getJournalPageSize(draft.orientation)
  const template: JournalPageTemplateDefinition = { id, name, nameKey: 'journalEdit.myTemplates', descriptionKey: 'journalEdit.reuseHint', preferredOrientation: draft.orientation, background: draft.background as JournalBackgroundPresetId, slots: [], decorations: [] }
  for (const item of draft.items.filter(item => !item.staged)) {
    const layout: NormalizedJournalLayout = { x: item.x / page.width, y: item.y / page.height, width: item.width / page.width, height: item.height / page.height, rotation: item.rotation, zIndex: item.zIndex }
    const style = parseStylePayload(item.stylePayload)
    // Retain typography, but don't carry last week's words or source IDs forward.
    if (isRecord(style.noteCard)) { delete style.noteCard.titleText; delete style.noteCard.bodyText }
    delete style.text
    if (item.itemType === 'material' && item.materialId) {
      if (getJournalMaterialDefinition(item.materialId)?.kind === 'paper') { style.noteCard = { ...(isRecord(style.noteCard) ? style.noteCard : {}), titleText: '', bodyText: '' }; style.locked = false }
      template.decorations.push({ materialId: item.materialId, layout, styleOverrides: style })
    } else if (item.itemType !== 'material') {
      style.locked = false
      template.slots.push({ id: `slot-${template.slots.length}`, kind: item.itemType === 'note' ? 'note' : 'illustration', layout, styleOverrides: style })
    }
  }
  return template
}

export function readReusableLayout(resource: ResourceTemplate): JournalPageTemplateDefinition | null {
  try {
    const value: unknown = JSON.parse(resource.payload)
    if (!isRecord(value) || value.version !== 1 || !isRecord(value.layout)) return null
    const layout = value.layout
    if (!['portrait', 'landscape'].includes(String(layout.preferredOrientation)) || typeof layout.background !== 'string'
      || !Array.isArray(layout.slots) || !Array.isArray(layout.decorations)) return null
    function validGeometry(item: unknown): boolean {
      return isRecord(item) && isRecord(item.layout) && ['x', 'y', 'width', 'height', 'rotation', 'zIndex'].every(key => Number.isFinite((item.layout as Record<string, unknown>)[key]))
    }
    if (!layout.slots.every(item => validGeometry(item) && isRecord(item) && typeof item.id === 'string' && (item.kind === 'note' || item.kind === 'illustration'))
      || !layout.decorations.every(item => validGeometry(item) && isRecord(item) && typeof item.materialId === 'string')) return null
    return registerJournalTemplate({ ...layout, id: resource.id, name: resource.name, nameKey: 'journalEdit.myTemplates', descriptionKey: 'journalEdit.reuseHint' } as unknown as JournalPageTemplateDefinition)
  } catch { return null }
}
