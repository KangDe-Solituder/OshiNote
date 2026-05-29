import type { AiProvider, AiProviderId } from './types'
import { LANGUAGE_LABELS } from './types'

export function createOpenAiProvider(config: {
  apiKey: string
  model: string
  baseUrl: string
}): AiProvider {
  const { apiKey, model, baseUrl } = config
  const chatCompletionsUrl = normalizeChatCompletionsUrl(baseUrl, 'https://api.openai.com/v1')

  async function callApi(messages: { role: string; content: string }[]): Promise<string> {
    const res = await fetch(chatCompletionsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, temperature: 0.7 }),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`OpenAI API error ${res.status}: ${err}`)
    }
    const json = await res.json()
    return json.choices?.[0]?.message?.content || ''
  }

  return {
    id: 'openai' as AiProviderId,
    name: 'OpenAI',

    async translate(text, from, to, context) {
      const messages = [
        {
          role: 'system',
          content: `You are a translator. Translate from ${LANGUAGE_LABELS[from]} to ${LANGUAGE_LABELS[to]}. Preserve the emotional tone. Return only the translation.${context ? `\nContext: ${context}` : ''}`,
        },
        { role: 'user', content: text },
      ]
      return callApi(messages)
    },

    async refine(text, options) {
      const toneHint = options.tone ? `Use a ${options.tone} tone.` : ''
      const focusHint = options.focus ? `Focus on improving: ${options.focus}.` : ''
      const messages = [
        {
          role: 'system',
          content: `You are a writing assistant for VTuber fans. Help refine the user's message to their oshi. ${toneHint} ${focusHint} Improve grammar, natural phrasing, and emotional warmth. Return only the refined version.${options.context ? `\nContext about the oshi: ${options.context}` : ''}`,
        },
        { role: 'user', content: text },
      ]
      return callApi(messages)
    },
  }
}

function normalizeChatCompletionsUrl(baseUrl: string, fallbackBaseUrl: string): string {
  const trimmed = (baseUrl || fallbackBaseUrl).trim().replace(/\/+$/, '')
  if (trimmed.endsWith('/chat/completions')) return trimmed
  if (trimmed.endsWith('/v1')) return `${trimmed}/chat/completions`
  return `${trimmed}/v1/chat/completions`
}
