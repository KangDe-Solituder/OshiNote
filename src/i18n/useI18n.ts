import { useCallback } from 'react'
import { useLanguageStore } from '../stores/languageStore'
import { translate, type TranslationKey } from './translations'

type TranslationParams = Record<string, string | number>

export function useI18n() {
  const locale = useLanguageStore((state) => state.locale)

  const t = useCallback(
    (key: TranslationKey, params?: TranslationParams) => translate(locale, key, params),
    [locale]
  )

  return { locale, t }
}
