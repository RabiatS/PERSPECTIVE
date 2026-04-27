import { analyzeColumns } from './datasetAnalysis.js'
import { geoJsonToDataset, isGeoJson } from './geoJsonToRows.js'
import { graphJsonToDataset, isGraphJsonRecord } from './graphToDataset.js'
import CsvWorker from './csvParser.worker.js?worker'

/**
 * @typedef {Object} ParsedDataset
 * @property {Record<string, unknown>[]} rows
 * @property {string[]} columns
 * @property {number} rowCount
 * @property {Record<string, number>} nullCounts
 * @property {Record<string, 'numeric' | 'categorical' | 'datetime'>} detectedTypes
 * @property {[number, number][]} [graphLinks] — node row index pairs when JSON is a graph
 */

/**
 * Parse CSV in a Web Worker (PapaParse) to avoid blocking the main thread.
 * @param {File} file
 * @returns {Promise<ParsedDataset>}
 */
export function parseCSV(file) {
  return new Promise((resolve, reject) => {
    const worker = new CsvWorker()
    worker.onmessage = (e) => {
      worker.terminate()
      if (e.data?.error) {
        reject(new Error(e.data.error))
        return
      }
      if (e.data?.result) {
        resolve(e.data.result)
        return
      }
      reject(new Error('CSV worker returned no result'))
    }
    worker.onerror = (err) => {
      worker.terminate()
      reject(err.error ?? err)
    }
    file
      .text()
      .then((csvText) => worker.postMessage({ csvText }))
      .catch((err) => {
        worker.terminate()
        reject(err)
      })
  })
}

/**
 * Parse JSON dataset on the main thread (array of objects).
 * @param {File} file
 * @returns {Promise<ParsedDataset>}
 */
export async function parseJSONFile(file) {
  const text = await file.text()
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Invalid JSON file')
  }

  if (isGeoJson(/** @type {Record<string, unknown>} */ (parsed))) {
    return geoJsonToDataset(/** @type {Record<string, unknown>} */ (parsed))
  }

  if (isGraphJsonRecord(parsed)) {
    return graphJsonToDataset(/** @type {Record<string, unknown>} */ (parsed))
  }

  let rows
  if (Array.isArray(parsed)) {
    rows = parsed
  } else if (
    parsed &&
    typeof parsed === 'object' &&
    Array.isArray(parsed.data)
  ) {
    rows = parsed.data
  } else if (
    parsed &&
    typeof parsed === 'object' &&
    Array.isArray(parsed.rows)
  ) {
    rows = parsed.rows
  } else {
    throw new Error(
      'JSON must be an array of objects, or an object with a "data" or "rows" array',
    )
  }

  if (!rows.every((r) => r && typeof r === 'object' && !Array.isArray(r))) {
    throw new Error('JSON rows must be objects')
  }

  const analysis = analyzeColumns(/** @type {Record<string, unknown>[]} */ (rows))
  return {
    rows: /** @type {Record<string, unknown>[]} */ (rows),
    columns: analysis.columns,
    rowCount: analysis.rowCount,
    nullCounts: analysis.nullCounts,
    detectedTypes: analysis.detectedTypes,
  }
}
