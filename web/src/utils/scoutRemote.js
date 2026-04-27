import { fetchWithTimeout } from '../ai/fetchWithTimeout.js'

/**
 * POST numeric feature matrix; expect { scores: number[] } aligned with row indices 0..n-1
 * @param {number[][]} features rows x dims
 * @returns {Promise<number[] | null>}
 */
export async function fetchRemoteAnomalyScores(features) {
  const url = import.meta.env.VITE_SCOUT_API_URL?.trim()
  if (!url) return null
  if (features.length === 0) return null

  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features }),
      },
      15000,
    )
    const text = await res.text()
    if (!res.ok) return null
    const data = JSON.parse(text)
    const scores = data?.scores
    if (!Array.isArray(scores) || scores.length !== features.length)
      return null
    return scores.map((s) => {
      const n = Number(s)
      return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0
    })
  } catch {
    return null
  }
}
