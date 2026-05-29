import type { AiProvider, AiProviderId } from './types'
import { LANGUAGE_LABELS } from './types'
import { invoke } from '@tauri-apps/api/core'

export function createLocalProvider(config: {
  apiKey: string
  model: string
  baseUrl: string
}): AiProvider {
  const { apiKey, model, baseUrl } = config
  const endpoint = resolveLocalEndpoint(baseUrl, 'http://localhost:1234/v1')

  async function callApi(messages: { role: string; content: string }[]): Promise<string> {
    try {
      return await requestEndpoint(endpoint, messages)
    } catch (firstError) {
      const fallbackEndpoint = getFallbackEndpoint(endpoint)
      if (!fallbackEndpoint) {
        throw firstError
      }

      try {
        return await requestEndpoint(fallbackEndpoint, messages)
      } catch (fallbackError) {
        throw new Error(
          `Local API failed. First tried ${endpoint.kind} (${endpoint.url}): ${formatError(firstError)}. Then tried ${fallbackEndpoint.kind} (${fallbackEndpoint.url}): ${formatError(fallbackError)}`,
          { cause: fallbackError }
        )
      }
    }
  }

  async function requestEndpoint(target: LocalEndpoint, messages: { role: string; content: string }[]): Promise<string> {
    const body = createRequestBody(target.kind, model, messages)

    try {
      const json = await invoke<LocalApiResponse>('post_local_ai_chat', {
        url: target.url,
        apiKey,
        body,
      })
      return extractResponseText(json)
    } catch (bridgeError) {
      if (!isTauriBridgeUnavailable(bridgeError)) {
        throw new Error(`Local API (${target.kind}, Tauri bridge, ${target.url}) failed: ${formatError(bridgeError)}`, { cause: bridgeError })
      }

      try {
        return await requestWithFetch(target, body)
      } catch (fetchError) {
        throw new Error(
          `Local API (${target.kind}, Tauri bridge unavailable, browser fetch, ${target.url}) failed: ${formatError(fetchError)}`,
          { cause: fetchError }
        )
      }
    }
  }

  async function requestWithFetch(target: LocalEndpoint, body: unknown): Promise<string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`

    const res = await fetch(target.url, { method: 'POST', headers, body: JSON.stringify(body) })
    if (!res.ok) {
      throw new Error(`Local API (${target.kind}, browser fetch, ${target.url}) error ${res.status}: ${await res.text()}`)
    }
    const json = await res.json()
    return extractResponseText(json)
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

type LocalEndpointKind = 'openai-chat-completions' | 'lmstudio-native-chat'

interface LocalEndpoint {
  kind: LocalEndpointKind
  url: string
}

interface LocalApiResponse {
  choices?: { message?: { content?: string } }[]
  output?: { content?: string; text?: string; type?: string }[] | string
  message?: { content?: string }
  content?: string
}

function resolveLocalEndpoint(baseUrl: string, fallbackBaseUrl: string): LocalEndpoint {
  const trimmed = (baseUrl || fallbackBaseUrl).trim().replace(/\/+$/, '')
  if (trimmed.endsWith('/api/v1/chat')) return { kind: 'lmstudio-native-chat', url: trimmed }
  if (trimmed.endsWith('/api/v1')) return { kind: 'lmstudio-native-chat', url: `${trimmed}/chat` }
  if (trimmed.endsWith('/chat/completions')) return { kind: 'openai-chat-completions', url: trimmed }
  if (trimmed.endsWith('/v1')) return { kind: 'openai-chat-completions', url: `${trimmed}/chat/completions` }
  return { kind: 'openai-chat-completions', url: `${trimmed}/v1/chat/completions` }
}

function getFallbackEndpoint(endpoint: LocalEndpoint): LocalEndpoint | null {
  if (endpoint.kind === 'openai-chat-completions') {
    const nativeUrl = endpoint.url.replace(/\/v1\/chat\/completions$/, '/api/v1/chat')
    return nativeUrl === endpoint.url ? null : { kind: 'lmstudio-native-chat', url: nativeUrl }
  }

  const openAiUrl = endpoint.url.replace(/\/api\/v1\/chat$/, '/v1/chat/completions')
  return openAiUrl === endpoint.url ? null : { kind: 'openai-chat-completions', url: openAiUrl }
}

function createRequestBody(kind: LocalEndpointKind, model: string, messages: { role: string; content: string }[]) {
  if (kind === 'lmstudio-native-chat') {
    return {
      model,
      input: messages.map((message) => `${message.role.toUpperCase()}:\n${message.content}`).join('\n\n'),
      temperature: 0.7,
    }
  }
  return { model, messages, temperature: 0.7 }
}

function extractResponseText(json: LocalApiResponse): string {
  const openAiText = json.choices?.[0]?.message?.content
  if (openAiText) return openAiText

  if (Array.isArray(json.output)) {
    return json.output
      .map((item) => item.content || item.text || '')
      .filter(Boolean)
      .join('\n')
  }
  if (typeof json.output === 'string') return json.output
  if (json.message?.content) return json.message.content
  if (json.content) return json.content
  return ''
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isTauriBridgeUnavailable(error: unknown): boolean {
  const message = formatError(error)
  return (
    message.includes('__TAURI_INTERNALS__') ||
    message.includes('is not a function') ||
    message.includes('not available') ||
    message.includes('not found')
  )
}
