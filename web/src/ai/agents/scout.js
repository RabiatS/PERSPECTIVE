import { callAI } from '../aiClient.js'
import { isScoutPinCopyLlmEnabled } from '../aiPolicy.js'
import {
  clientAnomalyScores,
  strongCorrelationPairs,
} from '../../utils/anomalyDetection.js'
import { fetchRemoteAnomalyScores } from '../../utils/scoutRemote.js'
import { numericColumns } from '../lensSchema.js'

/** PRD: dataset minimum; below this SCOUT returns no pins */
const MIN_ROWS = 20
/** PRD: anomaly score threshold for pin injection (0.55–0.69 not surfaced) */
const SCORE_THRESHOLD = 0.52
/** PRD: require at least this many qualifying anomalies before SCOUT activates */
const MIN_ANOMALIES = 2
const MAX_PINS = 10
const MAX_CORR_PINS = 3

const SCOUT_BATCH_SYSTEM = `You are SCOUT. Given anomaly summaries (row index + z-context), return JSON only: { "pins": [ { "headline": "max 8 words", "explanation": "max 40 words plain English", "columns_involved": ["col"], "suggested_action": "short", "confidence": 0-1 } ] }
The pins array length must match the number of anomalies provided, in the same order. No markdown.`

/**
 * @param {Record<string, unknown>[]} rows
 * @param {string[]} columns
 * @param {Record<string, 'numeric' | 'categorical' | 'datetime'>} detectedTypes
 */
function rowsToFeatureMatrix(rows, columns, detectedTypes) {
  const nums = numericColumns(detectedTypes, columns)
  if (nums.length === 0) return { features: [], numericCols: [] }
  const features = rows.map((row) =>
    nums.map((c) => {
      const v = Number(row[c])
      return Number.isFinite(v) ? v : 0
    }),
  )
  return { features, numericCols: nums }
}

/**
 * @param {{
 *   rows: Record<string, unknown>[];
 *   rowIndices?: number[];
 *   columns: string[];
 *   detectedTypes: Record<string, 'numeric' | 'categorical' | 'datetime'>;
 *   axisMapping: { x: string; y: string; z: string };
 *   chartSpaceOrigin?: [number, number, number];
 * }} args
 * @returns {Promise<import('../../store/pinTypes.js').ScoutPin[]>}
 */
