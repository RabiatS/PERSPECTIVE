const OPENAI = 'https://api.openai.com'
const ANTHROPIC = 'https://api.anthropic.com'
const GEMINI = 'https://generativelanguage.googleapis.com'

function timeoutFetch(url, init, ms = 12000) {
  const ctrl = new AbortController()
  const id = setTimeout(() => ctrl.abort(), ms)
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() =>
    clearTimeout(id),
  )
}

async function completeOpenAI(systemPrompt, userMessage, maxTokens) {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY not set on server')
  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o'
  const res = await timeoutFetch(`${OPENAI}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: maxTokens,
    }),
  })
  const raw = await res.text()
  let data
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error(`OpenAI non-JSON (${res.status}): ${raw.slice(0, 200)}`)
  }
  if (!res.ok) {
    throw new Error(data?.error?.message || data?.error || 'OpenAI error')
  }
  const text = data?.choices?.[0]?.message?.content
  if (typeof text !== 'string') throw new Error('Bad OpenAI response shape')
  return text
}

async function completeAnthropic(systemPrompt, userMessage, maxTokens) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not set on server')
  const model =
    process.env.ANTHROPIC_MODEL?.trim() || 'claude-3-5-sonnet-20241022'
  const res = await timeoutFetch(`${ANTHROPIC}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })
  const raw = await res.text()
  let data
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error(`Anthropic non-JSON (${res.status}): ${raw.slice(0, 200)}`)
  }
  if (!res.ok) {
    throw new Error(data?.error?.message || data?.error || 'Anthropic error')
  }
  const text = data?.content?.[0]?.text
  if (typeof text !== 'string') throw new Error('Bad Anthropic response shape')
  return text
}

async function completeGemini(systemPrompt, userMessage, maxTokens) {
  const key =
    process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim()
  if (!key) throw new Error('GEMINI_API_KEY not set on server')
  const modelId =
    process.env.GEMINI_MODEL?.trim() || 'gemini-1.5-flash'
  const path = `/v1beta/models/${encodeURIComponent(modelId)}:generateContent`
  const url = `${GEMINI}${path}?key=${encodeURIComponent(key)}`
  const res = await timeoutFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  })
  const raw = await res.text()
  let data
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error(`Gemini non-JSON (${res.status}): ${raw.slice(0, 200)}`)
  }
  if (!res.ok) {
    throw new Error(data?.error?.message || data?.error || 'Gemini error')
  }
  const text =
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? ''
  if (!text) throw new Error('Bad Gemini response shape')
  return text
}

/**
 * @param {{ provider?: string; systemPrompt?: string; userMessage?: string; maxTokens?: number }} body
 */
export async function complete(body) {
  const provider = String(body?.provider || 'anthropic').toLowerCase()
  const systemPrompt = body?.systemPrompt
  const userMessage = body?.userMessage
  const maxTokens = Math.min(
    8000,
    Math.max(1, Number(body?.maxTokens) || 1000),
  )

  if (typeof systemPrompt !== 'string' || typeof userMessage !== 'string') {
    throw new Error('systemPrompt and userMessage must be strings')
  }

  if (provider === 'openai') {
    return completeOpenAI(systemPrompt, userMessage, maxTokens)
  }
  if (provider === 'anthropic') {
    return completeAnthropic(systemPrompt, userMessage, maxTokens)
  }
  if (provider === 'gemini') {
    return completeGemini(systemPrompt, userMessage, maxTokens)
  }
  throw new Error(`Unknown provider: ${provider}`)
}
