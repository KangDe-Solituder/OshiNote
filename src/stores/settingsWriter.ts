import { getDb } from '../database'
import { readLocalStorage } from '../utils/safeLocalStorage'

const KEY = 'oshinote.pendingAppearance.v1'
const ALLOWED = new Set(['theme','glassEnabled','customBg','bgFilters','hotkeys','fontSize','uiMotionDuration','textTone','simpleMode'])
let pending: Record<string, string> = {}
try { const stored = JSON.parse(readLocalStorage(KEY) || '{}'); pending = Object.fromEntries(Object.entries(stored).filter(([key,value]) => ALLOWED.has(key) && typeof value === 'string')) as Record<string,string> } catch { /* Invalid preference journal is ignored. */ }
let running: Promise<void> | null = null
let report: (error: string | null) => void = () => {}
export function setSettingsWriteReporter(callback: typeof report) { report = callback }
export function pendingAppearance() { return { ...pending } }
function journal() {
  if (typeof localStorage === 'undefined') return
  if (Object.keys(pending).length) localStorage.setItem(KEY, JSON.stringify(pending))
  else localStorage.removeItem(KEY)
}
export function queueAppearance(key: string, value: string) {
  if (!ALLOWED.has(key)) throw new Error('Invalid appearance preference')
  pending[key] = value
  try { journal() } catch { report('外观设置尚未保存 / Appearance changes are not saved yet.') }
  // Immediate serial drain coalesces pending values without a timer that can lose the final edit.
  void flushAppearance().catch(() => {})
}
export function flushAppearance(): Promise<void> {
  if (running) return running
  running = Promise.resolve().then(async () => {
    if (!Object.keys(pending).length) return
    const db = await getDb()
    while (Object.keys(pending).length) {
      const [key, value] = Object.entries(pending)[0]
      await db.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value])
      if (pending[key] === value) delete pending[key]
      journal()
    }
    report(null)
  }).catch(error => { report('外观设置保存失败，改动已保留以便重试 / Could not save appearance settings; changes are retained for retry.'); throw error })
    .finally(() => { running = null })
  return running
}
