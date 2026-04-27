import { fetchWithTimeout } from './fetchWithTimeout.js'
import { getAiBackendBaseUrl } from './aiPolicy.js'

const ALLOWED = /** @type {const} */ (['anthropic', 'openai', 'gemini'])

/** @param {number} ms */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Returns true for transient network/timeout failures that are worth retrying.
 * Does NOT retry on auth errors, rate-limits, or bad-request HTTP responses.
 * @param {unknown} err
 */
function isRetryable(err) {
  if (!(err instanceof Error)) return false
  const msg = err.message.toLowerCase()
  return (
    err.name === 'AbortError' ||
    err.name === 'TypeError' ||
    msg.includes('timed out') ||
    msg.includes('network') ||
    msg.includes('failed to fetch')
  )
}

/**
 * @param {{ systemPrompt: string; userMessage: string; maxTokens?: number }} params
 * @returns {Promise<string>}
 */
async function callOnce({ systemPrompt, userMessage, maxTokens = 1000 }) {
  const backend = getAiBackendBaseUrl()
  const provider = String(
    import.meta.env.VITE_AI_PROVIDER || 'anthropic',
  ).toLowerCase()

  if (!ALLOWED.includes(provider)) {
    throw new Error(
      `Invalid VITE_AI_PROVIDER "${import.meta.env.VITE_AI_PROVIDER}". Use anthropic, openai, or gemini`,
    )
  }

  if (backend) {
    let response
    try {
      response = await fetchWithTimeout(
        `${backend}/v1/complete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider,
            systemPrompt,
            userMessage,
            maxTokens,
          }),
        },
        12000,
      )
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        throw new Error('AI backend request timed out')
      }
      throw e
    }
    const rawText = await response.text()
    let data
    try {
      data = JSON.parse(rawText)
    } catch {
      throw new Error(
        `AI backend returned non-JSON (${response.status}): ${rawText.slice(0, 240)}`,
      )
    }
    if (!response.ok) {
      throw new Error(String(data?.error || data?.message || response.statusText))
    }
    const text = data?.text
    if (typeof text !== 'string') {
      throw new Error('AI backend response missing text')
    }
    return text
  }

  const mod = await import(`./adapters/${provider}.js`)
  return mod.call({ systemPrompt, userMessage, maxTokens })
}

/**
 * Calls the configured AI provider, with one automatic retry (1.5 s delay)
 * on transient network / timeout failures.
 * @param {{ systemPrompt: string; userMessage: string; maxTokens?: number }} params
 * @returns {Promise<string>}
 */
export async function callAI(params) {
  try {
    return await callOnce(params)
  } catch (firstErr) {
    if (!isRetryable(firstErr)) throw firstErr
    await sleep(1500)
    return await callOnce(params)
  }
}
