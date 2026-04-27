import { describe, expect, it } from 'vitest'
import { decodeSceneState, encodeSceneState } from './sceneStateCodec.js'

describe('sceneStateCodec', () => {
  it('roundtrips chart, axes, camera, is2D', () => {
    const state = {
      chart: 'scatter3d',
      axes: { x: 'price', y: 'qty', z: 'region' },
      camera: [1.5, 2.5, 8],
      is2D: false,
    }
    const enc = encodeSceneState(state)
    expect(typeof enc).toBe('string')
    const dec = decodeSceneState(enc)
    expect(dec).toEqual(state)
  })

  it('returns null for invalid base64 / json', () => {
    expect(decodeSceneState('not-valid!!!')).toBeNull()
    expect(decodeSceneState('')).toBeNull()
  })
})
