/**
 * Central LLM usage policy — tokens only when explicitly enabled per feature.
 *
 * Defaults (zero / minimal LLM tokens):
 * - LENS: heuristic classification unless VITE_AI_LENS_LLM=true
 * - SCOUT: anomaly + correlation pins without LLM unless VITE_AI_SCOUT_PIN_LLM=true
 * - CURATOR: PCA axes without LLM unless VITE_AI_CURATOR_LLM=true
 *
 * Optional gateway (keys never in browser bundle):
 * - VITE_AI_BACKEND_URL=http://localhost:8787 → POST /v1/complete (see /server)
 *
 * Disable SCOUT work entirely (no stats, no pins):
 * - VITE_AI_SCOUT_ENABLED=false
 */

function isExplicitlyOff(key) {
  const v = import.meta.env[key]
  if (v === undefined || v === '') return false
  const s = String(v).toLowerCase()
  return s === 'false' || v === '0' || s === 'off' || s === 'no'
}

function isExplicitlyOn(key) {
  const v = import.meta.env[key]
  if (v === undefined || v === '') return false
  const s = String(v).toLowerCase()
  return s === 'true' || v === '1' || s === 'on' || s === 'yes'
}

/** LENS LLM — opt-in only (default: heuristic, no LENS tokens) */
export function isLensLlmEnabled() {
  return isExplicitlyOn('VITE_AI_LENS_LLM')
}

/** SCOUT pipeline (detection + pins). Default on. Set false to skip all SCOUT work. */
export function isScoutPipelineEnabled() {
  return !isExplicitlyOff('VITE_AI_SCOUT_ENABLED')
}

/** SCOUT batched pin copy LLM — opt-in only */
export function isScoutPinCopyLlmEnabled() {
  return isExplicitlyOn('VITE_AI_SCOUT_PIN_LLM')
}

/** CURATOR rationale LLM — opt-in only */
export function isCuratorRationaleLlmEnabled() {
  return isExplicitlyOn('VITE_AI_CURATOR_LLM')
}

export function getAiBackendBaseUrl() {
  return import.meta.env.VITE_AI_BACKEND_URL?.replace(/\/$/, '') ?? ''
}

export function isBackendAiEnabled() {
  return Boolean(getAiBackendBaseUrl())
}