export async function runScoutPipeline(args) {
  const { rows, columns, detectedTypes, axisMapping, rowIndices } = args
  const [ox, oy, oz] = args.chartSpaceOrigin ?? [0, 0, 0]
  const idxMap =
    rowIndices && rowIndices.length === rows.length
      ? rowIndices
      : rows.map((_, i) => i)
  if (rows.length < MIN_ROWS) return []

  /**
   * Anomaly scores: Isolation Forest when `VITE_SCOUT_API_URL` returns a `scores`
   * array; otherwise client Z-score fallback (see clientAnomalyScores).
   */
  const { features, numericCols } = rowsToFeatureMatrix(
    rows,
    columns,
    detectedTypes,
  )
  if (numericCols.length === 0) return []

  let scores = await fetchRemoteAnomalyScores(features)
  if (!scores) {
    scores = clientAnomalyScores(rows, numericCols).scores
  }

  const indexed = scores
    .map((score, rowIndex) => ({ score, rowIndex }))
    .filter((x) => x.score >= SCORE_THRESHOLD)
    .sort((a, b) => b.score - a.score)

  if (indexed.length < MIN_ANOMALIES) return []

  const picked = indexed.slice(0, MAX_PINS)
  const summaries = picked.map(({ rowIndex, score }) => {
    const row = rows[rowIndex]
    const bits = numericCols
      .slice(0, 6)
      .map((c) => `${c}=${row[c]}`)
      .join(', ')
    const g = idxMap[rowIndex]
    return `row ${g} score=${score.toFixed(3)}: ${bits}`
  })

  let aiPins = /** @type {{ headline: string; explanation: string; columns_involved: string[]; suggested_action: string; confidence: number }[]} */ (
    []
  )

  const templatePins = () =>
    picked.map((pick) => {
      const globalIdx = idxMap[pick.rowIndex]
      const row = rows[pick.rowIndex]
      const fmt = (c) => {
        const v = row[c]
        const n = Number(v)
        return Number.isFinite(n) ? n.toFixed(4) : String(v ?? '—')
      }
      const atChart = `chart axes ${axisMapping.x}=${fmt(axisMapping.x)}, ${axisMapping.y}=${fmt(axisMapping.y)}, ${axisMapping.z}=${fmt(axisMapping.z)}`
      return {
        headline: `Unusual row ${globalIdx} (score ${pick.score.toFixed(2)})`,
        explanation: `This row is an outlier versus the rest of the sample on the numeric fields SCOUT used (not only the 3D axes). Where it sits in the view: ${atChart}.`,
        columns_involved: numericCols.slice(0, 3),
        suggested_action:
          'Check this row in the source table or re-run with LENS/axes changed if needed.',
        confidence: 0.55,
      }
    })

  if (isScoutPinCopyLlmEnabled()) {
    try {
      const raw = await callAI({
        systemPrompt: SCOUT_BATCH_SYSTEM,
        userMessage: `Anomalies (in order):\n${summaries.join('\n')}`,
        maxTokens: 500,
      })
      const json = JSON.parse(
        raw
          .replace(/```(?:json)?\s*|\s*```/g, '')
          .trim()
          .match(/\{[\s\S]*\}/)?.[0] ?? '{}',
      )
      if (Array.isArray(json.pins)) aiPins = json.pins
      else aiPins = templatePins()
    } catch {
      aiPins = templatePins()
    }
  } else {
    aiPins = templatePins()
  }

  /** @type {import('../../store/pinTypes.js').ScoutPin[]} */
  const pins = []
  picked.forEach((p, i) => {
    const row = rows[p.rowIndex]
    const x = Number(row[axisMapping.x])
    const y = Number(row[axisMapping.y])
    const z = Number(row[axisMapping.z])
    if (![x, y, z].every(Number.isFinite)) return
    const ai = aiPins[i] ?? aiPins[0]
    const globalIdx = idxMap[p.rowIndex]
    pins.push({
      id: `anom-${globalIdx}-${i}`,
      kind: 'anomaly',
      rowIndex: globalIdx,
      position: [x - ox, y - oy, z - oz],
      anomaly_score: p.score,
      headline: String(ai?.headline ?? 'Anomaly'),
      explanation: String(
        ai?.explanation ?? 'Statistical outlier in mapped feature space.',
      ),
      columns_involved: Array.isArray(ai?.columns_involved)
        ? ai.columns_involved.map(String)
        : numericCols.slice(0, 3),
      suggested_action: String(
        ai?.suggested_action ?? 'Verify data quality for this record.',
      ),
      confidence: Math.max(
        0,
        Math.min(1, Number(ai?.confidence) || 0.65),
      ),
    })
  })

  const corrPairs = strongCorrelationPairs(rows, numericCols, 0.85).slice(
    0,
    MAX_CORR_PINS,
  )
  let ci = 0
  for (const pair of corrPairs) {
    let sx = 0
    let sy = 0
    let sz = 0
    let n = 0
    for (const row of rows) {
      const vx = Number(row[axisMapping.x])
      const vy = Number(row[axisMapping.y])
      const vz = Number(row[axisMapping.z])
      if (![vx, vy, vz].every(Number.isFinite)) continue
      sx += vx
      sy += vy
      sz += vz
      n++
    }
    if (n === 0) continue
    pins.push({
      id: `corr-${pair.colA}-${pair.colB}-${ci++}`,
      kind: 'correlation',
      rowIndex: -1,
      position: [sx / n - ox, sy / n - oy, sz / n - oz],
      anomaly_score: Math.abs(pair.r),
      headline: `Correlation ${pair.r.toFixed(2)}`,
      explanation: `Strong linear relationship between ${pair.colA} and ${pair.colB}.`,
      columns_involved: [pair.colA, pair.colB],
      suggested_action: 'Check for redundancy or derived columns.',
      confidence: Math.abs(pair.r),
    })
  }

  return pins.slice(0, MAX_PINS)
}
