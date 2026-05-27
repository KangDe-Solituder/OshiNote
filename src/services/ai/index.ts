import type { AiProvider, AiProviderId, AiConfig } from './types'
import { createOpenAiProvider } from './openaiProvider'
import { createClaudeProvider } from './claudeProvider'
import { createGeminiProvider } from './geminiProvider'
import { createLocalProvider } from './localProvider'

export type { AiProvider, AiProviderId, AiConfig, Language, RefineOptions } from './types'
export { LANGUAGE_LABELS, DEFAULT_AI_CONFIG } from './types'

export function createProvider(config: AiConfig): AiProvider | null {
  const { provider } = config
  if (!config.enabled) return null

  const providerConfig = config[provider]
  if (!providerConfig.apiKey && provider !== 'local') return null

  switch (provider) {
    case 'openai':
      return createOpenAiProvider(providerConfig)
    case 'claude':
      return createClaudeProvider(providerConfig)
    case 'gemini':
      return createGeminiProvider(providerConfig)
    case 'local':
      return createLocalProvider(providerConfig)
    default:
      return null
  }
}

export function getProviderName(id: AiProviderId): string {
  switch (id) {
    case 'openai': return 'OpenAI'
    case 'claude': return 'Claude'
    case 'gemini': return 'Gemini'
    case 'local': return 'Local API'
  }
}
