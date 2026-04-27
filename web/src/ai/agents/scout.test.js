import { describe, expect, it, vi } from 'vitest'
import { runScoutPipeline } from './scout.js'

vi.mock('../../utils/scoutRemote.js', () => ({
  fetchRemoteAnomalyScores: vi.fn(() => Promise.resolve(null)),
}))

describe('runScoutPipeline', () => {
  it('returns no pins when row count is below PRD minimum (50)', async () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({
      a: i,
      b: i * 2,
    }))
    const pins = await runScoutPipeline({
      rows,
      columns: ['a', 'b'],
      detectedTypes: { a: 'numeric', b: 'numeric' },
      axisMapping: { x: 'a', y: 'b', z: 'b' },
    })
    expect(pins).toEqual([])
  })
})
