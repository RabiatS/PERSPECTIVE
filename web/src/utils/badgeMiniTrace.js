import { buildTrace, rowsToXYZArrays } from './chartUtils.js'

const MAX_BADGE_POINTS = 600

/**
 * Downsample for badge thumbnail (keeps structure for surfaces / time series).
 * @param {Record<string, unknown>[]} rows
 */
function sampleBadgeRows(rows) {
  if (rows.length <= MAX_BADGE_POINTS) return rows
  const step = Math.ceil(rows.length / MAX_BADGE_POINTS)
  return rows.filter((_, i) => i % step === 0).slice(0, MAX_BADGE_POINTS)
}

/**
 * Single trace for the badge mini plot — matches main chart types (surface, mesh, etc.).
 * @param {string | null | undefined} chartType
 * @param {Record<string, unknown>[]} rows
 * @param {{ x?: string; y?: string; z?: string }} axisMapping
 * @param {Record<string, 'numeric' | 'categorical' | 'datetime'>} [detectedTypes]
 */
export function buildMiniTrace(chartType, rows, axisMapping, detectedTypes) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      type: 'scatter3d',
      mode: 'markers',
      x: [0],
      y: [0],
      z: [0],
      marker: { size: 4, color: '#5EEAD4', opacity: 0.35 },
    }
  }
  const sample = sampleBadgeRows(rows)
  const { x, y, z } = rowsToXYZArrays(sample, axisMapping, detectedTypes)
  return buildTrace(chartType, { x, y, z })
}
