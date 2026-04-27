import { fetchWithTimeout } from '../fetchWithTimeout.js'

const DIRECT_BASE = 'https://api.anthropic.com'

/**
 * Browser calls to provider origins are blocked by CORS. In dev, Vite proxies `/api/anthropic`.
 * @param {{ systemPrompt: string; userMessage: string; maxTokens?: number }} params
 * @returns {Promise<string>}
 */
export async function call({ systemPrompt, userMessage, maxTokens }) {
  const useDevProxy = import.meta.env.DEV
  const url = useDevProxy
    ? '/api/anthropic/v1/messages'
    : `${DIRECT_BASE}/v1/messages`

  const headers = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
  }
  if (!useDevProxy) {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error(
        'Missing VITE_ANTHROPIC_API_KEY (production static builds need a same-origin API proxy)',
      )
    }
    headers['x-api-key'] = apiKey
  }

  let response
  try {
    response = await fetchWithTimeout(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model:
          import.meta.env.VITE_ANTHROPIC_MODEL?.trim() ||
          'claude-3-5-sonnet-20241022',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Anthropic request timed out')
    }
    throw e
  }

  const rawText = await response.text()
  let data
  try {
    data = JSON.parse(rawText)
  } catch {
    throw new Error(
      `Anthropic API returned non-JSON (${response.status}): ${rawText.slice(0, 240)}`,
    )
  }
  if (!response.ok) {
    const msg =
      data?.error?.message || data?.error || response.statusText || 'Anthropic API error'
    throw new Error(String(msg))
  }

  const text = data?.content?.[0]?.text
  if (typeof text !== 'string') {
    throw new Error('Unexpected Anthropic response shape')
  }
  return text
}
