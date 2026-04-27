/**
 * Plotly 3D scene cameras aligned with Three.js orbit presets in CameraPresets.jsx
 * (R3F Y-up: bird/top from +Y, front from +Z, side from +X, iso diagonal).
 * Values are normalized “orbit” distances; Plotly auto-framing still applies to data bounds.
 */

/** @typedef {{ eye: { x: number; y: number; z: number }; center: { x: number; y: number; z: number }; up: { x: number; y: number; z: number } }} PlotlySceneCamera */

/** @type {Record<string, PlotlySceneCamera>} */
export const PLOTLY_SCENE_CAMERAS = {
  bird: {
    center: { x: 0, y: 0, z: 0 },
    up: { x: 0, y: 0, z: 1 },
    eye: { x: 0.35, y: 2.75, z: 0.35 },
  },
  iso: {
    center: { x: 0, y: 0, z: 0 },
    up: { x: 0, y: 0, z: 1 },
    eye: { x: 1.45, y: 1.45, z: 1.45 },
  },
  front: {
    center: { x: 0, y: 0, z: 0 },
    up: { x: 0, y: 0, z: 1 },
    eye: { x: 0, y: -2.65, z: 0.2 },
  },
  side: {
    center: { x: 0, y: 0, z: 0 },
    up: { x: 0, y: 0, z: 1 },
    eye: { x: 2.65, y: 0, z: 0.25 },
  },
  top: {
    center: { x: 0, y: 0, z: 0 },
    up: { x: 0, y: 1, z: 0 },
    eye: { x: 0, y: 0.02, z: 2.75 },
  },
}

/**
 * @param {Record<string, unknown>} baseLayout
 * @param {string | null | undefined} presetId
 */
export function mergePlotlySceneCamera(baseLayout, presetId) {
  if (!baseLayout?.scene || !presetId) return baseLayout
  const cam = PLOTLY_SCENE_CAMERAS[presetId]
  if (!cam) return baseLayout
  return {
    ...baseLayout,
    scene: {
      ...baseLayout.scene,
      camera: cam,
    },
  }
}
