import { analyzeColumns } from './datasetAnalysis.js'

/**
 * @param {unknown} coords
 * @returns {[number, number] | null}
 */
function pointCoords(coords) {
  if (!Array.isArray(coords) || coords.length < 2) return null
  const lng = Number(coords[0])
  const lat = Number(coords[1])
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
  return [lng, lat]
}

/**
 * @param {unknown} geom
 */
function coordsFromGeometry(geom) {
  if (!geom || typeof geom !== 'object') return null
  const g = /** @type {{ type?: string; coordinates?: unknown }} */ (geom)
  if (g.type === 'Point') return pointCoords(g.coordinates)
  if (g.type === 'Polygon' && Array.isArray(g.coordinates?.[0])) {
    const ring = g.coordinates[0]
    let sx = 0
    let sy = 0
    let n = 0
    for (const pt of ring) {
      const p = pointCoords(pt)
      if (p) {
        sx += p[0]
        sy += p[1]
        n++
      }
    }
    return n ? [sx / n, sy / n] : null
  }
  return null
}

/**
 * @param {Record<string, unknown>} parsed
 */
export function isGeoJson(parsed) {
  return (
    parsed &&
    typeof parsed === 'object' &&
    (parsed.type === 'FeatureCollection' ||
      parsed.type === 'Feature' ||
      parsed.type === 'GeometryCollection')
  )
}

/**
 * @param {Record<string, unknown>} parsed
 * @returns {import('./csvParser.js').ParsedDataset}
 */
export function geoJsonToDataset(parsed) {
  /** @type {Record<string, unknown>[]} */
  const rows = []
  const feats =
    parsed.type === 'FeatureCollection'
      ? /** @type {unknown[]} */ (parsed.features) ?? []
      : parsed.type === 'Feature'
        ? [parsed]
        : []

  for (const raw of feats) {
    if (!raw || typeof raw !== 'object') continue
    const f = /** @type {{ geometry?: unknown; properties?: unknown }} */ (raw)
    const ll = coordsFromGeometry(f.geometry)
    if (!ll) continue
    const props =
      f.properties && typeof f.properties === 'object' && !Array.isArray(f.properties)
        ? /** @type {Record<string, unknown>} */ (f.properties)
        : {}
    rows.push({
      ...props,
      lng: ll[0],
      lat: ll[1],
      value: props.value ?? props.z ?? props.mag ?? 0,
    })
  }

  if (rows.length === 0) {
    throw new Error('No point or polygon features with coordinates in GeoJSON')
  }

  const analysis = analyzeColumns(rows)
  return {
    rows,
    columns: analysis.columns,
    rowCount: analysis.rowCount,
    nullCounts: analysis.nullCounts,
    detectedTypes: analysis.detectedTypes,
  }
}
