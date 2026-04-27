/**
 * Native Three.js scene layer — only renders when a WebXR immersive session is
 * active (xrImmersiveActive). It replaces the Plotly/Html chart with real
 * Three.js geometry so the data is visible inside a headset.
 *
 * Layout: a normalised data cube positioned 3 m in front of the user at eye
 * height (VR_CENTER), bounded by a wireframe box, labelled with drei <Text>.
 * SCOUT anomaly / correlation pins appear as glowing spheres with floating
 * headline labels.
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { Text } from '@react-three/drei'
import { useSceneStore } from '../../store/useSceneStore.js'
import {
  computeSampleSeed,
  sampleRowsForChart,
} from '../../utils/chartUtils.js'

/** World-space centre of the VR data cube (x, y, z in metres) */
const VR_CENTER = /** @type {[number, number, number]} */ ([0, 1.45, -3.2])
/** Half-edge of the data cube in metres */
const VR_HALF = 1.0
/** Max points rendered in VR — keeps frame-rate above 72 Hz on Quest 2 */
const MAX_VR_PTS = 2500

/** @param {unknown} v */
function toNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

/**
 * @param {number[]} vals
 * @returns {{ lo: number; hi: number; span: number }}
 */
function valRange(vals) {
  let lo = Infinity
  let hi = -Infinity
  for (const v of vals) {
    if (Number.isFinite(v)) {
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
  }
  const span = hi - lo || 1
  return { lo, hi, span }
}

/**
 * Simplified viridis colour map — matches the desktop Plotly Viridis scale.
 * @param {number} t  value in [0, 1]
 * @returns {[number, number, number]}  [r, g, b] ∈ [0, 1]
 */
function viridis(t) {
  const x = Math.max(0, Math.min(1, t))
  /* purple → teal → green → yellow */
  const r = Math.min(1, Math.max(0, x < 0.5 ? x * 0.6 : (x - 0.5) * 2.4 + 0.3))
  const g = Math.min(1, Math.max(0, Math.sin(x * Math.PI * 0.85) * 0.85 + x * 0.15))
  const b = Math.min(1, Math.max(0, (1 - x) * 0.72 + 0.06))
  return [r, g, b]
}

/**
 * Build a BufferGeometry points cloud from the sampled dataset rows.
 * Returns null when data is unavailable.
 */
function buildPointCloud(uploadedData, axisMapping, uploadSessionId) {
  if (!uploadedData?.rows?.length || !axisMapping) return null

  const seed = computeSampleSeed(
    uploadSessionId,
    uploadedData.rows.length,
    axisMapping,
  )
  const { rows } = sampleRowsForChart(uploadedData.rows, seed)

  const xs = rows.map((r) => toNum(r[axisMapping.x]))
  const ys = rows.map((r) => toNum(r[axisMapping.y]))
  const zs = rows.map((r) => toNum(r[axisMapping.z]))

  const xR = valRange(xs)
  const yR = valRange(ys)
  const zR = valRange(zs)

  const step = Math.max(1, Math.ceil(rows.length / MAX_VR_PTS))
  const indices = []
  for (let i = 0; i < rows.length; i += step) indices.push(i)

  const positions = new Float32Array(indices.length * 3)
  const colors = new Float32Array(indices.length * 3)
  const [cx, cy, cz] = VR_CENTER

  for (let li = 0; li < indices.length; li++) {
    const i = indices[li]
    const nx = Number.isFinite(xs[i]) ? (xs[i] - xR.lo) / xR.span - 0.5 : 0
    const ny = Number.isFinite(ys[i]) ? (ys[i] - yR.lo) / yR.span - 0.5 : 0
    const nz = Number.isFinite(zs[i]) ? (zs[i] - zR.lo) / zR.span - 0.5 : 0

    positions[li * 3] = cx + nx * VR_HALF * 2
    positions[li * 3 + 1] = cy + ny * VR_HALF * 2
    positions[li * 3 + 2] = cz + nz * VR_HALF * 2

    const t = Number.isFinite(zs[i]) ? (zs[i] - zR.lo) / zR.span : 0.5
    const [r, g, b] = viridis(t)
    colors[li * 3] = r
    colors[li * 3 + 1] = g
    colors[li * 3 + 2] = b
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  return { geo, xR, yR, zR }
}

/**
 * Convert a data-space [x,y,z] pin position to VR world position using the
 * same normalisation applied to the point cloud.
 */
function dataPosToVr(pos, xR, yR, zR) {
  const [px, py, pz] = pos
  const [cx, cy, cz] = VR_CENTER
  return /** @type {[number, number, number]} */ ([
    cx +
      (Number.isFinite(px) ? (px - xR.lo) / xR.span - 0.5 : 0) * VR_HALF * 2,
    cy +
      (Number.isFinite(py) ? (py - yR.lo) / yR.span - 0.5 : 0) * VR_HALF * 2,
    cz +
      (Number.isFinite(pz) ? (pz - zR.lo) / zR.span - 0.5 : 0) * VR_HALF * 2,
  ])
}

export function VrSceneLayer() {
  const xrActive = useSceneStore((s) => s.xrImmersiveActive)
  const uploadedData = useSceneStore((s) => s.uploadedData)
  const axisMapping = useSceneStore((s) => s.axisMapping)
  const uploadSessionId = useSceneStore((s) => s.uploadSessionId)
  const datasetMeta = useSceneStore((s) => s.datasetMeta)
  const scoutPins = useSceneStore((s) => s.scoutPins)

  const cloud = useMemo(
    () => buildPointCloud(uploadedData, axisMapping, uploadSessionId),
    [uploadedData, axisMapping, uploadSessionId],
  )

  if (!xrActive || !cloud || !axisMapping) return null

  const { geo, xR, yR, zR } = cloud
  const [cx, cy, cz] = VR_CENTER
  const hs = VR_HALF
  const labelOpts = { outlineWidth: 0.005, outlineColor: '#000000' }

  return (
    <group>
      {/* ── Point cloud ─────────────────────────────────────────── */}
      <points geometry={geo}>
        <pointsMaterial
          vertexColors
          size={0.03}
          sizeAttenuation
          transparent
          opacity={0.92}
        />
      </points>

      {/* ── Bounding wireframe ──────────────────────────────────── */}
      <mesh position={VR_CENTER}>
        <boxGeometry args={[hs * 2, hs * 2, hs * 2]} />
        <meshBasicMaterial
          color="#5EEAD4"
          wireframe
          transparent
          opacity={0.1}
        />
      </mesh>

      {/* ── Dataset name ────────────────────────────────────────── */}
      <Text
        position={[cx, cy + hs + 0.22, cz]}
        fontSize={0.115}
        color="#ffffff"
        anchorX="center"
        anchorY="bottom"
        {...labelOpts}
      >
        {datasetMeta?.name ?? 'Dataset'}
      </Text>

      {/* ── Axis labels ─────────────────────────────────────────── */}
      <Text
        position={[cx, cy - hs - 0.15, cz]}
        fontSize={0.07}
        color="#5EEAD4"
        anchorX="center"
        anchorY="top"
        {...labelOpts}
      >
        {`X  ${axisMapping.x}`}
      </Text>
      <Text
        position={[cx - hs - 0.15, cy, cz]}
        fontSize={0.07}
        color="#5EEAD4"
        anchorX="right"
        anchorY="middle"
        {...labelOpts}
      >
        {`Y  ${axisMapping.y}`}
      </Text>
      <Text
        position={[cx, cy, cz + hs + 0.15]}
        fontSize={0.07}
        color="#A81C1C"
        anchorX="center"
        anchorY="middle"
        {...labelOpts}
      >
        {`Z  ${axisMapping.z}`}
      </Text>

      {/* ── Point count hint ────────────────────────────────────── */}
      <Text
        position={[cx, cy - hs - 0.29, cz]}
        fontSize={0.054}
        color="#555568"
        anchorX="center"
        anchorY="top"
        {...labelOpts}
      >
        {`${uploadedData?.rowCount ?? 0} rows · VR view`}
      </Text>

      {/* ── SCOUT anomaly / correlation pins ─────────────────────── */}
      {scoutPins.map((pin) => {
        const vrPos = dataPosToVr(pin.position, xR, yR, zR)
        const accent = pin.kind === 'correlation' ? '#A81C1C' : '#FF6B35'
        return (
          <group key={pin.id} position={vrPos}>
            {/* Glowing sphere */}
            <mesh>
              <sphereGeometry args={[0.048, 10, 10]} />
              <meshBasicMaterial color={accent} />
            </mesh>
            {/* Stem */}
            <mesh position={[0, 0.07, 0]}>
              <cylinderGeometry args={[0.004, 0.004, 0.1, 6]} />
              <meshBasicMaterial color={accent} transparent opacity={0.6} />
            </mesh>
            {/* Headline label */}
            <Text
              position={[0, 0.16, 0]}
              fontSize={0.058}
              color={accent}
              anchorX="center"
              anchorY="bottom"
              maxWidth={0.7}
              outlineWidth={0.005}
              outlineColor="#000000"
            >
              {pin.headline}
            </Text>
          </group>
        )
      })}
    </group>
  )
}
