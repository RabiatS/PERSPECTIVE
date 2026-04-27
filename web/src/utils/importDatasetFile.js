import { parseCSV, parseJSONFile } from './csvParser.js'
import { parseGeoJsonFile } from './parseGeoJsonFile.js'
import { audioToFftSurface } from './audioFFT.js'

export const DATASET_ACCEPT = new Set(['.csv', '.json', '.geojson', '.wav', '.mp3'])

function extname(name) {
  const i = name.lastIndexOf('.')
  if (i < 0) return ''
  return name.slice(i).toLowerCase()
}

/**
 * @param {File} file
 */
export async function importDatasetFile(file) {
  const ext = extname(file.name)
  if (!DATASET_ACCEPT.has(ext)) {
    throw new Error('Supported: .csv, .json, .geojson, .wav, .mp3')
  }
  if (ext === '.csv') return parseCSV(file)
  if (ext === '.geojson') return parseGeoJsonFile(file)
  if (ext === '.wav' || ext === '.mp3') return audioToFftSurface(file)
  return parseJSONFile(file)
}
