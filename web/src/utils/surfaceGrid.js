/**
 * Reshape 1D x, y, z into a 2D z-grid for Plotly surface traces.
 * Duplicate (x,y) pairs average z.
 * @param {number[]} x
 * @param {number[]} y
 * @param {number[]} z
 * @returns {{ z: number[][]; x: number[]; y: number[] }}
 */
export function reshapeToSurfaceGrid(x, y, z) {
  const uniqueX = [...new Set(x.filter((v) => Number.isFinite(v)))].sort(
    (a, b) => a - b,
  )
  const uniqueY = [...new Set(y.filter((v) => Number.isFinite(v)))].sort(
    (a, b) => a - b,
  )
  if (uniqueX.length === 0 || uniqueY.length === 0) {
    return { z: [[0]], x: [0], y: [0] }
  }
  const grid = uniqueY.map(() => uniqueX.map(() => NaN))
  const xi = new Map(uniqueX.map((v, i) => [v, i]))
  const yi = new Map(uniqueY.map((v, i) => [v, i]))
  const counts = uniqueY.map(() => uniqueX.map(() => 0))
  const sums = uniqueY.map(() => uniqueX.map(() => 0))

  for (let i = 0; i < x.length; i++) {
    const u = xi.get(x[i])
    const v = yi.get(y[i])
    if (u === undefined || v === undefined) continue
    sums[v][u] += z[i]
    counts[v][u] += 1
  }
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (counts[r][c] > 0) grid[r][c] = sums[r][c] / counts[r][c]
    }
  }
  return { z: grid, x: uniqueX, y: uniqueY }
}
