import { getJournalMaterialDefinition, getMaterialSnapshot } from '../journal/journalMaterials'
import { isRecord } from '../../utils/safeJson'
export function resourceDependencies(value: unknown): string[] {
  const result = new Set<string>()
  const visit = (node: unknown) => {
    if (Array.isArray(node)) { node.forEach(visit); return }
    if (!isRecord(node)) return
    if (typeof node.resourceVersionId === 'string') result.add(node.resourceVersionId)
    if (Array.isArray(node.resourceDependencies)) node.resourceDependencies.forEach(id => { if (typeof id === 'string') result.add(id) })
    for (const [key, child] of Object.entries(node)) {
      if ((key === 'materialSnapshot' || key === 'material_snapshot') && typeof child === 'string') visit(JSON.parse(child))
      else visit(child)
    }
  }
  visit(value)
  return [...result]
}
export function freezeTemplatePayload(raw: string) {
  const value = JSON.parse(raw)
  const visit = (node: unknown) => {
    if (Array.isArray(node)) { node.forEach(visit); return }
    if (!isRecord(node)) return
    if (typeof node.materialId === 'string' && !node.materialSnapshot) {
      const material = getJournalMaterialDefinition(node.materialId)
      if (!material) throw new Error('Missing material: ' + node.materialId)
      node.materialSnapshot = getMaterialSnapshot(material)
    }
    Object.values(node).forEach(visit)
  }
  visit(value)
  value.resourceDependencies = resourceDependencies(value)
  return JSON.stringify(value)
}
