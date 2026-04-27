import { analyzeColumns } from './datasetAnalysis.js'

const MAX_AUDIO_BYTES = 25 * 1024 * 1024

/**
 * Coarse time–frequency energy surface (STFT-style tiling without full FFT).
 * @param {File} file
 * @returns {Promise<import('./csvParser.js').ParsedDataset>}
 */
export async function audioToFftSurface(file) {
  if (file.size > MAX_AUDIO_BYTES) {
    throw new Error('Audio file too large (max ~25MB)')
  }
  const ctx = new AudioContext()
  try {
    const buf = await ctx.decodeAudioData(await file.arrayBuffer())
    const data = buf.getChannelData(0)
    const frames = 48
    const bands = 36
    const maxSamples = Math.min(data.length, buf.sampleRate * 90)
    /** @type {Record<string, unknown>[]} */
    const rows = []
    for (let ti = 0; ti < frames; ti++) {
      const t0 = Math.floor((maxSamples * ti) / frames)
      const t1 = Math.floor((maxSamples * (ti + 1)) / frames)
      const slice = data.subarray(t0, t1)
      if (slice.length < 8) continue
      for (let bi = 0; bi < bands; bi++) {
        const b0 = Math.floor((slice.length * bi) / bands)
        const b1 = Math.floor((slice.length * (bi + 1)) / bands)
        let s = 0
        for (let k = b0; k < b1; k++) s += slice[k] * slice[k]
        const rms = Math.sqrt(s / Math.max(1, b1 - b0))
        rows.push({
          time: ti,
          freq_bin: bi,
          amplitude: rms * 100,
        })
      }
    }
    const analysis = analyzeColumns(rows)
    return {
      rows,
      columns: analysis.columns,
      rowCount: analysis.rowCount,
      nullCounts: analysis.nullCounts,
      detectedTypes: analysis.detectedTypes,
    }
  } finally {
    await ctx.close()
  }
}
