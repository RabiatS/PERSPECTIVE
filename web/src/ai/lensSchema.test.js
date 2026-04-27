import { describe, expect, it } from 'vitest'
import { validateAndNormalizeLensOutput } from './lensSchema.js'

const ctx = {
  columns: ['a', 'b', 'c'],
  detectedTypes: { a: 'numeric', b: 'numeric', c: 'numeric' },
}

describe('validateAndNormalizeLensOutput', () => {
  it('fills defaults for garbage input', () => {
    const { output, warnings } = validateAndNormalizeLensOutput(null, ctx)
    expect(output.axisMapping.x).toBe('a')
    expect(warnings.length).toBeGreaterThan(0)
  })

  it('accepts valid payload', () => {
    const { output, warnings } = validateAndNormalizeLensOutput(
      {
        dataType: 'tabular',
        recommendedChart: 'surface',
        reasoning: 'ok',
        axisMapping: { x: 'a', y: 'b', z: 'c' },
        flaggedNulls: [],
        flaggedOutliers: [],
        confidence: 0.9,
      },
      ctx,
    )
    expect(output.recommendedChart).toBe('surface')
    expect(output.confidence).toBe(0.9)
    expect(warnings.length).toBe(0)
  })

  it('clamps confidence', () => {
    const { output } = validateAndNormalizeLensOutput(
      { confidence: 2, axisMapping: { x: 'a', y: 'b', z: 'c' } },
      ctx,
    )
    expect(output.confidence).toBe(1)
  })

  it('warns when confidence is below PRD 0.6 gate', () => {
    const { output, warnings } = validateAndNormalizeLensOutput(
      {
        dataType: 'tabular',
        recommendedChart: 'scatter3d',
        reasoning: 'x',
        axisMapping: { x: 'a', y: 'b', z: 'c' },
        flaggedNulls: [],
        flaggedOutliers: [],
        confidence: 0.45,
      },
      ctx,
    )
    expect(output.confidence).toBe(0.45)
    expect(warnings.some((w) => w.includes('0.6'))).toBe(true)
  })

  it('allows datetime column on an axis (time → surface)', () => {
    const tsCtx = {
      columns: ['observed_at', 'temp_c', 'humidity_pct'],
      detectedTypes: {
        observed_at: 'datetime',
        temp_c: 'numeric',
        humidity_pct: 'numeric',
      },
    }
    const { output, warnings } = validateAndNormalizeLensOutput(
      {
        dataType: 'time-series',
        recommendedChart: 'surface',
        reasoning: 'time + metrics',
        axisMapping: { x: 'observed_at', y: 'temp_c', z: 'humidity_pct' },
        flaggedNulls: [],
        flaggedOutliers: [],
        confidence: 0.85,
      },
      tsCtx,
    )
    expect(output.axisMapping.x).toBe('observed_at')
    expect(output.recommendedChart).toBe('surface')
    expect(
      warnings.filter((w) => w.includes('numeric fallback')).length,
    ).toBe(0)
  })
})
