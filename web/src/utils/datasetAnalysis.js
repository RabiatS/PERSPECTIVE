/**
 * @param {unknown} v
 */
function isNullish(v) {
  if (v === null || v === undefined) return true
  if (typeof v === 'string' && v.trim() === '') return true
  if (typeof v === 'number' && Number.isNaN(v)) return true
  return false
}

/**
 * @param {string} s
 */
function looksNumeric(s) {
  if (s === '' || s === null || s === undefined) return false
  const t = String(s).trim().replace(/,/g, '')
  if (t === '') return false
  return Number.isFinite(Number(t))
}

/**
 * @param {string} s
 */
function looksDatetime(s) {
  const t = String(s).trim()
  if (!t) return false
  const d = Date.parse(t)
  if (!Number.isFinite(d)) return false
  if (t.length < 4) return false
  return true
}

/**
 * @param {Record<string, unknown>[]} rows
 * @returns {{ columns: string[]; rowCount: number; nullCounts: Record<string, number>; detectedTypes: Record<string, 'numeric' | 'categorical' | 'datetime'> }}
 */
export function analyzeColumns(rows) {
  const rowCount = rows.length
  if (rowCount === 0) {
    return {
      columns: [],
      rowCount: 0,
      nullCounts: {},
      detectedTypes: {},
    }
  }

  const keySet = new Set()
  for (const row of rows) {
    if (row && typeof row === 'object') {
      for (const k of Object.keys(row)) keySet.add(k)
    }
  }
  const columns = [...keySet]

  /** @type {Record<string, number>} */
  const nullCounts = {}
  for (const c of columns) nullCounts[c] = 0

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    for (const c of columns) {
      if (isNullish(row[c])) nullCounts[c] += 1
    }
  }

  /** @type {Record<string, 'numeric' | 'categorical' | 'datetime'>} */
  const detectedTypes = {}

  for (const c of columns) {
    let nonNull = 0
    let numericOk = 0
    let dtOk = 0
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue
      const v = row[c]
      if (isNullish(v)) continue
      nonNull += 1
      if (typeof v === 'number' && Number.isFinite(v)) {
        numericOk += 1
        continue
      }
      const s = String(v).trim()
      if (looksNumeric(s)) numericOk += 1
      if (looksDatetime(s)) dtOk += 1
    }

    if (nonNull === 0) {
      detectedTypes[c] = 'categorical'
      continue
    }

    const numRatio = numericOk / nonNull
    const dtRatio = dtOk / nonNull

    if (dtRatio >= 0.7 && dtRatio >= numRatio) {
      detectedTypes[c] = 'datetime'
    } else if (numRatio >= 0.85) {
      detectedTypes[c] = 'numeric'
    } else {
      detectedTypes[c] = 'categorical'
    }
  }

  return { columns, rowCount, nullCounts, detectedTypes }
}
