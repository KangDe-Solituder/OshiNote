import { useEffect, useState } from 'react'
import { loadMaterialLibrary, type LibraryMaterial } from './resourceManagement'
export function useMaterialLibrary() {
  const [materials, setMaterials] = useState<LibraryMaterial[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    let alive = true
    const refresh = () => { loadMaterialLibrary().then(rows => { if (alive) { setMaterials(rows); setError('') } }).catch(e => { if (alive) setError(String(e)) }) }
    refresh()
    window.addEventListener('resources-changed', refresh)
    return () => { alive = false; window.removeEventListener('resources-changed', refresh) }
  }, [])
  return { materials, error }
}
