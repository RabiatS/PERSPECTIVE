import { describe, expect, it } from 'vitest'
import { axisValueToNumber, rowsToXYZArrays } from './chartUtils.js'

describe('axisValueToNumber', () => {
  it('parses ISO datetime when column is typed datetime', () => {
    const types = { t: 'datetime' }
    const n = axisValueToNumber('2026-01-15T12:00:00Z', 't', types)
    expect(Number.isFinite(n)).toBe(true)
    expect(n).toBe(Date.parse('2026-01-15T12:00:00Z'))
  })

  it('does not parse dates for numeric columns', () => {
    const types = { v: 'numeric' }
    expect(Number.isNaN(axisValueToNumber('2026-01-01', 'v', types))).toBe(
      true,
    )
  })
})

describe('rowsToXYZArrays', () => {
  it('maps datetime + numerics to finite coordinates', () => {
    const rows = [
      { t: '2026-01-01T00:00:00Z', a: 1, b: 2 },
      { t: '2026-01-02T00:00:00Z', a: 3, b: 4 },
    ]
    const types = { t: 'datetime', a: 'numeric', b: 'numeric' }
    const { x, y, z } = rowsToXYZArrays(rows, { x: 't', y: 'a', z: 'b' }, types)
    expect(x.every((v) => Number.isFinite(v))).toBe(true)
    expect(y).toEqual([1, 3])
    expect(z).toEqual([2, 4])
  })
})
