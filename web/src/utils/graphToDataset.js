import { analyzeColumns } from './datasetAnalysis.js'
import { layoutGraph3D } from './graphLayout.js'

/**
 * @param {unknown} parsed
 * @returns {parsed is Record<string, unknown>}
 */
export function isGraphJsonRecord(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false
  const o = /** @type {Record<string, unknown>} */ (parsed)
  if (!Array.isArray(o.nodes) || o.nodes.length === 0) return false
  const links = o.links ?? o.edges
  if (!Array.isArray(links)) return false
  return true
}

/**
 * @param {unknown[]} nodes
 */
function inferNodeIdField(nodes) {
  const first = nodes.find(
    (n) => n && typeof n === 'object' && !Array.isArray(n),
  )
  if (!first) return null
  const keys = ['id', 'name', 'key', 'label', 'title', 'nodeId']
  for (const k of keys) {
    if (
      k in /** @type {Record<string, unknown>} */ (first) &&
      /** @type {Record<string, unknown>} */ (first)[k] != null &&
      String(/** @type {Record<string, unknown>} */ (first)[k]).length > 0
    ) {
      return k
    }
  }
  return null
}

/**
 * @param {Record<string, unknown>[]} rows
 */
function hasPresetXYZ(rows) {
  if (rows.length === 0) return false
  const r0 = rows[0]
  return (
    Number.isFinite(Number(r0.x)) &&
    Number.isFinite(Number(r0.y)) &&
    Number.isFinite(Number(r0.z))
  )
}

/**
 * D3-style or Obsidian-export-like graph JSON → tabular rows + link index pairs.
 * @param {Record<string, unknown>} parsed
 */
export function graphJsonToDataset(parsed) {
  const nodes = /** @type {unknown[]} */ (parsed.nodes)
  const rawLinks = /** @type {unknown[]} */ (parsed.links ?? parsed.edges)

  const idField =
    typeof parsed.nodeIdField === 'string' && parsed.nodeIdField.trim()
      ? parsed.nodeIdField.trim()
      : inferNodeIdField(nodes) ?? 'id'

  const rows = nodes.map((node, idx) => {
    if (node && typeof node === 'object' && !Array.isArray(node)) {
      return { .../** @type {Record<string, unknown>} */ (node) }
    }
    return { [idField]: String(idx), value: node }
  })

  for (let i = 0; i < rows.length; i++) {
    if (!(idField in rows[i]) || rows[i][idField] == null) {
      rows[i][idField] = String(i)
    }
  }

  /** @type {Map<string, number>} */
  const idToIndex = new Map()
  rows.forEach((row, i) => {
    const idVal = row[idField]
    const key = idVal != null ? String(idVal) : String(i)
    idToIndex.set(key, i)
    idToIndex.set(String(i), i)
  })

  /** @type {[number, number][]} */
  const linkPairs = []
  for (const L of rawLinks) {
    if (!L || typeof L !== 'object' || Array.isArray(L)) continue
    const o = /** @type {Record<string, unknown>} */ (L)
    const s = o.source ?? o.from ?? o.start ?? o.s
    const t = o.target ?? o.to ?? o.end ?? o.t
    if (s == null || t == null) continue

    let si
    if (typeof s === 'number' && Number.isFinite(s)) {
      const i = Math.trunc(s)
      si = i >= 0 && i < rows.length ? i : idToIndex.get(String(s))
    } else {
      si = idToIndex.get(String(s))
    }

    let ti
    if (typeof t === 'number' && Number.isFinite(t)) {
      const i = Math.trunc(t)
      ti = i >= 0 && i < rows.length ? i : idToIndex.get(String(t))
    } else {
      ti = idToIndex.get(String(t))
    }

    if (si === undefined || ti === undefined) continue
    if (si === ti) continue
    linkPairs.push([si, ti])
  }

  const layoutSeed =
    (typeof parsed.layoutSeed === 'number' && Number.isFinite(parsed.layoutSeed)
      ? parsed.layoutSeed
      : rows.length + linkPairs.length) | 0

  if (hasPresetXYZ(rows)) {
    for (const row of rows) {
      row.graph_x = Number(row.x)
      row.graph_y = Number(row.y)
      row.graph_z = Number(row.z)
    }
  } else {
    const { x, y, z } = layoutGraph3D(rows.length, linkPairs, layoutSeed)
    for (let i = 0; i < rows.length; i++) {
      rows[i].graph_x = x[i]
      rows[i].graph_y = y[i]
      rows[i].graph_z = z[i]
    }
  }

  const analysis = analyzeColumns(rows)
  return {
    rows,
    columns: analysis.columns,
    rowCount: analysis.rowCount,
    nullCounts: analysis.nullCounts,
    detectedTypes: analysis.detectedTypes,
    graphLinks: linkPairs,
  }
}
