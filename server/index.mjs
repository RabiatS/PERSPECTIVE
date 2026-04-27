/**
 * Minimal AI gateway for Spatial Viz SPA.
 *
 * POST /v1/complete
 * Body: { provider: "openai"|"anthropic"|"gemini", systemPrompt, userMessage, maxTokens? }
 * Response: { text: string } or { error: string }
 *
 * Env (never commit real keys):
 *   OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY
 *   OPENAI_MODEL, ANTHROPIC_MODEL, GEMINI_MODEL (optional)
 *   PORT (default 8787), ALLOW_ORIGIN (default http://localhost:5173)
 */
import http from 'node:http'
import { URL } from 'node:url'

const PORT = Number(process.env.PORT) || 8787
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || 'http://localhost:5173'

const OPENAI_KEY = process.env.OPENAI_API_KEY || ''
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || ''
const GEMINI_KEY =
  process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ''

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o'
const ANTHROPIC_MODEL =
  process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022'
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash'

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function json(res, status, body) {
  cors(res)
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

async function completeOpenAI(systemPrompt, userMessage, maxTokens) {
  if (!OPENAI_KEY) throw new Error('OPENAI_API_KEY not set on server')
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: maxTokens,
    }),
  })
  const data = await r.json()
  if (!r.ok) {
    throw new Error(data?.error?.message || data?.error || r.statusText)
  }
  const text = data?.choices?.[0]?.message?.content
  if (typeof text !== 'string') throw new Error('Bad OpenAI response shape')
  return text
}

async function completeAnthropic(systemPrompt, userMessage, maxTokens) {
  if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_API_KEY not set on server')
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })
  const data = await r.json()
  if (!r.ok) {
    throw new Error(data?.error?.message || data?.error || r.statusText)
  }
  const text = data?.content?.[0]?.text
  if (typeof text !== 'string') throw new Error('Bad Anthropic response shape')
  return text
}

async function completeGemini(systemPrompt, userMessage, maxTokens) {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY not set on server')
  const mid = encodeURIComponent(GEMINI_MODEL)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${mid}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  })
  const data = await r.json()
  if (!r.ok) {
    throw new Error(data?.error?.message || data?.error || r.statusText)
  }
  const text =
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? ''
  if (!text) throw new Error('Bad Gemini response shape')
  return text
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    cors(res)
    res.writeHead(204)
    res.end()
    return
  }

  const u = new URL(req.url || '/', `http://${req.headers.host}`)

  if (req.method === 'GET' && u.pathname === '/health') {
    json(res, 200, { ok: true })
    return
  }

  if (req.method !== 'POST' || u.pathname !== '/v1/complete') {
    json(res, 404, { error: 'Not found' })
    return
  }

  let body = ''
  for await (const chunk of req) body += chunk

  let payload
  try {
    payload = JSON.parse(body || '{}')
  } catch {
    json(res, 400, { error: 'Invalid JSON' })
    return
  }

  const provider = String(payload.provider || '').toLowerCase()
  const systemPrompt = String(payload.systemPrompt || '')
  const userMessage = String(payload.userMessage || '')
  const maxTokens = Math.min(
    4000,
    Math.max(1, Number(payload.maxTokens) || 1000),
  )

  if (!systemPrompt || !userMessage) {
    json(res, 400, { error: 'systemPrompt and userMessage required' })
    return
  }

  try {
    let text
    if (provider === 'openai') {
      text = await completeOpenAI(systemPrompt, userMessage, maxTokens)
    } else if (provider === 'anthropic') {
      text = await completeAnthropic(systemPrompt, userMessage, maxTokens)
    } else if (provider === 'gemini') {
      text = await completeGemini(systemPrompt, userMessage, maxTokens)
    } else {
      json(res, 400, { error: 'provider must be openai, anthropic, or gemini' })
      return
    }
    json(res, 200, { text })
  } catch (e) {
    json(res, 502, {
      error: e instanceof Error ? e.message : String(e),
    })
  }
})

server.listen(PORT, () => {
  console.error(
    `[spatial-viz-ai-gateway] http://127.0.0.1:${PORT}  CORS ${ALLOW_ORIGIN}`,
  )
})
