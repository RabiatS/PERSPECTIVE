const CHARTS = /** @type {const} */ ([
  'scatter3d',
  'surface',
  'mesh3d',
  'bar3d',
  'globe',
  'graph3d',
])

const DATA_TYPES = /** @type {const} */ ([
  'tabular',
  'time-series',
  'geographic',
  'audio',
  'graph',
])

/**
 * @param {Record<string, 'numeric' | 'categorical' | 'datetime'>} detectedTypes
 * @param {string[]} columns
 */
export function numericColumns(detectedTypes, columns) {
  return columns.filter((c) => detectedTypes[c] === 'numeric')
}

/**
 * Zero-token LENS: rules from column names + types only.
 * @param {{
 *   columns: string[];
 *   rowCount: number;
 *   nullCounts: Record<string, number>;
 *   sample: Record<string, unknown>[];
 *   detectedTypes: Record<string, 'numeric' | 'categorical' | 'datetime'>;
 *   graphLinkCount?: number;
 * }} args
 */
export function buildHeuristicLens(args) {
  const linkN = args.graphLinkCount ?? 0
  const hasGraphLayoutCols =
    args.columns.includes('graph_x') &&
    args.columns.includes('graph_y') &&
    args.columns.includes('graph_z')
  const isGraphTable = linkN > 0 || hasGraphLayoutCols

  if (isGraphTable) {
    const nums = numericColumns(args.detectedTypes, args.columns)
    const axisMapping = hasGraphLayoutCols
      ? { x: 'graph_x', y: 'graph_y', z: 'graph_z' }
      : {
          x: nums[0] ?? '',
          y: nums[1] ?? nums[0] ?? '',
          z: nums[2] ?? nums[1] ?? nums[0] ?? '',
        }
    const flaggedNulls = Object.entries(args.nullCounts)
      .filter(([, n]) => n > 0)
      .map(([column, nullCount]) => ({ column, nullCount }))
    return {
      dataType: 'graph',
      recommendedChart: 'graph3d',
      reasoning:
        linkN > 0
          ? `Heuristic (no LLM): linked graph (${linkN} edges) — 3D node–link view.`
          : 'Heuristic (no LLM): graph layout columns — 3D node view.',
      axisMapping,
      flaggedNulls,
      flaggedOutliers: [],
      confidence: 0.64,
    }
  }

  const nums = numericColumns(args.detectedTypes, args.columns)
  const dtCols = args.columns.filter((c) => args.detectedTypes[c] === 'datetime')
  const findCol = (re) => args.columns.find((c) => re.test(c))
  const latCol = findCol(/^(lat|latitude)$/i)
  const lngCol = findCol(/^(lng|lon|longitude|long)$/i)

  const flaggedNulls = Object.entries(args.nullCounts)
    .filter(([, n]) => n > 0)
    .map(([column, nullCount]) => ({ column, nullCount }))

  let dataType = 'tabular'
  let recommendedChart = 'scatter3d'
  let reasoning =
    'Heuristic (no LLM): numeric columns mapped to 3D scatter.'
  /** Tiered by rule strength; ≥0.6 avoids spurious PRD “tentative” for structured cases (e.g. audio FFT). */
  let confidence = 0.58
  let axisMapping = {
    x: nums[0] ?? args.columns[0] ?? '',
    y: nums[1] ?? nums[0] ?? '',
    z: nums[2] ?? nums[1] ?? nums[0] ?? '',
  }

  const lngOk =
    lngCol &&
    (args.detectedTypes[lngCol] === 'numeric' ||
      args.detectedTypes[lngCol] === 'datetime')
  const latOk =
    latCol &&
    (args.detectedTypes[latCol] === 'numeric' ||
      args.detectedTypes[latCol] === 'datetime')

  if (lngCol && latCol && lngOk && latOk) {
    dataType = 'geographic'
    recommendedChart = 'globe'
    const zCol =
      nums.find((n) => n !== lngCol && n !== latCol) ?? latCol ?? lngCol
    axisMapping = { x: lngCol, y: latCol, z: zCol }
    reasoning =
      'Heuristic (no LLM): longitude/latitude columns — globe view.'
    confidence = 0.78
  } else if (dtCols.length >= 1 && nums.length >= 2) {
    dataType = 'time-series'
    recommendedChart = 'surface'
    const t = dtCols[0]
    const n1 = nums.find((x) => x !== t) ?? nums[0]
    const n2 = nums.find((x) => x !== t && x !== n1) ?? n1
    axisMapping = { x: t, y: n1, z: n2 }
    reasoning =
      'Heuristic (no LLM): time axis + numerics — surface plot.'
    confidence = 0.68
  } else if (
    args.columns.some((c) => /freq|amplitude|time_bin|spectrogram/i.test(c)) &&
    nums.length >= 2
  ) {
    dataType = 'audio'
    recommendedChart = 'surface'
    const timeCol =
      nums.find((c) => /^time/i.test(c)) ?? nums[0]
    const freqCol =
      nums.find((c) => c !== timeCol && /freq|bin/i.test(c)) ??
      nums.find((c) => c !== timeCol) ??
      nums[1] ??
      nums[0]
    const ampCol =
      nums.find((c) => c !== timeCol && c !== freqCol && /amp/i.test(c)) ??
      nums.find((c) => c !== timeCol && c !== freqCol) ??
      nums[2] ??
      freqCol
    axisMapping = { x: timeCol, y: freqCol, z: ampCol }
    reasoning =
      'Heuristic (no LLM): spectrum-like fields — surface.'
    confidence = 0.74
  } else if (nums.length >= 6) {
    recommendedChart = 'mesh3d'
    reasoning =
      'Heuristic (no LLM): many numeric columns — mesh may fit dense structure.'
    confidence = 0.56
  }

  return {
    dataType,
    recommendedChart,
    reasoning,
    axisMapping,
    flaggedNulls,
    flaggedOutliers: [],
    confidence,
  }
}

