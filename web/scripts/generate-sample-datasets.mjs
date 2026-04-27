/**
 * Writes large synthetic CSVs similar to reference visualizations:
 * 1) UMAP/t-SNE-like gene + disease embedding (heavily imbalanced classes)
 * 2) Astro/simulation-style plume (Total_Energy, Gas_Energy, Density)
 *
 * Usage: node scripts/generate-sample-datasets.mjs [--gene-rows=N] [--plume-rows=N]
 */
import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PUBLIC = join(__dirname, '..', 'public')

function mulberry32(seed) {
  let a = seed >>> 0
  return function next() {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randn(rng) {
  let u = 0
  let v = 0
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

/** Target counts from reference legend (scaled to totalRows) */
const GENE_CATEGORY_DEF = [
  ['Genes', 911_568],
  ['Adenocarcinoma', 166],
  ['Ataxia', 140],
  ['Carcinoma', 130],
  ['Hepatitis', 1189],
  ['Hypertension', 162],
  ['Infection', 9762],
  ['Leukemia', 3632],
  ['Lymphoma', 16],
  ['MuscularAtrophy', 3],
  ['Obesity', 474],
  ['Sarcoma', 101],
  ['Schizophrenia', 78],
]

function allocateGeneCounts(totalRows) {
  const weights = GENE_CATEGORY_DEF.map(([, c]) => c)
  const wsum = weights.reduce((a, b) => a + b, 0)
  const raw = weights.map((w) => (w / wsum) * totalRows)
  const counts = raw.map((v) => Math.max(0, Math.floor(v)))
  let deficit = totalRows - counts.reduce((a, b) => a + b, 0)
  const order = raw
    .map((v, i) => ({ i, r: v - Math.floor(v) }))
    .sort((a, b) => b.r - a.r)
  for (let k = 0; k < deficit; k++) counts[order[k % order.length].i]++
  if (counts[0] < 1) counts[0] = 1
  return counts
}

function writeGeneEmbedding(outPath, totalRows, seed = 0x9e3779b9) {
  const rng = mulberry32(seed)
  const counts = allocateGeneCounts(totalRows)
  const centers = []
  for (let i = 0; i < GENE_CATEGORY_DEF.length; i++) {
    if (i === 0) {
      centers.push([0, 0, 0])
    } else {
      const theta = 2 * Math.PI * rng()
      const phi = Math.acos(2 * rng() - 1)
      const r = 2.2 + rng() * 4.5
      centers.push([
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi),
      ])
    }
  }
  const sigmas = counts.map((_, i) => (i === 0 ? 1.15 : 0.12 + rng() * 0.18))

  const stream = createWriteStream(outPath, { encoding: 'utf8' })
  stream.write('id,x,y,z,label,category\n')

  let id = 1
  for (let ci = 0; ci < GENE_CATEGORY_DEF.length; ci++) {
    const [name] = GENE_CATEGORY_DEF[ci]
    const [cx, cy, cz] = centers[ci]
    const sig = sigmas[ci]
    const n = counts[ci]
    for (let j = 0; j < n; j++) {
      const x = cx + sig * randn(rng)
      const y = cy + sig * randn(rng)
      const z = cz + sig * randn(rng)
      stream.write(
        `${id},${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)},${ci},${name}\n`,
      )
      id++
    }
  }
  return new Promise((resolve, reject) => {
    stream.end(() => resolve())
    stream.on('error', reject)
  })
}

function writeSimulationPlume(outPath, totalRows, seed = 0xdeadbeef) {
  const rng = mulberry32(seed)
  const stream = createWriteStream(outPath, { encoding: 'utf8' })
  stream.write('id,Cycle,Time,Total_Energy,Gas_Energy,Density\n')

  for (let i = 1; i <= totalRows; i++) {
    const t = Math.pow(rng(), 0.55)
    const swirl = Math.sin(t * Math.PI * 2.8) * 0.12
    const Total_Energy = 0.05 + 0.92 * t + 0.04 * randn(rng) * (0.15 + t)
    const Gas_Energy =
      -5.2 + 6.1 * (1 - t) * (1 - t) + swirl + (0.1 + 0.35 * t) * randn(rng)
    const Density =
      -5.95 + 0.75 * t + 0.15 * Math.cos(t * Math.PI * 3) + (0.08 + 0.25 * t) * randn(rng)
    const Cycle = 180 + Math.floor(rng() * 40)
    const Time = 95 + rng() * 14
    stream.write(
      `${i},${Cycle},${Time.toFixed(3)},${Total_Energy.toFixed(6)},${Gas_Energy.toFixed(6)},${Density.toFixed(6)}\n`,
    )
  }
  return new Promise((resolve, reject) => {
    stream.end(() => resolve())
    stream.on('error', reject)
  })
}

function parseArgs() {
  const a = process.argv.slice(2)
  let geneRows = 75_000
  let plumeRows = 50_000
  for (const x of a) {
    if (x.startsWith('--gene-rows='))
      geneRows = Math.max(1000, parseInt(x.split('=')[1], 10) || geneRows)
    if (x.startsWith('--plume-rows='))
      plumeRows = Math.max(1000, parseInt(x.split('=')[1], 10) || plumeRows)
  }
  return { geneRows, plumeRows }
}

await mkdir(PUBLIC, { recursive: true })
const { geneRows, plumeRows } = parseArgs()

const genePath = join(PUBLIC, 'sample-gene-embedding-umap-like.csv')
const plumePath = join(PUBLIC, 'sample-simulation-plume.csv')

console.error(`Writing ${geneRows} rows -> ${genePath}`)
await writeGeneEmbedding(genePath, geneRows)
console.error(`Writing ${plumeRows} rows -> ${plumePath}`)
await writeSimulationPlume(plumePath, plumeRows)
console.error('Done.')
