import { geoJsonToDataset, isGeoJson } from './geoJsonToRows.js'

/**
 * @param {File} file
 * @returns {Promise<import('./csvParser.js').ParsedDataset>}
 */
export async function parseGeoJsonFile(file) {
  let parsed
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    throw new Error('Invalid GeoJSON (parse error)')
  }
  if (!isGeoJson(/** @type {Record<string, unknown>} */ (parsed))) {
    throw new Error('Not a GeoJSON FeatureCollection / Feature')
  }
  return geoJsonToDataset(/** @type {Record<string, unknown>} */ (parsed))
}
