import { describe, expect, it } from 'vitest'
import { plotlySelectionToGlobalRowIndices } from './plotlySelection.js'

describe('plotlySelectionToGlobalRowIndices', () => {
  const rowIndices = [100, 101, 102, 103]

  it('maps pointIndex through rowIndices for a single trace', () => {
    const ev = { points: [{ pointIndex: 1, curveNumber: 0 }] }
    expect(plotlySelectionToGlobalRowIndices(ev, rowIndices, 1)).toEqual([101])
  })

  it('uses only the last trace (nodes) when multiple traces exist', () => {
    const ev = {
      points: [
        { pointIndex: 0, curveNumber: 0 },
        { pointIndex: 2, curveNumber: 1 },
      ],
    }
    expect(plotlySelectionToGlobalRowIndices(ev, rowIndices, 2)).toEqual([102])
  })

  it('uses mainCurveIndex when the row scatter is not the last trace (e.g. SCOUT on top)', () => {
    const ev = { points: [{ pointIndex: 1, curveNumber: 0 }] }
    // traces: [main scatter, scout overlay] — lasso on curve 0 only
    expect(plotlySelectionToGlobalRowIndices(ev, rowIndices, 2, 0)).toEqual([101])
    const evPin = { points: [{ pointIndex: 0, curveNumber: 1 }] }
    expect(plotlySelectionToGlobalRowIndices(evPin, rowIndices, 2, 0)).toEqual([])
  })
})
