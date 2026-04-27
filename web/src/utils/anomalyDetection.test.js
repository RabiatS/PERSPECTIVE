import { describe, expect, it } from 'vitest'
import {
  clientAnomalyScores,
  pearsonCorrelation,
  strongCorrelationPairs,
} from './anomalyDetection.js'

describe('clientAnomalyScores', () => {
  it('scores length matches rows', () => {
    const rows = Array.from({ length: 60 }, (_, i) => ({
      a: i,
      b: i * 2,
    }))
    const { scores } = clientAnomalyScores(rows, ['a', 'b'])
    expect(scores.length).toBe(60)
  })
})

describe('pearsonCorrelation', () => {
  it('is ~1 for identical columns', () => {
    const rows = [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }]
    expect(pearsonCorrelation(rows, 'x', 'y')).toBeCloseTo(1, 5)
  })
})

describe('strongCorrelationPairs', () => {
  it('uses minAbsR (PRD correlation pins use 0.85)', () => {
    const rows = [
      { a: 1, b: 2, c: 100 },
      { a: 2, b: 4, c: -5 },
      { a: 3, b: 6, c: 12 },
    ]
    const loose = strongCorrelationPairs(rows, ['a', 'b', 'c'], 0.85)
    expect(loose.some((p) => p.colA === 'a' && p.colB === 'b')).toBe(true)
    const strict = strongCorrelationPairs(rows, ['a', 'b', 'c'], 0.999)
    expect(strict.find((p) => p.colA === 'a' && p.colB === 'b')?.r).toBeCloseTo(
      1,
      5,
    )
  })
})
