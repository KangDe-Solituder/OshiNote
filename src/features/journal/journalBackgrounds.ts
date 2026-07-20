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

export const JOURNAL_BACKGROUND_PRESETS: JournalBackgroundPreset[] = [
  {
    id: 'paper',
    labelKey: 'journalEditor.background.paper',
    descriptionKey: 'journalCreate.background.paper.description',
    swatch: '#f7f1e8',
    previewStyle: {
      backgroundColor: '#f7f1e8',
      backgroundImage: 'linear-gradient(115deg, rgba(255,255,255,0.28), transparent 38%), linear-gradient(65deg, transparent 0 72%, rgba(112,87,65,0.05) 72% 72.4%, transparent 72.4%)',
      backgroundSize: '100% 100%',
    },
    canvasBackground: {
      backgroundColor: 'color-mix(in srgb, var(--color-bg-primary) 88%, #f7f1e8)',
      backgroundImage: 'linear-gradient(115deg, rgba(255,255,255,0.24), transparent 38%), linear-gradient(65deg, transparent 0 72%, rgba(112,87,65,0.045) 72% 72.4%, transparent 72.4%)',
      backgroundSize: '100% 100%',
    },
  },
  {
    id: 'sakura',
    labelKey: 'journalEditor.background.sakura',
    descriptionKey: 'journalCreate.background.sakura.description',
    swatch: '#f8dce5',
    previewStyle: {
      backgroundColor: '#fae8ee',
      backgroundImage: 'radial-gradient(ellipse 22px 12px at 7% 9%, rgba(255,255,255,0.72) 0 46%, transparent 53%), radial-gradient(ellipse 16px 9px at 17% 16%, rgba(239,139,170,0.24) 0 46%, transparent 53%), radial-gradient(ellipse 20px 11px at 92% 87%, rgba(255,255,255,0.6) 0 46%, transparent 53%), radial-gradient(ellipse 14px 8px at 84% 94%, rgba(232,125,160,0.2) 0 46%, transparent 53%), linear-gradient(150deg, rgba(255,255,255,0.24), transparent 55%)',
      backgroundSize: '100% 100%',
    },
    canvasBackground: {
      backgroundColor: 'color-mix(in srgb, var(--color-bg-primary) 78%, #f8bfd0)',
      backgroundImage: 'radial-gradient(ellipse 26px 14px at 7% 9%, rgba(255,255,255,0.55) 0 46%, transparent 53%), radial-gradient(ellipse 19px 10px at 17% 16%, rgba(239,139,170,0.2) 0 46%, transparent 53%), radial-gradient(ellipse 23px 12px at 92% 87%, rgba(255,255,255,0.42) 0 46%, transparent 53%), radial-gradient(ellipse 16px 9px at 84% 94%, rgba(232,125,160,0.18) 0 46%, transparent 53%), linear-gradient(150deg, rgba(255,255,255,0.2), transparent 55%)',
      backgroundSize: '100% 100%',
    },
  },
  {
    id: 'blue-hour',
    labelKey: 'journalEditor.background.blueHour',
    descriptionKey: 'journalCreate.background.blueHour.description',
    swatch: '#cfe0f4',
    previewStyle: {
      backgroundColor: '#dbe9f7',
      backgroundImage: 'radial-gradient(circle at 88% 13%, rgba(255,255,255,0.7) 0 15px, transparent 16px), linear-gradient(135deg, rgba(69,115,161,0.14), transparent 42%), linear-gradient(12deg, transparent 0 76%, rgba(57,91,128,0.1) 76% 76.6%, transparent 76.6%)',
      backgroundSize: '100% 100%',
    },
    canvasBackground: {
      backgroundColor: 'color-mix(in srgb, var(--color-bg-primary) 74%, #b8d4ef)',
      backgroundImage: 'radial-gradient(circle at 88% 13%, rgba(255,255,255,0.5) 0 20px, transparent 21px), linear-gradient(135deg, rgba(255,255,255,0.22), transparent 42%), linear-gradient(12deg, transparent 0 76%, rgba(57,91,128,0.08) 76% 76.6%, transparent 76.6%)',
      backgroundSize: '100% 100%',
    },
  },
  {
    id: 'rainy-cafe',
    labelKey: 'journalEditor.background.rainyCafe',
    descriptionKey: 'journalCreate.background.rainyCafe.description',
    swatch: '#d8c7b2',
    previewStyle: {
      backgroundColor: '#eadfce',
      backgroundImage: 'radial-gradient(ellipse 80px 38px at 82% 16%, rgba(119,86,57,0.11), transparent 70%), linear-gradient(112deg, transparent 0 64%, rgba(100,82,73,0.1) 64% 64.8%, transparent 64.8%)',
      backgroundSize: '100% 100%, 86px 58px',
    },
    canvasBackground: {
      backgroundColor: 'color-mix(in srgb, var(--color-bg-primary) 80%, #d4b998)',
      backgroundImage: 'radial-gradient(ellipse 100px 46px at 82% 16%, rgba(119,86,57,0.08), transparent 70%), linear-gradient(112deg, transparent 0 64%, rgba(100,82,73,0.075) 64% 64.8%, transparent 64.8%)',
      backgroundSize: '100% 100%, 86px 58px',
    },
  },
  {
    id: 'maple',
    labelKey: 'journalEditor.background.maple',
    descriptionKey: 'journalCreate.background.maple.description',
    swatch: '#efd0a4',
    previewStyle: {
      backgroundColor: '#f4dfbd',
      backgroundImage: 'radial-gradient(ellipse 22px 10px at 8% 10%, rgba(184,86,52,0.24) 0 46%, transparent 53%), radial-gradient(ellipse 17px 8px at 18% 7%, rgba(214,124,66,0.2) 0 46%, transparent 53%), radial-gradient(ellipse 20px 9px at 91% 88%, rgba(184,86,52,0.2) 0 46%, transparent 53%), radial-gradient(ellipse 15px 8px at 84% 94%, rgba(214,124,66,0.18) 0 46%, transparent 53%), linear-gradient(145deg, rgba(255,255,255,0.2), transparent 58%)',
      backgroundSize: '100% 100%',
    },
    canvasBackground: {
      backgroundColor: 'color-mix(in srgb, var(--color-bg-primary) 78%, #efbd75)',
      backgroundImage: 'radial-gradient(ellipse 26px 12px at 8% 10%, rgba(184,86,52,0.18) 0 46%, transparent 53%), radial-gradient(ellipse 20px 9px at 18% 7%, rgba(214,124,66,0.16) 0 46%, transparent 53%), radial-gradient(ellipse 23px 11px at 91% 88%, rgba(184,86,52,0.16) 0 46%, transparent 53%), radial-gradient(ellipse 18px 9px at 84% 94%, rgba(214,124,66,0.14) 0 46%, transparent 53%), linear-gradient(145deg, rgba(255,255,255,0.16), transparent 58%)',
      backgroundSize: '100% 100%',
    },
  },
  {
    id: 'envelope',
    labelKey: 'journalEditor.background.envelope',
    descriptionKey: 'journalCreate.background.envelope.description',
    swatch: '#efe4d3',
    previewStyle: { backgroundColor: '#f2e7d7', backgroundImage: 'linear-gradient(30deg, transparent 49.3%, rgba(135,104,76,0.15) 49.7% 50.3%, transparent 50.7%), linear-gradient(150deg, transparent 49.3%, rgba(135,104,76,0.12) 49.7% 50.3%, transparent 50.7%)' },
    canvasBackground: {
      backgroundColor: 'color-mix(in srgb, var(--color-bg-primary) 84%, #dfc39f)',
      backgroundImage: 'linear-gradient(30deg, transparent 49.3%, rgba(135,104,76,0.13) 49.7% 50.3%, transparent 50.7%), linear-gradient(150deg, transparent 49.3%, rgba(135,104,76,0.1) 49.7% 50.3%, transparent 50.7%)',
      backgroundSize: '100% 100%',
    },
  },
  {
    id: 'grid',
    labelKey: 'journalEditor.background.grid',
    descriptionKey: 'journalCreate.background.grid.description',
    swatch: '#eef0f4',
    previewStyle: { backgroundColor: '#f6f7fa', backgroundImage: 'linear-gradient(rgba(90,100,125,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(90,100,125,0.14) 1px, transparent 1px)', backgroundSize: '30px 30px' },
    canvasBackground: {
      backgroundColor: 'color-mix(in srgb, var(--color-bg-primary) 92%, #eef0f4)',
      backgroundImage: 'linear-gradient(rgba(90,100,125,0.11) 1px, transparent 1px), linear-gradient(90deg, rgba(90,100,125,0.11) 1px, transparent 1px)',
      backgroundSize: '30px 30px',
    },
  },
  {
    id: 'postcard',
    labelKey: 'journalEditor.background.loose',
    descriptionKey: 'journalCreate.background.postcard.description',
    swatch: '#f1e4d8',
    previewStyle: {
      backgroundColor: '#f6eee4',
      backgroundImage: 'linear-gradient(90deg, rgba(167,88,64,0.34) 0 8px, transparent 8px), linear-gradient(90deg, transparent 0 70%, rgba(118,93,78,0.16) 70% 70.6%, transparent 70.6%), repeating-linear-gradient(0deg, transparent 0 23px, rgba(118,93,78,0.1) 23px 24px)',
      backgroundSize: '44px 100%, 100% 100%, 100% 24px',
    },
    canvasBackground: {
      backgroundColor: 'color-mix(in srgb, var(--color-bg-primary) 90%, #f1e4d8)',
      backgroundImage: 'linear-gradient(90deg, rgba(167,88,64,0.3) 0 8px, transparent 8px), linear-gradient(90deg, transparent 0 70%, rgba(118,93,78,0.13) 70% 70.6%, transparent 70.6%), repeating-linear-gradient(0deg, transparent 0 23px, rgba(118,93,78,0.08) 23px 24px)',
      backgroundSize: '44px 100%, 100% 100%, 100% 24px',
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
