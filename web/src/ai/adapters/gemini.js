import { fetchWithTimeout } from '../fetchWithTimeout.js'

const DIRECT_BASE = 'https://generativelanguage.googleapis.com'

/**
 * In dev, Vite proxies `/api/gemini` and appends `?key=` from .env (see vite.config.js).
 * @param {{ systemPrompt: string; userMessage: string; maxTokens?: number }} params
 * @returns {Promise<string>}
 */
export async function call({ systemPrompt, userMessage, maxTokens }) {
  const useDevProxy = import.meta.env.DEV
  const modelId =
    import.meta.env.VITE_GEMINI_MODEL?.trim() || 'gemini-1.5-flash'
  const path = `/v1beta/models/${encodeURIComponent(modelId)}:generateContent`

  let url
  if (useDevProxy) {
    url = `/api/gemini${path}`
  } else {
    const apiKey =
      import.meta.env.VITE_GEMINI_API_KEY?.trim() ||
      import.meta.env.VITE_GOOGLE_API_KEY?.trim()
    if (!apiKey) {
      throw new Error(
        'Missing VITE_GEMINI_API_KEY or VITE_GOOGLE_API_KEY (production static builds need a same-origin API proxy)',
      )
    }
    url = `${DIRECT_BASE}${path}?key=${encodeURIComponent(apiKey)}`
  }

  let response
  try {
    response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: userMessage }],
          },
        ],
        generationConfig: {
          maxOutputTokens: maxTokens,
        },
      }),
    })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Gemini request timed out')
    }
    throw e
  }

  const rawText = await response.text()
  let data
  try {
    data = JSON.parse(rawText)
  } catch {
    throw new Error(
      `Gemini API returned non-JSON (${response.status}): ${rawText.slice(0, 240)}`,
    )
  }
  if (!response.ok) {
    const msg =
      data?.error?.message || data?.error || response.statusText || 'Gemini API error'
    throw new Error(String(msg))
  }

  const text =
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? ''
  if (typeof text !== 'string' || text === '') {
    throw new Error('Unexpected Gemini response shape')
  }
  return text
}