/**
 * @param {{
 *   columns: string[];
 *   rowCount: number;
 *   nullCounts: Record<string, number>;
 *   sample: Record<string, unknown>[];
 *   detectedTypes: Record<string, 'numeric' | 'categorical' | 'datetime'>;
 * }} args
 */
export function buildDefaultLens(args) {
  const nums = numericColumns(args.detectedTypes, args.columns)
  const x = nums[0] ?? args.columns[0] ?? ''
  const y = nums[1] ?? args.columns[1] ?? x
  const z = nums[2] ?? args.columns[2] ?? y
  const flaggedNulls = Object.entries(args.nullCounts)
    .filter(([, n]) => n > 0)
    .map(([column, nullCount]) => ({ column, nullCount }))
  return {
    dataType: 'tabular',
    recommendedChart: 'scatter3d',
    reasoning: 'Could not parse AI response; using defaults for 3D axes.',
    axisMapping: { x, y, z },
    flaggedNulls,
    flaggedOutliers: [],
    confidence: 0,
  }
}

/**
 * @param {unknown} v
 * @param {{
 *   columns: string[];
 *   detectedTypes: Record<string, 'numeric' | 'categorical' | 'datetime'>;
 * }} ctx
 */
export function validateAndNormalizeLensOutput(v, ctx) {
  const defaults = buildDefaultLens({
    columns: ctx.columns,
    rowCount: 0,
    nullCounts: {},
    sample: [],
    detectedTypes: ctx.detectedTypes,
  })

  const nums = numericColumns(ctx.detectedTypes, ctx.columns)
  const warnings = /** @type {string[]} */ ([])

  if (!v || typeof v !== 'object') {
    warnings.push('LENS output was not an object; using defaults.')
    return { output: defaults, warnings }
  }

  const o = /** @type {Record<string, unknown>} */ (v)

  let dataType = String(o.dataType ?? '')
    .toLowerCase()
    .trim()
    .replace(/[\s_]/g, '-')
  if (dataType === 'network' || dataType === 'node-link') dataType = 'graph'
  if (!DATA_TYPES.includes(/** @type {never} */ (dataType))) {
    dataType = 'tabular'
    warnings.push(`Unknown dataType; defaulted to tabular.`)
  }

  let recommendedChart = String(o.recommendedChart ?? '')
    .toLowerCase()
    .trim()
    .replace(/[\s_]/g, '')
  const chartMap = {
    scatter3d: 'scatter3d',
    surface: 'surface',
    mesh3d: 'mesh3d',
    mesh: 'mesh3d',
    bar3d: 'bar3d',
    bar: 'bar3d',
    globe: 'globe',
    graph3d: 'graph3d',
    graph: 'graph3d',
    network: 'graph3d',
  }
  recommendedChart = chartMap[recommendedChart] ?? 'scatter3d'
  if (!CHARTS.includes(/** @type {never} */ (recommendedChart))) {
    recommendedChart = 'scatter3d'
    warnings.push('Unknown recommendedChart; defaulted to scatter3d.')
  }

  const reasoning =
    typeof o.reasoning === 'string' && o.reasoning.trim()
      ? o.reasoning.trim().slice(0, 200)
      : defaults.reasoning

  let axisMapping = defaults.axisMapping
  const am = o.axisMapping
  if (am && typeof am === 'object') {
    const ax = /** @type {Record<string, unknown>} */ (am)
    const pick = (k) => {
      const name = ax[k]
      if (typeof name !== 'string' || !name) return ''
      return ctx.columns.includes(name) ? name : ''
    }
    const px = pick('x')
    const py = pick('y')
    const pz = pick('z')
    if (px && py) {
      axisMapping = {
        x: px,
        y: py,
        z: pz || py,
      }
    } else {
      warnings.push('Invalid axisMapping columns; using numeric defaults.')
    }
  } else {
    warnings.push('Missing axisMapping; using numeric defaults.')
  }

  for (const key of /** @type {const} */ (['x', 'y', 'z'])) {
    const col = axisMapping[key]
    const t = col ? ctx.detectedTypes[col] : undefined
    if (
      col &&
      t !== 'numeric' &&
      t !== 'datetime' &&
      nums.length > 0
    ) {
      warnings.push(
        `Axis ${key.toUpperCase()} is not numeric or time; using numeric fallback.`,
      )
      axisMapping = { ...defaults.axisMapping }
      break
    }
  }

  let flaggedNulls = defaults.flaggedNulls
  if (Array.isArray(o.flaggedNulls)) {
    flaggedNulls = o.flaggedNulls
      .filter(
        (f) =>
          f &&
          typeof f === 'object' &&
          typeof /** @type {{ column?: unknown }} */ (f).column === 'string',
      )
      .map((f) => {
        const r = /** @type {{ column: string; nullCount?: unknown }} */ (f)
        return {
          column: r.column,
          nullCount: Number(r.nullCount) || 0,
        }
      })
  }

  let flaggedOutliers = /** @type {{ column: string; description: string }[]} */ (
    []
  )
  if (Array.isArray(o.flaggedOutliers)) {
    flaggedOutliers = o.flaggedOutliers
      .filter(
        (f) =>
          f &&
          typeof f === 'object' &&
          typeof /** @type {{ column?: unknown }} */ (f).column === 'string',
      )
      .map((f) => {
        const r = /** @type {{ column: string; description?: unknown }} */ (f)
        return {
          column: r.column,
          description:
            typeof r.description === 'string' ? r.description : '',
        }
      })
  }

  let confidence = Number(o.confidence)
  if (!Number.isFinite(confidence)) {
    confidence = 0.5
    warnings.push('Missing confidence; set to 0.5.')
  }
  confidence = Math.max(0, Math.min(1, confidence))
  if (confidence < 0.6) {
    warnings.push(
      'LENS confidence is below 0.6 (PRD); treat chart and axis suggestions as tentative.',
    )
  }

  return {
    output: {
      dataType,
      recommendedChart,
      reasoning,
      axisMapping,
      flaggedNulls,
      flaggedOutliers,
      confidence,
    },
    warnings,
  }
}
