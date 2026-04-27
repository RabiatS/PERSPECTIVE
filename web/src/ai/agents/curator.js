import { PCA } from 'ml-pca'
import { callAI } from '../aiClient.js'
import { isCuratorRationaleLlmEnabled } from '../aiPolicy.js'
import { numericColumns } from '../lensSchema.js'

const CURATOR_SYSTEM = `You are CURATOR. Given PCA-ranked columns for a selection, reply JSON only:
{ "rationale": "max 35 words plain English" }
No markdown.`

/**
 * @param {Record<string, unknown>[]} rows
 * @param {number[]} selectedIndices global row indices into full dataset
 * @param {string[]} columns
 * @param {Record<string, 'numeric' | 'categorical' | 'datetime'>} detectedTypes
 * @returns {{ columns: string[]; loadings: number[] }}
 */
export function pcaTopColumns(rows, selectedIndices, columns, detectedTypes) {
  const nums = numericColumns(detectedTypes, columns)
  if (nums.length === 0 || selectedIndices.length < 3) {
    return { columns: nums.slice(0, 3), loadings: [] }
  }

  const subset = selectedIndices
    .map((i) => rows[i])
    .filter(Boolean)
  const matrix = subset.map((row) =>
    nums.map((c) => {
      const v = Number(row[c])
      return Number.isFinite(v) ? v : 0
    }),
  )

  try {
    const pca = new PCA(matrix, { scale: true })
    const L = pca.getLoadings()
    const loadings = []
    for (let j = 0; j < nums.length; j++) {
      loadings.push(Math.abs(L.get(j, 0)))
    }
    const order = nums
      .map((name, i) => ({ name, w: loadings[i] ?? 0 }))
      .sort((a, b) => b.w - a.w)
      .map((x) => x.name)
    return { columns: order.slice(0, 3), loadings }
  } catch {
    return { columns: nums.slice(0, 3), loadings: [] }
  }
}

/**
 * @param {{
 *   rows: Record<string, unknown>[];
 *   selectedIndices: number[];
 *   columns: string[];
 *   detectedTypes: Record<string, 'numeric' | 'categorical' | 'datetime'>;
 *   axisMapping: { x: string; y: string; z: string };
 *   chartType: string;
 * }} args
 */
export async function runCuratorSubScene(args) {
  const top = pcaTopColumns(
    args.rows,
    args.selectedIndices,
    args.columns,
    args.detectedTypes,
  )

  let rationale = `PCA highlights ${top.columns.slice(0, 3).join(', ')} as strongest axes in this selection (${args.selectedIndices.length} rows). Set VITE_AI_CURATOR_LLM=true for an LLM rationale (uses tokens).`

  if (isCuratorRationaleLlmEnabled()) {
    try {
      const raw = await callAI({
        systemPrompt: CURATOR_SYSTEM,
        userMessage: `Selected ${args.selectedIndices.length} rows. Top columns: ${top.columns.join(', ')}.`,
        maxTokens: 250,
      })
      const m = raw.match(/\{[\s\S]*\}/)
      if (m) {
        const j = JSON.parse(m[0])
        if (typeof j.rationale === 'string') rationale = j.rationale
      }
    } catch {
      /* keep PCA rationale */
    }
  }

  const [x, y, z] = top.columns
  const ax = {
    x: x ?? args.axisMapping.x,
    y: y ?? args.axisMapping.y,
    z: z ?? args.axisMapping.z,
  }

  const filtered = args.selectedIndices
    .map((i) => args.rows[i])
    .filter(Boolean)

  return {
    topColumns: top.columns,
    rationale,
    axisMapping: ax,
    filteredRows: filtered,
  }
}
