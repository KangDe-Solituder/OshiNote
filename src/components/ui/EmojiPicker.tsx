import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Smile, X } from 'lucide-react'
import { KAOMOJI_CATEGORIES, EMOJI_CATEGORIES } from '../../features/notes/kaomojiPresets'
import { useUiMotionSeconds } from '../features/themes/uiMotion'

interface EmojiPickerProps {
  onSelect: (text: string) => void
}

type Tab = 'emoji' | 'kaomoji' | 'custom'
const CUSTOM_KAOMOJI_KEY = 'oshinote.customKaomoji'

export function EmojiPicker({ onSelect }: EmojiPickerProps) {
  const motionSeconds = useUiMotionSeconds()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('emoji')
  const [customItems, setCustomItems] = useState<string[]>(loadCustomKaomoji)
  const [customInput, setCustomInput] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="px-3 py-1.5 rounded text-sm text-text-secondary hover:bg-bg-tertiary transition-colors"
      >
        <Smile size={16} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: motionSeconds }}
            className="absolute top-full mt-2 left-0 w-80 bg-bg-primary border border-border-color rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            <div className="flex border-b border-border-color">
              <button
                onClick={() => setTab('emoji')}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${
                  tab === 'emoji' ? 'text-accent border-b-2 border-accent' : 'text-text-muted'
                }`}
              >
                Emoji
              </button>
              <button
                onClick={() => setTab('kaomoji')}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${
                  tab === 'kaomoji' ? 'text-accent border-b-2 border-accent' : 'text-text-muted'
                }`}
              >
                Kaomoji
              </button>
              <button
                onClick={() => setTab('custom')}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${
                  tab === 'custom' ? 'text-accent border-b-2 border-accent' : 'text-text-muted'
                }`}
              >
                Mine
              </button>
            </div>

            <div className="p-3 max-h-64 overflow-y-auto">
              {tab === 'emoji' ? (
                <div className="space-y-3">
                  {Object.entries(EMOJI_CATEGORIES).map(([category, emojis]) => (
                    <div key={category}>
                      <p className="text-xs text-text-muted mb-1 capitalize">{category}</p>
                      <div className="flex flex-wrap gap-1">
                        {emojis.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => { onSelect(emoji); setOpen(false) }}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg-tertiary text-lg transition-colors"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : tab === 'kaomoji' ? (
                <div className="space-y-3">
                  {Object.entries(KAOMOJI_CATEGORIES).map(([category, kaomojis]) => (
                    <div key={category}>
                      <p className="text-xs text-text-muted mb-1 capitalize">{category}</p>
                      <div className="flex flex-wrap gap-1">
                        {kaomojis.map((kao) => (
                          <button
                            key={kao}
                            onClick={() => { onSelect(kao); setOpen(false) }}
                            className="px-2 py-1 rounded-lg hover:bg-bg-tertiary text-xs text-text-primary transition-colors whitespace-nowrap"
                          >
                            {kao}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      const next = customInput.trim()
                      if (!next || customItems.includes(next)) return
                      const items = [next, ...customItems]
                      setCustomItems(items)
                      localStorage.setItem(CUSTOM_KAOMOJI_KEY, JSON.stringify(items))
                      setCustomInput('')
                    }}
                    className="flex items-center gap-2"
                  >
                    <input
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      placeholder="Add kaomoji..."
                      className="min-w-0 flex-1 px-2 py-1.5 rounded-lg border border-border-color bg-bg-secondary text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-soft"
                    />
                    <button
                      type="submit"
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors"
                      title="Add"
                    >
                      <Plus size={14} />
                    </button>
                  </form>
                  {customItems.length === 0 ? (
                    <p className="text-xs text-text-muted py-4 text-center">No custom kaomoji yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {customItems.map((item) => (
                        <span key={item} className="group inline-flex items-center gap-1 rounded-lg hover:bg-bg-tertiary transition-colors">
                          <button
                            onClick={() => { onSelect(item); setOpen(false) }}
                            className="px-2 py-1 text-xs text-text-primary whitespace-nowrap"
                          >
                            {item}
                          </button>
                          <button
                            onClick={() => {
                              const items = customItems.filter((custom) => custom !== item)
                              setCustomItems(items)
                              localStorage.setItem(CUSTOM_KAOMOJI_KEY, JSON.stringify(items))
                            }}
                            className="pr-1 text-text-muted hover:text-red-500"
                            title="Remove"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function loadCustomKaomoji(): string[] {
  try {
    if (typeof localStorage === 'undefined') return []
    const saved = localStorage.getItem(CUSTOM_KAOMOJI_KEY)
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}
