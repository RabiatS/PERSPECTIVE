/**
 * @param {number} seed
 */
function mulberry32(seed) {
  let a = seed >>> 0
  return function next() {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * @param {[number, number][]} links
 * @returns {[number, number][]}
 */
function dedupeUndirected(links) {
  const seen = new Set()
  const out = []
  for (const [s, t] of links) {
    if (s === t) continue
    const a = Math.min(s, t)
    const b = Math.max(s, t)
    const k = `${a}\0${b}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push([s, t])
  }
  return out
}

/**
 * Simple force-inspired layout (no extra deps). Good enough for Obsidian-scale graphs in 3D.
 * @param {number} n
 * @param {[number, number][]} links
 * @param {number} seed
 * @returns {{ x: number[]; y: number[]; z: number[] }}
 */
export function layoutGraph3D(n, links, seed = 1) {
  const rng = mulberry32(seed)
  const x = new Float64Array(n)
  const y = new Float64Array(n)
  const z = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const theta = rng() * Math.PI * 2
    const phi = Math.acos(2 * rng() - 1)
    const r = 1.8 + rng() * 0.8
    x[i] = r * Math.sin(phi) * Math.cos(theta)
    y[i] = r * Math.sin(phi) * Math.sin(theta)
    z[i] = r * Math.cos(phi)
  }

  const pairs = dedupeUndirected(links)
  const iterations = n > 800 ? 35 : 50
  const repSamples = Math.min(60, Math.max(20, n * 2))

  for (let iter = 0; iter < iterations; iter++) {
    const fx = new Float64Array(n)
    const fy = new Float64Array(n)
    const fz = new Float64Array(n)

    for (const [s, t] of pairs) {
      let dx = x[t] - x[s]
      let dy = y[t] - y[s]
      let dz = z[t] - z[s]
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.02
      const ideal = 1.15
      const pull = 0.045 * (dist - ideal) / dist
      const px = dx * pull
      const py = dy * pull
      const pz = dz * pull
      fx[s] += px
      fy[s] += py
      fz[s] += pz
      fx[t] -= px
      fy[t] -= py
      fz[t] -= pz
    }

    for (let k = 0; k < repSamples; k++) {
      const i = (rng() * n) | 0
      const j = (rng() * n) | 0
      if (i === j) continue
      let dx = x[i] - x[j]
      let dy = y[i] - y[j]
      let dz = z[i] - z[j]
      const dist2 = dx * dx + dy * dy + dz * dz + 0.04
      const rep = 0.09 / dist2
      fx[i] += dx * rep
      fy[i] += dy * rep
      fz[i] += dz * rep
    }

    for (let i = 0; i < n; i++) {
      x[i] += fx[i]
      y[i] += fy[i]
      z[i] += fz[i]
      x[i] *= 0.985
      y[i] *= 0.985
      z[i] *= 0.985
    }
  }

  return {
    x: Array.from(x),
    y: Array.from(y),
    z: Array.from(z),
  }
}
