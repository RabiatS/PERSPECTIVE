function numCol(rows, col) {
  if (!col || !Array.isArray(rows) || rows.length === 0) return []
  return rows
    .map((r) => parseFloat(r[col]))
    .filter((v) => Number.isFinite(v))
}

function fmt(n, digits = 2) {
  if (!Number.isFinite(n)) return 'N/A'
  return n.toFixed(digits)
}

/**
 * Exactly four stats for the badge; never throws.
 * @param {{ rows?: Record<string, unknown>[]; rowCount?: number; columns?: string[] }} uploadedData
 * @param {{ x?: string; y?: string; z?: string }} axisMapping
 */
export function computeBadgeStats(uploadedData, axisMapping) {
  const safeAxis = axisMapping || {}
  const rows = uploadedData?.rows ?? []
  const rowsLen = uploadedData?.rowCount ?? rows.length
  const colCount =
    uploadedData?.columns?.length ??
    (rows.length > 0 && rows[0] && typeof rows[0] === 'object'
      ? Object.keys(rows[0]).length
      : 0)

  const stats = [
    { label: 'ROWS', value: Number(rowsLen).toLocaleString() },
    { label: 'COLUMNS', value: Number(colCount).toLocaleString() },
  ]

  const x = safeAxis.x
  const y = safeAxis.y
  const xv = numCol(rows, x)
  const yv = numCol(rows, y)

  const xMean =
    xv.length > 0 ? xv.reduce((a, b) => a + b, 0) / xv.length : NaN
  stats.push({
    label: x ? `${String(x).toUpperCase()} MEAN` : 'X MEAN',
    value: fmt(xMean),
  })

  const yMax = yv.length > 0 ? Math.max(...yv) : NaN
  stats.push({
    label: y ? `${String(y).toUpperCase()} MAX` : 'Y MAX',
    value: fmt(yMax),
  })

  return stats.slice(0, 4)
}
