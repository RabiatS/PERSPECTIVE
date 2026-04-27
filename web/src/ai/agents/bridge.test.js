import { describe, expect, it } from 'vitest'
import {
  buildInsightReportFromWorkspace,
  detectFormatFromName,
} from './bridge.js'

describe('bridge', () => {
  it('detectFormatFromName maps extensions', () => {
    expect(detectFormatFromName('x.csv')).toBe('csv')
    expect(detectFormatFromName('a.WAV')).toBe('audio')
    expect(detectFormatFromName('weird')).toBe('unknown')
  })

  it('buildInsightReportFromWorkspace includes scene context', () => {
    const report = buildInsightReportFromWorkspace({
      lensOutput: { recommendedChart: 'scatter3d' },
      scoutPins: [],
      datasetMeta: { name: 'Demo' },
      activeChartType: 'scatter3d',
      axisMapping: { x: 'a', y: 'b', z: 'c' },
      is2DMode: false,
      renderGeneration: 2,
      uploadSessionId: 5,
      scoutStatus: 'ready',
      lensStatus: 'ready',
    })
    expect(report.dataset).toBe('Demo')
    expect(report.scene?.renderGeneration).toBe(2)
    expect(report.scene?.axisMapping?.x).toBe('a')
    expect(report.exportedAt).toMatch(/^\d{4}-/)
  })
})
