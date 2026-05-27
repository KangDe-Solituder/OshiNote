import type { AiProvider, AiProviderId } from './types'
import { LANGUAGE_LABELS } from './types'

export function createGeminiProvider(config: {
  apiKey: string
  model: string
  baseUrl: string
}): AiProvider {
  const { apiKey, model, baseUrl } = config

  async function callApi(prompt: string): Promise<string> {
    const res = await fetch(`${baseUrl}/models/${model}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7 },
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Gemini API error ${res.status}: ${err}`)
    }
    const json = await res.json()
    return json.candidates?.[0]?.content?.parts?.[0]?.text || ''
  }

  return {
    id: 'gemini' as AiProviderId,
    name: 'Gemini',

    async translate(text, from, to, context) {
      const prompt = `Translate from ${LANGUAGE_LABELS[from]} to ${LANGUAGE_LABELS[to]}. Preserve the emotional tone. Return only the translation.${context ? `\nContext: ${context}` : ''}\n\nText: ${text}`
      return callApi(prompt)
    },

    async refine(text, options) {
      const toneHint = options.tone ? `Use a ${options.tone} tone.` : ''
      const focusHint = options.focus ? `Focus on improving: ${options.focus}.` : ''
      const prompt = `You are a writing assistant for VTuber fans. Help refine the user's message to their oshi. ${toneHint} ${focusHint} Improve grammar, natural phrasing, and emotional warmth. Return only the refined version.${options.context ? `\nContext about the oshi: ${options.context}` : ''}\n\nText: ${text}`
      return callApi(prompt)
    },
  }
}
