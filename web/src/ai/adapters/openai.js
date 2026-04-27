import { fetchWithTimeout } from '../fetchWithTimeout.js'

const DIRECT_BASE = 'https://api.openai.com'

/**
 * In dev, Vite proxies `/api/openai` and injects Authorization from .env (see vite.config.js).
 * @param {{ systemPrompt: string; userMessage: string; maxTokens?: number }} params
 * @returns {Promise<string>}
 */
export async function call({ systemPrompt, userMessage, maxTokens }) {
  const useDevProxy = import.meta.env.DEV
  const url = useDevProxy
    ? '/api/openai/v1/chat/completions'
    : `${DIRECT_BASE}/v1/chat/completions`

  const headers = { 'Content-Type': 'application/json' }
  if (!useDevProxy) {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY
    if (!apiKey) {
      throw new Error(
        'Missing VITE_OPENAI_API_KEY (production static builds need a same-origin API proxy)',
      )
    }
    headers.Authorization = `Bearer ${apiKey}`
  }

  const model =
    import.meta.env.VITE_OPENAI_MODEL?.trim() || 'gpt-4o'

  let response
  try {
    response = await fetchWithTimeout(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: maxTokens,
      }),
    })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('OpenAI request timed out')
    }
    throw e
  }

  const rawText = await response.text()
  let data
  try {
    data = JSON.parse(rawText)
  } catch {
    throw new Error(
      `OpenAI API returned non-JSON (${response.status}): ${rawText.slice(0, 240)}`,
    )
  }
  if (!response.ok) {
    const msg =
      data?.error?.message || data?.error || response.statusText || 'OpenAI API error'
    throw new Error(String(msg))
  }

  const text = data?.choices?.[0]?.message?.content
  if (typeof text !== 'string') {
    throw new Error('Unexpected OpenAI response shape')
  }
  return text
}
