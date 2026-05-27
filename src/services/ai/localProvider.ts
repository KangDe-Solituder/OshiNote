import type { AiProvider, AiProviderId } from './types'
import { LANGUAGE_LABELS } from './types'

export function createLocalProvider(config: {
  apiKey: string
  model: string
  baseUrl: string
}): AiProvider {
  const { apiKey, model, baseUrl } = config

  async function callApi(messages: { role: string; content: string }[]): Promise<string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, messages, temperature: 0.7 }),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Local API error ${res.status}: ${err}`)
    }
    const json = await res.json()
    return json.choices?.[0]?.message?.content || ''
  }

  return {
    id: 'local' as AiProviderId,
    name: 'Local API',

    async translate(text, from, to, context) {
      const messages = [
        {
          role: 'system',
          content: `Translate from ${LANGUAGE_LABELS[from]} to ${LANGUAGE_LABELS[to]}. Preserve emotional tone. Return only the translation.${context ? `\nContext: ${context}` : ''}`,
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
          content: `You are a writing assistant for VTuber fans. ${toneHint} ${focusHint} Improve grammar, natural phrasing, and emotional warmth. Return only the refined version.${options.context ? `\nContext: ${options.context}` : ''}`,
        },
        { role: 'user', content: text },
      ]
      return callApi(messages)
    },
  }
}
