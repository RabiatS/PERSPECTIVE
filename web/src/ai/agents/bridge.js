import { sanitizeFilename } from '../../utils/sanitizeFilename.js'

/**
 * @param {string} name
 */
export function detectFormatFromName(name) {
  const lower = name.toLowerCase()
  if (lower.endsWith('.wav') || lower.endsWith('.mp3')) return 'audio'
  if (lower.endsWith('.geojson')) return 'geojson'
  if (lower.endsWith('.csv')) return 'csv'
  if (lower.endsWith('.json')) return 'json'
  return 'unknown'
}

/**
 * @param {unknown} lensOutput
 * @param {import('../../store/pinTypes.js').ScoutPin[]} scoutPins
 * @param {{ name?: string } | null} datasetMeta
 * @param {Record<string, unknown>} [extras] — optional BRIDGE fields (scene summary, etc.)
 */
export function buildInsightReport(lensOutput, scoutPins, datasetMeta, extras = {}) {
  return {
    ...extras,
    exportedAt: new Date().toISOString(),
    dataset: datasetMeta?.name ?? null,
    lens: lensOutput,
    scoutPins,
  }
}

/**
 * BRIDGE: single object from current workspace slice (LENS + SCOUT + scene context).
 * PDF export is PRD P2; JSON is the supported download path for now.
 *
 * @param {object} state — typically `useSceneStore.getState()` or a tab snapshot
 */
export function buildInsightReportFromWorkspace(state) {
  const {
    lensOutput,
    scoutPins,
    datasetMeta,
    activeChartType,
    axisMapping,
    is2DMode,
    renderGeneration,
    uploadSessionId,
    scoutStatus,
    lensStatus,
  } = state
  return buildInsightReport(lensOutput, scoutPins, datasetMeta, {
    scene: {
      activeChartType,
      axisMapping,
      is2DMode,
      renderGeneration,
      uploadSessionId,
      scoutStatus,
      lensStatus,
    },
  })
}

/**
 * Trigger a browser download of the insight report JSON (browser only).
 *
 * @param {ReturnType<typeof buildInsightReport>} report
 * @param {string} [basename] — without extension
 */
export function downloadInsightReportJson(report, basename = 'insight-report') {
  if (typeof document === 'undefined') return
  const safe = sanitizeFilename(basename, 'insight-report')
  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: 'application/json',
  })
  const link = document.createElement('a')
  link.download = `${safe}-insight-report.json`
  link.href = URL.createObjectURL(blob)
  link.click()
  URL.revokeObjectURL(link.href)
}
