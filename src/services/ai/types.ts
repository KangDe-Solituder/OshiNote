export type AiProviderId = 'openai' | 'claude' | 'gemini' | 'local'

export type Language = 'ja' | 'zh' | 'en'

export const LANGUAGE_LABELS: Record<Language, string> = {
  ja: '日本語',
  zh: '中文',
  en: 'English',
}

export interface RefineOptions {
  tone?: 'casual' | 'polite' | 'emotional' | 'neutral'
  focus?: 'grammar' | 'phrasing' | 'politeness' | 'general'
  context?: string
}

export interface AiProvider {
  readonly id: AiProviderId
  readonly name: string
  translate(text: string, from: Language, to: Language, context?: string): Promise<string>
  refine(text: string, options: RefineOptions): Promise<string>
}

export interface AiConfig {
  provider: AiProviderId
  openai: { apiKey: string; model: string; baseUrl: string }
  claude: { apiKey: string; model: string; baseUrl: string }
  gemini: { apiKey: string; model: string; baseUrl: string }
  local: { apiKey: string; model: string; baseUrl: string }
  enabled: boolean
}

export const DEFAULT_AI_CONFIG: AiConfig = {
  provider: 'openai',
  openai: { apiKey: '', model: 'gpt-4o', baseUrl: 'https://api.openai.com/v1' },
  claude: { apiKey: '', model: 'claude-sonnet-4-6', baseUrl: 'https://api.anthropic.com/v1' },
  gemini: { apiKey: '', model: 'gemini-2.0-flash', baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
  local: { apiKey: '', model: 'local-model', baseUrl: 'http://localhost:11434/v1' },
  enabled: false,
}
