import type { CSSProperties } from 'react'
import type { TranslationKey } from '../../i18n/translations'

export type JournalBackgroundPresetId =
  | 'paper'
  | 'sakura'
  | 'blue-hour'
  | 'rainy-cafe'
  | 'maple'
  | 'envelope'
  | 'grid'
  | 'postcard'

export interface JournalBackgroundPreset {
  id: JournalBackgroundPresetId
  labelKey: TranslationKey
  descriptionKey: TranslationKey
  swatch: string
  previewStyle: CSSProperties
  canvasBackground: CSSProperties
}

const dotLayer = 'radial-gradient(var(--journal-canvas-dot) 1px, transparent 1px)'

export const JOURNAL_BACKGROUND_PRESETS: JournalBackgroundPreset[] = [
  {
    id: 'paper',
    labelKey: 'journalEditor.background.paper',
    descriptionKey: 'journalCreate.background.paper.description',
    swatch: '#f7f1e8',
    previewStyle: { backgroundColor: '#f7f1e8', backgroundImage: 'radial-gradient(rgba(120,100,80,0.22) 1px, transparent 1px)', backgroundSize: '18px 18px' },
    canvasBackground: { backgroundColor: 'var(--journal-canvas-bg)', backgroundImage: dotLayer, backgroundSize: '18px 18px' },
  },
  {
    id: 'sakura',
    labelKey: 'journalEditor.background.sakura',
    descriptionKey: 'journalCreate.background.sakura.description',
    swatch: '#f8dce5',
    previewStyle: { backgroundColor: '#fae8ee', backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(236,118,151,0.2) 0 2px, transparent 3px), radial-gradient(rgba(130,82,98,0.16) 1px, transparent 1px)', backgroundSize: '54px 46px, 18px 18px' },
    canvasBackground: {
      backgroundColor: 'color-mix(in srgb, var(--color-bg-primary) 78%, #f8bfd0)',
      backgroundImage: 'radial-gradient(circle at 20% 20%, color-mix(in srgb, var(--color-accent) 24%, transparent) 0 2px, transparent 3px), radial-gradient(var(--journal-canvas-dot) 1px, transparent 1px)',
      backgroundSize: '54px 46px, 18px 18px',
    },
  },
  {
    id: 'blue-hour',
    labelKey: 'journalEditor.background.blueHour',
    descriptionKey: 'journalCreate.background.blueHour.description',
    swatch: '#cfe0f4',
    previewStyle: { backgroundColor: '#dbe9f7', backgroundImage: 'linear-gradient(135deg, rgba(69,115,161,0.16), transparent 42%), radial-gradient(rgba(57,91,128,0.18) 1px, transparent 1px)', backgroundSize: 'auto, 18px 18px' },
    canvasBackground: {
      backgroundColor: 'color-mix(in srgb, var(--color-bg-primary) 74%, #b8d4ef)',
      backgroundImage: 'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 18%, transparent), transparent 42%), radial-gradient(var(--journal-canvas-dot) 1px, transparent 1px)',
      backgroundSize: 'auto, 18px 18px',
    },
  },
  {
    id: 'rainy-cafe',
    labelKey: 'journalEditor.background.rainyCafe',
    descriptionKey: 'journalCreate.background.rainyCafe.description',
    swatch: '#d8c7b2',
    previewStyle: { backgroundColor: '#eadfce', backgroundImage: 'linear-gradient(90deg, rgba(114,91,64,0.08) 1px, transparent 1px), linear-gradient(rgba(114,91,64,0.08) 1px, transparent 1px)' },
    canvasBackground: {
      backgroundColor: 'color-mix(in srgb, var(--color-bg-primary) 80%, #d4b998)',
      backgroundImage: 'linear-gradient(90deg, color-mix(in srgb, var(--journal-canvas-dot) 80%, transparent) 1px, transparent 1px), linear-gradient(color-mix(in srgb, var(--journal-canvas-dot) 80%, transparent) 1px, transparent 1px)',
      backgroundSize: '28px 28px',
    },
  },
  {
    id: 'maple',
    labelKey: 'journalEditor.background.maple',
    descriptionKey: 'journalCreate.background.maple.description',
    swatch: '#efd0a4',
    previewStyle: { backgroundColor: '#f4dfbd', backgroundImage: 'radial-gradient(circle at 16% 24%, rgba(184,86,52,0.2) 0 3px, transparent 4px), radial-gradient(rgba(109,77,53,0.16) 1px, transparent 1px)', backgroundSize: '64px 52px, 18px 18px' },
    canvasBackground: {
      backgroundColor: 'color-mix(in srgb, var(--color-bg-primary) 78%, #efbd75)',
      backgroundImage: 'radial-gradient(circle at 16% 24%, rgba(184,86,52,0.22) 0 3px, transparent 4px), radial-gradient(var(--journal-canvas-dot) 1px, transparent 1px)',
      backgroundSize: '64px 52px, 18px 18px',
    },
  },
  {
    id: 'envelope',
    labelKey: 'journalEditor.background.envelope',
    descriptionKey: 'journalCreate.background.envelope.description',
    swatch: '#efe4d3',
    previewStyle: { backgroundColor: '#f2e7d7', backgroundImage: 'linear-gradient(30deg, transparent 49.7%, rgba(135,104,76,0.16) 50%, transparent 50.3%), linear-gradient(150deg, transparent 49.7%, rgba(135,104,76,0.13) 50%, transparent 50.3%)' },
    canvasBackground: {
      backgroundColor: 'color-mix(in srgb, var(--color-bg-primary) 84%, #dfc39f)',
      backgroundImage: 'linear-gradient(30deg, transparent 49.7%, color-mix(in srgb, var(--journal-canvas-dot) 90%, transparent) 50%, transparent 50.3%), linear-gradient(150deg, transparent 49.7%, color-mix(in srgb, var(--journal-canvas-dot) 80%, transparent) 50%, transparent 50.3%)',
      backgroundSize: '100% 100%',
    },
  },
  {
    id: 'grid',
    labelKey: 'journalEditor.background.grid',
    descriptionKey: 'journalCreate.background.grid.description',
    swatch: '#eef0f4',
    previewStyle: { backgroundColor: '#f6f7fa', backgroundImage: 'linear-gradient(rgba(90,100,125,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(90,100,125,0.18) 1px, transparent 1px)', backgroundSize: '24px 24px' },
    canvasBackground: {
      backgroundColor: 'var(--journal-canvas-bg)',
      backgroundImage: 'linear-gradient(var(--journal-canvas-dot) 1px, transparent 1px), linear-gradient(90deg, var(--journal-canvas-dot) 1px, transparent 1px)',
      backgroundSize: '24px 24px',
    },
  },
  {
    id: 'postcard',
    labelKey: 'journalEditor.background.loose',
    descriptionKey: 'journalCreate.background.postcard.description',
    swatch: '#f1e4d8',
    previewStyle: { backgroundColor: '#f6eee4', backgroundImage: 'linear-gradient(90deg, rgba(167,88,64,0.34) 0 8px, transparent 8px), radial-gradient(rgba(118,93,78,0.18) 1px, transparent 1px)', backgroundSize: '44px 100%, 18px 18px' },
    canvasBackground: {
      backgroundColor: 'var(--journal-canvas-bg)',
      backgroundImage: 'linear-gradient(90deg, color-mix(in srgb, var(--color-accent) 34%, transparent) 0 8px, transparent 8px), radial-gradient(var(--journal-canvas-dot) 1px, transparent 1px)',
      backgroundSize: '44px 100%, 18px 18px',
    },
  },
]

export function normalizeJournalBackgroundId(background: string | null | undefined): JournalBackgroundPresetId {
  if (background === 'blush') return 'sakura'
  if (background === 'blue') return 'blue-hour'
  if (background === 'mint') return 'paper'
  return JOURNAL_BACKGROUND_PRESETS.some((preset) => preset.id === background)
    ? background as JournalBackgroundPresetId
    : 'paper'
}

export function getJournalBackgroundPreset(background: string | null | undefined): JournalBackgroundPreset {
  const id = normalizeJournalBackgroundId(background)
  return JOURNAL_BACKGROUND_PRESETS.find((preset) => preset.id === id) || JOURNAL_BACKGROUND_PRESETS[0]
}
