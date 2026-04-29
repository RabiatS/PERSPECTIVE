import { reshapeToSurfaceGrid } from './surfaceGrid.js'

/** Rabiat v2: SCOUT = bloodline; correlation = muted rose (distinguishes marker shape) */
const R_BLOOD = '#A81C1C'
const R_BLOOD_MUTED = '#B85C5C'
const R_HOVER_BG = 'rgba(20, 20, 20, 0.98)'
const R_HOVER_BORDER = 'rgba(94, 234, 212, 0.4)'
const R_BONE = '#F5F5F0'
const R_HOVER_LIGHT_BG = 'rgba(255, 255, 255, 0.98)'
const R_HOVER_LIGHT_BORDER = 'rgba(0, 107, 120, 0.35)'
const R_INK = '#111116'

export const MAX_ROWS_BEFORE_SAMPLE = 10000
export const SAMPLE_SIZE = 5000

/**
 * Deterministic seed so 2D and 3D panels share the same sampled rows.
 * @param {number} uploadSessionId
 * @param {number} rowCount
 * @param {{ x: string; y: string; z: string }} axisMapping
 */
export function computeSampleSeed(uploadSessionId, rowCount, axisMapping) {
  const s = `${uploadSessionId}|${rowCount}|${axisMapping.x}|${axisMapping.y}|${axisMapping.z}`
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * @param {number} seed
 */
function mulberry32(seed) {
  let a = seed
  return function next() {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Coerce a cell to a finite number for 3D axes (numeric columns + ISO datetimes).
 * @param {unknown} value
 * @param {string} columnKey
 * @param {Record<string, 'numeric' | 'categorical' | 'datetime'> | undefined} detectedTypes
 */
export function axisValueToNumber(value, columnKey, detectedTypes) {
  if (value === null || value === undefined) return NaN
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const str = String(value).trim()
  if (str === '') return NaN
  const normalized = str.replace(/,/g, '')
  const asNum = Number(normalized)
  if (Number.isFinite(asNum)) return asNum
  if (columnKey && detectedTypes?.[columnKey] === 'datetime') {
    const t = Date.parse(str)
    if (Number.isFinite(t)) return t
  }
  return NaN
}

/**
 * @param {string | null | undefined} chartType
 */
function normalizeChartType(chartType) {
  if (!chartType) return 'scatter3d'
  return chartType
}

/**
 * Surface / heatmap grids break under uniform random subsampling (sparse NaNs in Z).
 * Use evenly spaced row indices to preserve row-major grid layouts in typical CSVs.
 * @param {Record<string, unknown>[]} rows
 */
function sampleRowsSystematicForSurface(rows) {
  const step = Math.max(1, Math.ceil(rows.length / SAMPLE_SIZE))
  const rowIndices = []
  for (
    let i = 0;
    i < rows.length && rowIndices.length < SAMPLE_SIZE;
    i += step
  ) {
    rowIndices.push(i)
  }
  return {
    rows: rowIndices.map((idx) => rows[idx]),
    rowIndices,
  }
}

/**
 * @param {Record<string, unknown>[]} rows
 * @param {number} [seed]
 * @param {{ chartType?: string | null }} [options]
 * @returns {{ rows: Record<string, unknown>[]; rowIndices: number[] }}
 */
export function sampleRowsForChart(rows, seed = 0, options = {}) {
  if (rows.length <= MAX_ROWS_BEFORE_SAMPLE) {
    return { rows, rowIndices: rows.map((_, i) => i) }
  }
  if (options.chartType === 'surface') {
    return sampleRowsSystematicForSurface(rows)
  }
  const rng = mulberry32(seed)
  const chosen = new Set()
  while (chosen.size < SAMPLE_SIZE) {
    chosen.add(Math.floor(rng() * rows.length))
  }
  const rowIndices = Array.from(chosen).sort((a, b) => a - b)
  return {
    rows: rowIndices.map((i) => rows[i]),
    rowIndices,
  }
}

/**
 * @param {string | null | undefined} chartType
 * @param {{ x: number[]; y: number[]; z: number[] }} arrays
 */
export function buildTrace(chartType, { x, y, z }) {
  const t = normalizeChartType(chartType)

  if (t === 'globe') {
    return {
      type: 'scatter3d',
      mode: 'markers',
      x,
      y,
      z,
      marker: {
        size: 3,
        color: '#5EEAD4',
        opacity: 0.9,
      },
    }
  }

  if (t === 'scatter3d' || t === 'graph3d') {
    return {
      type: 'scatter3d',
      mode: 'markers',
      x,
      y,
      z,
      marker: {
        size: t === 'graph3d' ? 5 : 3,
        color: t === 'graph3d' ? '#5EEAD4' : z,
        ...(t === 'graph3d' ? {} : { colorscale: 'Viridis' }),
        opacity: 0.9,
        ...(t === 'graph3d'
          ? { line: { color: 'rgba(0,0,0,0.4)', width: 0.5 } }
          : {}),
      },
    }
  }

  if (t === 'surface') {
    const { z: grid, x: xg, y: yg } = reshapeToSurfaceGrid(x, y, z)
    return {
      type: 'surface',
      z: grid,
      x: xg,
      y: yg,
      colorscale: 'Electric',
    }
  }

  if (t === 'mesh3d') {
    return {
      type: 'mesh3d',
      x,
      y,
      z,
      alphahull: 5,
      opacity: 0.5,
      color: '#5EEAD4',
    }
  }

  if (t === 'bar3d') {
    return {
      type: 'scatter3d',
      mode: 'markers',
      x,
      y,
      z,
      marker: {
        symbol: 'square',
        size: 4,
        color: z,
        colorscale: 'Viridis',
        opacity: 0.85,
      },
    }
  }

  return {
    type: 'scatter3d',
    mode: 'markers',
    x,
    y,
    z,
    marker: {
      size: 3,
      color: z,
      colorscale: 'Viridis',
      opacity: 0.85,
    },
  }
}

/**
 * @param {string | null | undefined} chartType
 * @param {{ x: number[]; y: number[]; z: number[] }} arrays
 */
export function buildTrace2D(chartType, { x, y, z }) {
  const t = normalizeChartType(chartType)
  if (t === 'graph3d') {
    return {
      type: 'scatter',
      mode: 'markers',
      x,
      y,
      marker: {
        color: '#5EEAD4',
        opacity: 0.9,
        size: 7,
        line: { color: 'rgba(0,0,0,0.35)', width: 0.5 },
      },
    }
  }
  if (t === 'globe') {
    return {
      type: 'scatter',
      mode: 'markers',
      x,
      y,
      marker: {
        color: z,
        colorscale: 'Electric',
        opacity: 0.9,
        size: 6,
      },
    }
  }
  return {
    type: 'scatter',
    mode: 'markers',
    x,
    y,
    marker: {
      color: z,
      colorscale: 'Viridis',
      opacity: 0.85,
      size: t === 'bar3d' ? 6 : 5,
      ...(t === 'bar3d' ? { symbol: 'square' } : {}),
    },
  }
}

/**
 * @param {{ x: string; y: string; z: string }} axisMapping
 * @param {{ width: number; height: number }} [size] — when set, Plotly fills the canvas (browser zoom / resize)
 * @param {'dark' | 'light'} [colorTheme]
 */
export function buildLayout(axisMapping, size, colorTheme = 'dark') {
  const light = colorTheme === 'light'
  const axisColor = light ? '#5c5c6e' : '#8A8A9A'
  const gridColor = light ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)'
  return {
    autosize: true,
    ...(size && size.width > 0 && size.height > 0
      ? { width: size.width, height: size.height }
      : {}),
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    hoverlabel: {
      bgcolor: light ? R_HOVER_LIGHT_BG : R_HOVER_BG,
      bordercolor: light ? R_HOVER_LIGHT_BORDER : R_HOVER_BORDER,
      font: {
        family: 'DM Mono, ui-monospace, monospace',
        size: 11,
        color: light ? R_INK : R_BONE,
      },
    },
    scene: {
      bgcolor: 'rgba(0,0,0,0)',
      xaxis: {
        color: axisColor,
        gridcolor: gridColor,
        title: axisMapping.x,
      },
      yaxis: {
        color: axisColor,
        gridcolor: gridColor,
        title: axisMapping.y,
      },
      zaxis: {
        color: axisColor,
        gridcolor: gridColor,
        title: axisMapping.z,
      },
    },
    margin: { l: 0, r: 0, t: 0, b: 0 },
    showlegend: false,
  }
}

/**
 * @param {{ x: string; y: string; z: string }} axisMapping
 * @param {'dark' | 'light'} [colorTheme]
 */
export function buildLayout2D(axisMapping, colorTheme = 'dark') {
  const light = colorTheme === 'light'
  const axisColor = light ? '#5c5c6e' : '#8A8A9A'
  const gridColor = light ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)'
  return {
    autosize: true,
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    hoverlabel: {
      bgcolor: light ? R_HOVER_LIGHT_BG : R_HOVER_BG,
      bordercolor: light ? R_HOVER_LIGHT_BORDER : R_HOVER_BORDER,
      font: {
        family: 'DM Mono, ui-monospace, monospace',
        size: 11,
        color: light ? R_INK : R_BONE,
      },
    },
    xaxis: {
      color: axisColor,
      gridcolor: gridColor,
      title: axisMapping.x,
    },
    yaxis: {
      color: axisColor,
      gridcolor: gridColor,
      title: axisMapping.y,
    },
    margin: { l: 0, r: 0, t: 0, b: 0 },
    showlegend: false,
  }
}

/**
 * @param {Record<string, unknown>[]} rows
 * @param {{ x: string; y: string; z: string }} axisMapping
 * @param {Record<string, 'numeric' | 'categorical' | 'datetime'>} [detectedTypes]
 */
export function rowsToXYZArrays(rows, axisMapping, detectedTypes) {
  return {
    x: rows.map((row) =>
      axisValueToNumber(row[axisMapping.x], axisMapping.x, detectedTypes),
    ),
    y: rows.map((row) =>
      axisValueToNumber(row[axisMapping.y], axisMapping.y, detectedTypes),
    ),
    z: rows.map((row) =>
      axisValueToNumber(row[axisMapping.z], axisMapping.z, detectedTypes),
    ),
  }
}

/**
 * Shift plotted coordinates so the data centroid sits at world origin (aligns with grid / gizmo).
 * @param {number[]} x
 * @param {number[]} y
 * @param {number[]} z
 * @param {[number, number, number]} origin
 */
export function subtractDataSpaceOrigin(x, y, z, origin) {
  const [ox, oy, oz] = origin
  return {
    x: x.map((v) => (Number.isFinite(v) ? v - ox : NaN)),
    y: y.map((v) => (Number.isFinite(v) ? v - oy : NaN)),
    z: z.map((v) => (Number.isFinite(v) ? v - oz : NaN)),
  }
}

/**
 * Mean of finite XYZ in mapped columns (raw data space, before origin shift).
 * @param {Record<string, unknown>[]} rows
 * @param {{ x: string; y: string; z: string }} axisMapping
 * @param {Record<string, 'numeric' | 'categorical' | 'datetime'>} [detectedTypes]
 * @returns {[number, number, number]}
 */
export function computeDataCentroid(rows, axisMapping, detectedTypes) {
  let sx = 0
  let sy = 0
  let sz = 0
  let n = 0
  for (const row of rows) {
    const x = axisValueToNumber(row[axisMapping.x], axisMapping.x, detectedTypes)
    const y = axisValueToNumber(row[axisMapping.y], axisMapping.y, detectedTypes)
    const z = axisValueToNumber(row[axisMapping.z], axisMapping.z, detectedTypes)
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue
    sx += x
    sy += y
    sz += z
    n += 1
  }
  if (n === 0) return [0, 0, 0]
  return [sx / n, sy / n, sz / n]
}

/**
 * Max distance from centroid in the same rows (for camera distance).
 * @param {Record<string, unknown>[]} rows
 * @param {{ x: string; y: string; z: string }} axisMapping
 * @param {[number, number, number]} centroid
 * @param {Record<string, 'numeric' | 'categorical' | 'datetime'>} [detectedTypes]
 */
export function computeDataBoundingRadius(
  rows,
  axisMapping,
  centroid,
  detectedTypes,
) {
  const [cx, cy, cz] = centroid
  let r = 0
  for (const row of rows) {
    const x = axisValueToNumber(row[axisMapping.x], axisMapping.x, detectedTypes)
    const y = axisValueToNumber(row[axisMapping.y], axisMapping.y, detectedTypes)
    const z = axisValueToNumber(row[axisMapping.z], axisMapping.z, detectedTypes)
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue
    const d = Math.hypot(x - cx, y - cy, z - cz)
    if (d > r) r = d
  }
  return r
}

/**
 * Line segments for graph edges (Plotly breaks segments with null).
 * @param {number[]} x
 * @param {number[]} y
 * @param {number[]} z
 * @param {number[]} sampledRowIndices — maps point i → full-dataset row index
 * @param {[number, number][]} fullGraphLinks
 */
export function buildGraphEdgeTrace3d(x, y, z, sampledRowIndices, fullGraphLinks) {
  if (!fullGraphLinks?.length) return null
  /** @type {Map<number, number>} */
  const local = new Map(sampledRowIndices.map((ri, li) => [ri, li]))
  const xl = []
  const yl = []
  const zl = []
  for (const [s, t] of fullGraphLinks) {
    const i = local.get(s)
    const j = local.get(t)
    if (i === undefined || j === undefined) continue
    xl.push(x[i], x[j], NaN)
    yl.push(y[i], y[j], NaN)
    zl.push(z[i], z[j], NaN)
  }
  if (xl.length === 0) return null
  return {
    type: 'scatter3d',
    mode: 'lines',
    x: xl,
    y: yl,
    z: zl,
    line: {
      color: 'rgba(94, 234, 212, 0.28)',
      width: 2,
    },
    hoverinfo: 'skip',
    showlegend: false,
  }
}

/**
 * @param {number[]} x
 * @param {number[]} y
 * @param {number[]} sampledRowIndices
 * @param {[number, number][]} fullGraphLinks
 */
export function buildGraphEdgeTrace2d(x, y, sampledRowIndices, fullGraphLinks) {
  if (!fullGraphLinks?.length) return null
  /** @type {Map<number, number>} */
  const local = new Map(sampledRowIndices.map((ri, li) => [ri, li]))
  const xl = []
  const yl = []
  for (const [s, t] of fullGraphLinks) {
    const i = local.get(s)
    const j = local.get(t)
    if (i === undefined || j === undefined) continue
    xl.push(x[i], x[j], NaN)
    yl.push(y[i], y[j], NaN)
  }
  if (xl.length === 0) return null
  return {
    type: 'scatter',
    mode: 'lines',
    x: xl,
    y: yl,
    line: {
      color: 'rgba(94, 234, 212, 0.35)',
      width: 1.5,
    },
    hoverinfo: 'skip',
    showlegend: false,
  }
}

/**
 * @param {string} s
 */
function escapeHtmlAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Bordered callout + arrow in data space (moves with the 3D camera). Replaces on-trace text
 * so the pin matches the old InsightPin “box + line” look while staying aligned.
 * @param {import('../store/pinTypes.js').ScoutPin[]} pins
 * @param {'dark' | 'light'} [colorTheme]
 * @returns {Record<string, unknown>[]}
 */
export function buildScoutSceneAnnotations(pins, colorTheme = 'dark') {
  if (!pins.length) return []
  const light = colorTheme === 'light'
  const bg = light ? 'rgba(255,255,255,0.94)' : 'rgba(10, 10, 15, 0.95)'
  const textMain = light ? '#1a1a2e' : '#e8e6e3'
  return pins.map((p) => {
    const [px, py, pz] = p.position
    const isCorr = p.kind === 'correlation'
    const accent = isCorr ? R_BLOOD_MUTED : R_BLOOD
    const kindLabel = isCorr ? 'CORRELATION' : 'SCOUT'
    const head = p.headline.length > 56 ? `${p.headline.slice(0, 54)}…` : p.headline
    const text = `<b style="color:${accent};font-size:9px;letter-spacing:0.1em;font-family:Bebas Neue,system-ui,sans-serif;">${kindLabel}</b><br><span style="color:${textMain};font-size:10px;">${escapeHtmlAttr(head)}</span>`
    const cols = p.columns_involved?.length ? p.columns_involved.join(', ') : '—'
    const rowLabel =
      !isCorr && p.rowIndex >= 0 ? `row ${p.rowIndex}` : '—'
    const hovertext = [
      escapeHtmlAttr(p.explanation),
      '',
      `Columns: ${escapeHtmlAttr(cols)} · ${rowLabel}`,
      `Suggested: ${escapeHtmlAttr(p.suggested_action)}`,
      `Score ${p.anomaly_score.toFixed(2)} · conf ${(p.confidence * 100).toFixed(0)}%`,
    ].join('<br>')
    return {
      x: px,
      y: py,
      z: pz,
      text,
      showarrow: true,
      ax: 0,
      ay: -52,
      xshift: 0,
      yshift: 0,
      bordercolor: accent,
      borderwidth: 1.5,
      borderpad: 6,
      bgcolor: bg,
      font: { color: textMain, size: 10, family: 'DM Mono, ui-monospace, monospace' },
      align: 'left',
      arrowcolor: accent,
      arrowwidth: 1.2,
      arrowhead: 2,
      hovertext,
      width: 168,
    }
  })
}

/**
 * 2D cartesian callouts (same look as 3D when using the 2D panel).
 * @param {import('../store/pinTypes.js').ScoutPin[]} pins
 * @param {'dark' | 'light'} [colorTheme]
 * @returns {Record<string, unknown>[]}
 */
export function buildScoutCartesianAnnotations(pins, colorTheme = 'dark') {
  if (!pins.length) return []
  const light = colorTheme === 'light'
  const bg = light ? 'rgba(255,255,255,0.94)' : 'rgba(10, 10, 15, 0.95)'
  const textMain = light ? '#1a1a2e' : '#e8e6e3'
  return pins.map((p) => {
    const [px, py] = p.position
    const isCorr = p.kind === 'correlation'
    const accent = isCorr ? R_BLOOD_MUTED : R_BLOOD
    const kindLabel = isCorr ? 'CORRELATION' : 'SCOUT'
    const head = p.headline.length > 56 ? `${p.headline.slice(0, 54)}…` : p.headline
    const text = `<b style="color:${accent};font-size:9px;letter-spacing:0.1em;font-family:Bebas Neue,system-ui,sans-serif;">${kindLabel}</b><br><span style="color:${textMain};font-size:10px;">${escapeHtmlAttr(head)}</span>`
    const cols = p.columns_involved?.length ? p.columns_involved.join(', ') : '—'
    const rowLabel =
      !isCorr && p.rowIndex >= 0 ? `row ${p.rowIndex}` : '—'
    const hovertext = [
      escapeHtmlAttr(p.explanation),
      '',
      `Columns: ${escapeHtmlAttr(cols)} · ${rowLabel}`,
      `Suggested: ${escapeHtmlAttr(p.suggested_action)}`,
      `Score ${p.anomaly_score.toFixed(2)} · conf ${(p.confidence * 100).toFixed(0)}%`,
    ].join('<br>')
    return {
      xref: 'x',
      yref: 'y',
      x: px,
      y: py,
      text,
      showarrow: true,
      ax: 0,
      ay: -48,
      bordercolor: accent,
      borderwidth: 1.5,
      borderpad: 6,
      bgcolor: bg,
      font: { color: textMain, size: 10, family: 'DM Mono, ui-monospace, monospace' },
      align: 'left',
      arrowcolor: accent,
      arrowwidth: 1.2,
      arrowhead: 2,
      hovertext,
      width: 168,
    }
  })
}

/**
 * Markers on the outlier (align with scene.annotations callouts). Labels live on annotations, not the trace.
 * @param {import('../store/pinTypes.js').ScoutPin[]} pins
 * @param {'dark' | 'light'} [colorTheme]
 * @returns {Record<string, unknown> | null}
 */
export function buildScoutPinTrace3d(pins, colorTheme = 'dark') {
  if (!pins.length) return null
  const light = colorTheme === 'light'
  const outlier = R_BLOOD
  const correlation = R_BLOOD_MUTED
  const xs = []
  const ys = []
  const zs = []
  const symbols = []
  const colors = []
  const customdata = []
  for (const p of pins) {
    const [px, py, pz] = p.position
    xs.push(px)
    ys.push(py)
    zs.push(pz)
    const isCorr = p.kind === 'correlation'
    symbols.push(isCorr ? 'square' : 'diamond')
    colors.push(isCorr ? correlation : outlier)
    const rowBit =
      !isCorr && p.rowIndex >= 0
        ? ` · row ${p.rowIndex}`
        : ''
    const tip = isCorr
      ? `<b style="font-family:Bebas Neue,system-ui,sans-serif;letter-spacing:0.06em">Correlation</b><br>${escapeHtmlAttr(p.explanation)}<br><i>${escapeHtmlAttr(p.suggested_action)}</i>`
      : `<b style="font-family:Bebas Neue,system-ui,sans-serif;letter-spacing:0.06em">Outlier</b>${rowBit}<br>${escapeHtmlAttr(p.explanation)}<br><i>${escapeHtmlAttr(p.suggested_action)}</i>`
    customdata.push(tip)
  }
  return {
    type: 'scatter3d',
    name: 'Insight',
    mode: 'markers',
    x: xs,
    y: ys,
    z: zs,
    marker: {
      size: 12,
      symbol: symbols,
      color: colors,
      line: { width: 2, color: light ? 'rgba(0,0,0,0.35)' : 'rgba(245,245,240,0.85)' },
      opacity: 1,
    },
    showlegend: false,
    customdata: customdata,
    hovertemplate: '%{customdata}<extra></extra>',
    hoverlabel: {
      bgcolor: light ? R_HOVER_LIGHT_BG : R_HOVER_BG,
      bordercolor: light ? R_HOVER_LIGHT_BORDER : R_HOVER_BORDER,
      font: {
        family: 'DM Mono, ui-monospace, monospace',
        size: 11,
        color: light ? R_INK : R_BONE,
      },
    },
  }
}

/**
 * 2D projection of SCOUT markers (x,y in the same space as the 2D chart).
 * @param {import('../store/pinTypes.js').ScoutPin[]} pins
 * @param {'dark' | 'light'} [colorTheme]
 * @returns {Record<string, unknown> | null}
 */
export function buildScoutPinTrace2d(pins, colorTheme = 'dark') {
  if (!pins.length) return null
  const light = colorTheme === 'light'
  const outlier = R_BLOOD
  const correlation = R_BLOOD_MUTED
  const xs = []
  const ys = []
  const symbols = []
  const colors = []
  const customdata = []
  for (const p of pins) {
    const [px, py] = p.position
    xs.push(px)
    ys.push(py)
    const isCorr = p.kind === 'correlation'
    symbols.push(isCorr ? 'square' : 'diamond')
    colors.push(isCorr ? correlation : outlier)
    const rowBit =
      !isCorr && p.rowIndex >= 0
        ? ` · row ${p.rowIndex}`
        : ''
    const tip = isCorr
      ? `<b style="font-family:Bebas Neue,system-ui,sans-serif;letter-spacing:0.06em">Correlation</b><br>${escapeHtmlAttr(p.explanation)}<br><i>${escapeHtmlAttr(p.suggested_action)}</i>`
      : `<b style="font-family:Bebas Neue,system-ui,sans-serif;letter-spacing:0.06em">Outlier</b>${rowBit}<br>${escapeHtmlAttr(p.explanation)}<br><i>${escapeHtmlAttr(p.suggested_action)}</i>`
    customdata.push(tip)
  }
  return {
    type: 'scatter',
    name: 'Insight',
    mode: 'markers',
    x: xs,
    y: ys,
    marker: {
      size: 13,
      symbol: symbols,
      color: colors,
      line: { width: 2, color: light ? 'rgba(0,0,0,0.35)' : 'rgba(245,245,240,0.85)' },
    },
    showlegend: false,
    customdata: customdata,
    hovertemplate: '%{customdata}<extra></extra>',
    hoverlabel: {
      bgcolor: light ? R_HOVER_LIGHT_BG : R_HOVER_BG,
      bordercolor: light ? R_HOVER_LIGHT_BORDER : R_HOVER_BORDER,
      font: {
        family: 'DM Mono, ui-monospace, monospace',
        size: 11,
        color: light ? R_INK : R_BONE,
      },
    },
  }
}
