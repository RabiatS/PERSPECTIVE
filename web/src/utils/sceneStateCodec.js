/**
 * @param {Record<string, unknown>} state
 */
export function encodeSceneState(state) {
  const json = JSON.stringify(state)
  return btoa(unescape(encodeURIComponent(json)))
}

/**
 * @param {string} b64
 * @returns {Record<string, unknown> | null}
 */
export function decodeSceneState(b64) {
  try {
    const json = decodeURIComponent(escape(atob(b64)))
    return JSON.parse(json)
  } catch {
    return null
  }
}
