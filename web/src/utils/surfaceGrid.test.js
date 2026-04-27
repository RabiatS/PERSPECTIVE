import { describe, expect, it } from 'vitest'
import { reshapeToSurfaceGrid } from './surfaceGrid.js'

describe('reshapeToSurfaceGrid', () => {
  it('builds grid for simple plane', () => {
    const { x, y, z } = reshapeToSurfaceGrid(
      [0, 1, 0, 1],
      [0, 0, 1, 1],
      [1, 2, 3, 4],
    )
    expect(x.length).toBe(2)
    expect(y.length).toBe(2)
    expect(z[0].length).toBe(2)
  })

  it('handles no finite points', () => {
    const r = reshapeToSurfaceGrid([NaN], [NaN], [NaN])
    expect(r.x).toEqual([0])
    expect(r.y).toEqual([0])
  })
})
