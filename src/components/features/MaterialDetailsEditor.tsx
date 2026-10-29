import { useRef, useState } from 'react'
import { JOURNAL_STICKER_GROUPS } from '../../features/journal/journalMaterials'
import { deleteMaterial, updateResource, type LibraryMaterial } from '../../features/resources/resourceManagement'
import { exportMaterialPack } from '../../features/resources/resourcePacks'
import { useResourceActions } from '../../features/resources/resourceActionsText'
import { useI18n } from '../../i18n/useI18n'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { SelectMenu } from '../ui/SelectMenu'

export function MaterialDetailsEditor({ material, title, busy, run, onDeleted }: {
  material: LibraryMaterial; title: string; busy: boolean
  run: (work: () => Promise<unknown>) => Promise<void>; onDeleted: () => void
}) {
  const { t, locale } = useI18n()
  const action = useResourceActions()
  const [name, setName] = useState(title)
  const [group, setGroup] = useState<string>(material.group || 'misc')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const deleteButton = useRef<HTMLButtonElement>(null)
  const dirty = name.trim() !== title || group !== (material.group || 'misc')
  const labels = locale === 'zh' ? { remove: '删除', confirm: '删除素材', hint: '从素材库删除此素材？已有手账和模板中使用的版本会保留。' }
    : locale === 'ja' ? { remove: '削除', confirm: '素材を削除', hint: 'この素材をライブラリから削除しますか？既存の手帳やテンプレートで使用しているバージョンは保持されます。' }
      : { remove: 'Delete', confirm: 'Delete material', hint: 'Delete this material from the library? Versions used in existing journals and templates will be kept.' }
  const closeConfirmation = () => { setConfirmDelete(false); deleteButton.current?.focus({ preventScroll: true }) }
  return <>
    <form className="mt-4 space-y-3" onSubmit={event => {
      event.preventDefault()
      if (!dirty || busy || !name.trim()) return
      void run(() => updateResource(material.assetId, { name: name.trim(), group }))
    }}>
      <label className="block text-xs text-text-muted">{action.rename}
        <input name="name" aria-label={action.rename} value={name} disabled={busy} onChange={event => setName(event.target.value)} maxLength={160} required
          className="mt-1 w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary" />
      </label>
      <label className="block text-xs text-text-muted">{action.group}
        <SelectMenu disabled={busy} ariaLabel={action.group} value={group} className="mt-1" buttonClassName="w-full" onChange={setGroup}
          options={JOURNAL_STICKER_GROUPS.filter(item => item.id !== 'all').map(item => ({ value: item.id, label: t(item.labelKey) }))} />
      </label>
      <div className="grid grid-cols-4 gap-2">
        <Button type="button" disabled={busy} variant="secondary" size="sm" className="min-w-0 !px-2" aria-pressed={material.favorite}
          onClick={() => void run(() => updateResource(material.assetId, { favorite: !material.favorite }))}>
          <span className="truncate" title={material.favorite ? action.unfavorite : action.favorite}>{material.favorite ? action.unfavorite : action.favorite}</span>
        </Button>
        <Button ref={deleteButton} type="button" disabled={busy} variant="danger" size="sm" className="min-w-0 !px-2" onClick={() => setConfirmDelete(true)}>{labels.remove}</Button>
        <Button type="button" disabled={busy} variant="secondary" size="sm" className="min-w-0 !px-2" onClick={() => void run(() => exportMaterialPack(material.assetId, title))}>{action.export}</Button>
        <Button type="submit" disabled={busy || !dirty || !name.trim()} variant={dirty ? 'primary' : 'secondary'} size="sm" className="min-w-0 !px-2">{action.save}</Button>
      </div>
    </form>
    <Modal open={confirmDelete} onClose={closeConfirmation} title={labels.confirm}>
      <p className="break-words font-medium">{title}</p>
      <p className="mt-2 text-sm text-text-secondary">{labels.hint}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button autoFocus variant="secondary" size="sm" onClick={closeConfirmation}>{action.cancel}</Button>
        <Button variant="danger" size="sm" disabled={busy} onClick={() => {
          setConfirmDelete(false)
          void run(async () => { await deleteMaterial(material.assetId); onDeleted() })
        }}>{labels.remove}</Button>
      </div>
    </Modal>
  </>
}
