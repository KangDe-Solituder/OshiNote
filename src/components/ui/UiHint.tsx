import type { HTMLAttributes } from 'react'
import { useThemeStore } from '../../stores/themeStore'

/** Optional interface guidance only: never wrap user content, status or warnings. */
export function UiHint({ as: Tag = 'p', ...props }: HTMLAttributes<HTMLElement> & { as?: 'p' | 'span' }) {
  const simpleMode = useThemeStore(state => state.simpleMode)
  return simpleMode ? null : <Tag {...props} />
}
