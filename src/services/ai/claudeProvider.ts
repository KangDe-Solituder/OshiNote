import type { AiProvider, AiProviderId } from './types'
import { LANGUAGE_LABELS } from './types'

export function createClaudeProvider(config: {
  apiKey: string
  model: string
  baseUrl: string
}): AiProvider {
  const { apiKey, model, baseUrl } = config

  async function callApi(system: string, user: string): Promise<string> {
    const res = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Claude API error ${res.status}: ${err}`)
    }
    const json = await res.json()
    return json.content?.[0]?.text || ''
  }

  return {
    id: 'claude' as AiProviderId,
    name: 'Claude',

    async translate(text, from, to, context) {
      const system = `You are a translator. Translate from ${LANGUAGE_LABELS[from]} to ${LANGUAGE_LABELS[to]}. Preserve the emotional tone. Return only the translation.${context ? `\nContext: ${context}` : ''}`
      return callApi(system, text)
    },

    async refine(text, options) {
      const toneHint = options.tone ? `Use a ${options.tone} tone.` : ''
      const focusHint = options.focus ? `Focus on improving: ${options.focus}.` : ''
      const system = `You are a writing assistant for VTuber fans. Help refine the user's message to their oshi. ${toneHint} ${focusHint} Improve grammar, natural phrasing, and emotional warmth. Return only the refined version.${options.context ? `\nContext about the oshi: ${options.context}` : ''}`
      return callApi(system, text)
    },
  }
}
