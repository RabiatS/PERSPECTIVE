/**
 * Map Plotly `plotly_selected` / `onSelected` points to full-dataset row indices
 * (aligned with `sampleRowsForChart` → `rowIndices`).
 *
 * When there are multiple traces, pass the **row-indexed** scatter’s curve index
 * (e.g. main data before a SCOUT overlay) via `mainCurveIndex`. If omitted, the
 * last curve is used (edges + nodes, or main-only).
 *
 * @param {unknown} ev — Plotly event payload with `points[]`
 * @param {number[]} rowIndices
 * @param {number} traceCount — `data.length` passed to Plotly
 * @param {number} [mainCurveIndex] — row-indexed scatter trace (e.g. when SCOUT is last for z-order, pass the main scatter index)
 * @returns {number[]}
 */
export function plotlySelectionToGlobalRowIndices(
  ev,
  rowIndices,
  traceCount,
  mainCurveIndex,
) {
  const pts = /** @type {{ points?: { pointIndex?: number; curveNumber?: number }[] }} */ (
    ev
  )?.points ?? []
  const mainCurve =
    typeof mainCurveIndex === 'number'
      ? mainCurveIndex
      : Math.max(0, traceCount - 1)
  const filtered = pts.filter((p) => {
    const cn = p.curveNumber
    return typeof cn !== 'number' || cn === mainCurve
  })
  const local = [
    ...new Set(
      filtered
        .map((p) => p.pointIndex)
        .filter((i) => typeof i === 'number'),
    ),
  ]
  return local.map((i) => rowIndices[i]).filter((i) => i != null)
}
