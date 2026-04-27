/**
 * @param {unknown} v
 */
function toNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

/**
 * Z-score per column, then row score = 1 - exp(-max(|z|)/2.5) in [0,1)
 * @param {Record<string, unknown>[]} rows
 * @param {string[]} numericCols
 * @returns {{ scores: number[] }}
 */
export function clientAnomalyScores(rows, numericCols) {
  if (numericCols.length === 0 || rows.length === 0) {
    return { scores: [] }
  }
  const m = numericCols.length
  const colMeans = numericCols.map(() => 0)
  const colVars = numericCols.map(() => 0)
  let n = 0
  const vals = rows.map(() => numericCols.map(() => NaN))

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    let ok = true
    for (let j = 0; j < m; j++) {
      const v = toNum(row[numericCols[j]])
      if (!Number.isFinite(v)) {
        ok = false
        break
      }
      vals[i][j] = v
    }
    if (!ok) continue
    for (let j = 0; j < m; j++) colMeans[j] += vals[i][j]
    n++
  }
  if (n < 2) return { scores: rows.map(() => 0) }

  for (let j = 0; j < m; j++) colMeans[j] /= n
  for (let i = 0; i < rows.length; i++) {
    if (!vals[i].every((v) => Number.isFinite(v))) continue
    for (let j = 0; j < m; j++) {
      const d = vals[i][j] - colMeans[j]
      colVars[j] += d * d
    }
  }
  const colStd = colVars.map((v) => {
    const s = Math.sqrt(v / Math.max(1, n - 1))
    return s < 1e-9 ? 1 : s
  })

  const scores = []
  for (let i = 0; i < rows.length; i++) {
    if (!vals[i].every((v) => Number.isFinite(v))) {
      scores.push(0)
      continue
    }
    let maxZ = 0
    for (let j = 0; j < m; j++) {
      const z = Math.abs((vals[i][j] - colMeans[j]) / colStd[j])
      if (z > maxZ) maxZ = z
    }
    const s = 1 - Math.exp(-maxZ / 2.5)
    scores.push(s)
  }
  return { scores }
}

/**
 * Pearson r for two columns
 * @param {Record<string, unknown>[]} rows
 * @param {string} a
 * @param {string} b
 */
export function pearsonCorrelation(rows, a, b) {
  let n = 0
  let sumA = 0
  let sumB = 0
  let sumAA = 0
  let sumBB = 0
  let sumAB = 0
  for (const row of rows) {
    const x = toNum(row[a])
    const y = toNum(row[b])
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    n++
    sumA += x
    sumB += y
    sumAA += x * x
    sumBB += y * y
    sumAB += x * y
  }
  if (n < 3) return 0
  const num = sumAB - (sumA * sumB) / n
  const den = Math.sqrt(
    (sumAA - (sumA * sumA) / n) * (sumBB - (sumB * sumB) / n),
  )
  if (den < 1e-12) return 0
  return num / den
}

/**
 * @param {Record<string, unknown>[]} rows
 * @param {string[]} numericCols
 * @param {number} [minAbsR]
 * @returns {{ colA: string; colB: string; r: number }[]}
 */
export function strongCorrelationPairs(rows, numericCols, minAbsR = 0.92) {
  const out = []
  for (let i = 0; i < numericCols.length; i++) {
    for (let j = i + 1; j < numericCols.length; j++) {
      const ca = numericCols[i]
      const cb = numericCols[j]
      const r = pearsonCorrelation(rows, ca, cb)
      if (Math.abs(r) >= minAbsR) out.push({ colA: ca, colB: cb, r })
    }
  }
  out.sort((u, v) => Math.abs(v.r) - Math.abs(u.r))
  return out
}
