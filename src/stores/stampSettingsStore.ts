import { create } from 'zustand'
import { getStampMaterialId, normalizeStampInput } from '../features/stamps/stampService'
import type { Stamp, StampInput, StampPreset } from '../types'

const STORAGE_KEY = 'oshinote.stampSettings'
const MAX_RECENT_PRESETS = 5

interface StampSettingsState {
  soundEnabled: boolean
  recentPresets: StampPreset[]
  setSoundEnabled: (enabled: boolean) => void
  rememberPreset: (stamp: Stamp | StampInput) => void
}

const initialState = loadStampSettings()

export const useStampSettingsStore = create<StampSettingsState>((set) => ({
  soundEnabled: initialState.soundEnabled,
  recentPresets: initialState.recentPresets,
  setSoundEnabled: (soundEnabled) => set(() => {
    const next = { ...getPersistedState(), soundEnabled }
    saveStampSettings(next)
    return { soundEnabled }
  }),
  rememberPreset: (stamp) => set((state) => {
    const preset = createPresetFromStamp(stamp)
    const nextPresets = [
      preset,
      ...state.recentPresets.filter((item) => item.id !== preset.id),
    ].slice(0, MAX_RECENT_PRESETS)
    saveStampSettings({ soundEnabled: state.soundEnabled, recentPresets: nextPresets })
    return { recentPresets: nextPresets }
  }),
}))

function loadStampSettings(): Pick<StampSettingsState, 'soundEnabled' | 'recentPresets'> {
  if (typeof localStorage === 'undefined') return { soundEnabled: false, recentPresets: [] }
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Partial<Pick<StampSettingsState, 'soundEnabled' | 'recentPresets'>>
    return {
      soundEnabled: parsed.soundEnabled === true,
      recentPresets: Array.isArray(parsed.recentPresets) ? parsed.recentPresets.filter(isValidPreset).slice(0, MAX_RECENT_PRESETS) : [],
    }
  } catch {
    return { soundEnabled: false, recentPresets: [] }
  }
}

function saveStampSettings(state: Pick<StampSettingsState, 'soundEnabled' | 'recentPresets'>) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    soundEnabled: state.soundEnabled,
    recentPresets: state.recentPresets,
  }))
}

function getPersistedState(): Pick<StampSettingsState, 'soundEnabled' | 'recentPresets'> {
  return useStampSettingsStore.getState()
}

function createPresetFromStamp(stamp: Stamp | StampInput): StampPreset {
  const normalized = normalizeStampInput(stamp)
  const materialId = getStampMaterialId(normalized)
  const size = roundPresetNumber(normalized.size ?? 1)
  const rotation = roundPresetNumber(normalized.rotation ?? 0)
  const opacity = roundPresetNumber(normalized.opacity ?? 0.92)
  const label = normalized.label.trim() || 'Stamp'
  const color = normalized.color || '#8B5CF6'
  const id = [
    normalized.template_id || 'recorded',
    materialId,
    label,
    color.toLowerCase(),
    size,
    rotation,
    opacity,
  ].join('|')

  return {
    id,
    name: label,
    template_id: normalized.template_id || 'recorded',
    material_id: materialId,
    label,
    color,
    size,
    rotation,
    opacity,
    updated_at: new Date().toISOString(),
  }
}

function isValidPreset(value: unknown): value is StampPreset {
  if (!value || typeof value !== 'object') return false
  const preset = value as Partial<StampPreset>
  return Boolean(
    typeof preset.id === 'string' &&
    typeof preset.name === 'string' &&
    typeof preset.template_id === 'string' &&
    typeof preset.material_id === 'string' &&
    typeof preset.label === 'string' &&
    typeof preset.color === 'string' &&
    typeof preset.size === 'number' &&
    typeof preset.rotation === 'number' &&
    typeof preset.opacity === 'number' &&
    typeof preset.updated_at === 'string'
  )
}

function roundPresetNumber(value: number): number {
  return Number(value.toFixed(2))
}
