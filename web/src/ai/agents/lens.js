import { callAI } from '../aiClient.js'
import {
  buildHeuristicLens,
  validateAndNormalizeLensOutput,
} from '../lensSchema.js'
import { isLensLlmEnabled } from '../aiPolicy.js'

const LENS_SYSTEM_PROMPT = `You are LENS, a data classification AI. Given a dataset summary, you return a JSON object (no markdown, no explanation — only valid JSON) with this exact schema:
{
  "dataType": "tabular | time-series | geographic | audio | graph",
  "recommendedChart": "scatter3d | surface | mesh3d | bar3d | globe | graph3d",
  "reasoning": "string (max 30 words, plain English)",
  "axisMapping": { "x": "columnName", "y": "columnName", "z": "columnName" },
  "flaggedNulls": [{ "column": "string", "nullCount": number }],
  "flaggedOutliers": [{ "column": "string", "description": "string" }],
  "confidence": number (0.0–1.0)
}`

/**
 * @param {string} raw
 */
function extractJsonBlock(raw) {
  const t = raw.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) return fence[1].trim()
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start >= 0 && end > start) return t.slice(start, end + 1)
  return t
}

/**
 * @param {{
 *   columns: string[];
 *   rowCount: number;
 *   nullCounts: Record<string, number>;
 *   sample: Record<string, unknown>[];
 *   detectedTypes: Record<string, 'numeric' | 'categorical' | 'datetime'>;
 *   graphLinkCount?: number;
 * }} params
 * @returns {Promise<{ output: Record<string, unknown>; warnings: string[] }>}
 */
export async function runLens(params) {
  const ctx = { columns: params.columns, detectedTypes: params.detectedTypes }

  if (!isLensLlmEnabled()) {
    const h = buildHeuristicLens({
      ...params,
      graphLinkCount: params.graphLinkCount ?? 0,
    })
    const { output, warnings } = validateAndNormalizeLensOutput(h, ctx)
    return {
      output,
      warnings,
    }
  }

  const graphHint =
    (params.graphLinkCount ?? 0) > 0
      ? `\nGraph structure: ${params.graphLinkCount} edges between nodes (Obsidian-style links). Prefer dataType "graph", recommendedChart "graph3d", axisMapping graph_x/graph_y/graph_z if listed in columns.`
      : ''

  const userMessage = `Dataset summary:
Columns: ${params.columns.join(', ')}
Row count: ${params.rowCount}
Null counts: ${JSON.stringify(params.nullCounts)}
First 3 rows (sample): ${JSON.stringify(params.sample)}${graphHint}`

  let raw
  try {
    raw = await callAI({
      systemPrompt: LENS_SYSTEM_PROMPT,
      userMessage,
      maxTokens: 500,
    })
  } catch {
    const { output, warnings } = validateAndNormalizeLensOutput(null, ctx)
    return {
      output,
      warnings: [...warnings, 'LENS request failed; using defaults.'],
    }
  }

  let parsed
  try {
    parsed = JSON.parse(extractJsonBlock(raw))
  } catch {
    const { output, warnings } = validateAndNormalizeLensOutput(null, ctx)
    return {
      output: {
        ...output,
        reasoning: 'AI returned invalid JSON; using defaults for 3D axes.',
      },
      warnings: [...warnings, 'Could not parse JSON from LENS.'],
    }
  }

  const { output, warnings } = validateAndNormalizeLensOutput(parsed, ctx)
  return { output, warnings }
}
