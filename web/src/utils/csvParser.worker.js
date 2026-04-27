import Papa from 'papaparse'
import { analyzeColumns } from './datasetAnalysis.js'

self.onmessage = (e) => {
  const { csvText } = e.data
  try {
    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: 'greedy',
      dynamicTyping: false,
    })

    if (parsed.errors?.length) {
      const fatal = parsed.errors.find((err) => err.fatal)
      if (fatal) {
        self.postMessage({ error: fatal.message || 'CSV parse error' })
        return
      }
    }

    const rawRows = /** @type {Record<string, unknown>[]} */ (parsed.data || [])
    const rows = rawRows.filter(
      (row) => row && typeof row === 'object' && Object.keys(row).length > 0,
    )

    const analysis = analyzeColumns(rows)
    self.postMessage({
      result: {
        rows,
        columns: analysis.columns,
        rowCount: analysis.rowCount,
        nullCounts: analysis.nullCounts,
        detectedTypes: analysis.detectedTypes,
      },
    })
  } catch (err) {
    self.postMessage({
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
