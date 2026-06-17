import { useState, useEffect } from 'react'
import { ImagePlus, Plus, Trash2 } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import type { Oshi, CreateOshiInput } from '../../types'

const PRESET_COLORS = ['#EC4899', '#8B5CF6', '#60A5FA', '#34D399', '#FBBF24', '#F87171']

interface OshiFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: CreateOshiInput) => void
  editing?: Oshi | null
}

export function OshiForm({ open, onClose, onSubmit, editing }: OshiFormProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [avatar, setAvatar] = useState('')
  const [description, setDescription] = useState('')
  const [activityLinks, setActivityLinks] = useState<string[]>([''])
  const [linkError, setLinkError] = useState('')

  useEffect(() => {
    if (editing) {
      setName(editing.name)
      setColor(editing.color || PRESET_COLORS[0])
      setAvatar(editing.avatar || '')
      setDescription(editing.description)
      setActivityLinks(editing.activity_links.length > 0 ? editing.activity_links : [''])
    } else {
      setName('')
      setColor(PRESET_COLORS[0])
      setAvatar('')
      setDescription('')
      setActivityLinks([''])
    }
    setLinkError('')
  }, [editing, open])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const normalizedLinks = activityLinks.map((url) => url.trim()).filter(Boolean)
    if (normalizedLinks.some((url) => !isWebUrl(url))) {
      setLinkError('Activity links must start with http:// or https://.')
      return
    }
    onSubmit({
      name: name.trim(),
      color,
      avatar,
      description: description.trim(),
      activity_links: normalizedLinks,
    })
    onClose()
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setAvatar(String(reader.result))
    reader.readAsDataURL(file)
  }

  function updateLink(index: number, value: string) {
    setActivityLinks((links) => links.map((link, i) => i === index ? value : link))
    setLinkError('')
  }

  function removeLink(index: number) {
    setActivityLinks((links) => links.length === 1 ? [''] : links.filter((_, i) => i !== index))
    setLinkError('')
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Oshi' : 'New Oshi'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name"
          placeholder="Your oshi's name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <div>
          <label className="text-sm font-medium text-text-secondary mb-2 block">Photo</label>
          <div className="flex items-center gap-4">
            <div
              className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center text-2xl font-bold text-white shadow-lg shrink-0"
              style={{ backgroundColor: color }}
            >
              {avatar ? (
                <img src={avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                name.trim().charAt(0).toUpperCase() || '?'
              )}
            </div>
            <div className="flex flex-col gap-2">
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-bg-secondary text-text-primary hover:bg-bg-tertiary border border-border-color cursor-pointer transition-colors">
                <ImagePlus size={16} />
                Upload photo
                <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
              </label>
              {avatar && (
                <button
                  type="button"
                  onClick={() => setAvatar('')}
                  className="text-xs text-text-muted hover:text-red-500 text-left"
                >
                  Remove photo
                </button>
              )}
            </div>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-text-secondary mb-1.5 block">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What makes this oshi special to you?"
            rows={3}
            className="w-full px-4 py-2.5 rounded-xl border border-border-color bg-bg-secondary text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-soft focus:border-accent transition-colors text-sm resize-none"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-text-secondary mb-2 block">Color</label>
          <div className="flex gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full transition-transform ${
                  color === c ? 'ring-2 ring-offset-2 ring-accent scale-110' : ''
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-text-secondary">Related Activities</label>
            <button
              type="button"
              onClick={() => setActivityLinks((links) => [...links, ''])}
              className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover"
            >
              <Plus size={13} />
              Add URL
            </button>
          </div>
          <div className="space-y-2">
            {activityLinks.map((link, index) => (
              <div key={index} className="flex gap-2 items-center">
                <div className="flex-1">
                  <Input
                    type="url"
                    value={link}
                    onChange={(e) => updateLink(index, e.target.value)}
                    placeholder="https://youtube.com/... or https://x.com/..."
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeLink(index)}
                  className="p-2 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Remove link"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          {linkError && <p className="text-xs text-red-500 mt-2">{linkError}</p>}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit">{editing ? 'Save' : 'Create'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function isWebUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}
