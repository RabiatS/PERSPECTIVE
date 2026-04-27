/** @param {number} [ms] */
export function getAiFetchTimeoutMs(ms) {
  const raw = import.meta.env.VITE_AI_FETCH_TIMEOUT_MS
  if (raw != null && raw !== '' && Number.isFinite(Number(raw))) {
    return Math.max(1000, Math.min(120000, Number(raw)))
  }
  return ms ?? 10000
}

/**
 * @param {string} url
 * @param {RequestInit} [init]
 * @param {number} [timeoutMs]
 */
export async function fetchWithTimeout(url, init = {}, timeoutMs) {
  const ms = getAiFetchTimeoutMs(timeoutMs)
  const ctrl = new AbortController()
  const id = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(id)
  }
}
