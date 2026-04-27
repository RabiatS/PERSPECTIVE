import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useThemeStore } from '../../store/useThemeStore.js'
import { R } from '../../theme/rabiat.js'

const COLOR_TEAL = R.teal
const COLOR_MINT = R.calmTeal
const COLOR_BLOOD = R.bloodline

/** Deterministic 0..1 value for stable geometry (no Math.random during render). */
function detRand(i, salt) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

/** ECEF-style placement with Y up (three.js convention). */
function latLngToVec3(lat, lng, radius) {
  const phi = ((90 - lat) * Math.PI) / 180
  const theta = ((lng + 180) * Math.PI) / 180
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  )
}

function arcSegments(a, b, steps, bulge) {
  const A = a.clone().normalize()
  const B = b.clone().normalize()
  const out = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const m = new THREE.Vector3().lerpVectors(A, B, t).normalize()
    const lift = 1 + bulge * Math.sin(Math.PI * t)
    out.push(m.multiplyScalar(lift))
  }
  return out
}

const HUB_LAT_LNG = [
  [40.7128, -74.006],
  [51.5074, -0.1278],
  [35.6762, 139.6503],
  [-23.5505, -46.6333],
  [1.3521, 103.8198],
  [25.2048, 55.2708],
  [-33.8688, 151.2093],
  [19.076, 72.8777],
  [34.0522, -118.2437],
  [48.8566, 2.3522],
  [37.5665, 126.978],
  [55.7558, 37.6173],
  [-1.2921, 36.8219],
  [64.1466, -21.9426],
  [31.2304, 121.4737],
]

const ARC_PAIRS = [
  [0, 1],
  [1, 2],
  [2, 4],
  [4, 5],
  [5, 7],
  [0, 8],
  [8, 13],
  [1, 9],
  [9, 11],
  [2, 14],
  [14, 4],
  [3, 8],
  [6, 4],
  [12, 2],
  [13, 1],
  [7, 5],
  [10, 14],
  [0, 12],
  [11, 7],
]

function NightEarth({ isLight }) {
  return (
    <mesh>
      <sphereGeometry args={[1, 72, 72]} />
      <meshStandardMaterial
        color={isLight ? '#b8cce8' : '#050810'}
        emissive={isLight ? '#d0e4fc' : '#071426'}
        emissiveIntensity={isLight ? 0.22 : 0.45}
        metalness={isLight ? 0.08 : 0.12}
        roughness={isLight ? 0.88 : 0.94}
      />
    </mesh>
  )
}

function Atmosphere({ isLight }) {
  return (
    <mesh scale={1.07}>
      <sphereGeometry args={[1, 48, 48]} />
      <meshBasicMaterial
        color={COLOR_TEAL}
        transparent
        opacity={isLight ? 0.07 : 0.045}
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  )
}

function DataArcs({ hubs }) {
  const geom = useMemo(() => {
    const positions = []
    ARC_PAIRS.forEach(([i, j], idx) => {
      const p0 = hubs[i]
      const p1 = hubs[j]
      if (!p0 || !p1) return
      const bulge = 0.12 + (idx % 6) * 0.017
      const seg = arcSegments(p0, p1, 28, bulge)
      for (let k = 0; k < seg.length - 1; k++) {
        const a = seg[k]
        const b = seg[k + 1]
        positions.push(a.x, a.y, a.z, b.x, b.y, b.z)
      }
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return g
  }, [hubs])

  return (
    <lineSegments geometry={geom}>
      <lineBasicMaterial
        color={COLOR_TEAL}
        transparent
        opacity={0.22}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </lineSegments>
  )
}

function CityHubs({ hubs }) {
  const geom = useMemo(() => {
    const positions = new Float32Array(hubs.length * 3)
    hubs.forEach((v, i) => {
      const p = v.clone().normalize().multiplyScalar(1.018)
      positions[i * 3] = p.x
      positions[i * 3 + 1] = p.y
      positions[i * 3 + 2] = p.z
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return g
  }, [hubs])

  return (
    <points geometry={geom}>
      <pointsMaterial
        size={0.045}
        color={COLOR_MINT}
        transparent
        opacity={0.95}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  )
}

function ScatterLights({ hubs }) {
  const geom = useMemo(() => {
    const n = 520
    const positions = new Float32Array(n * 3)
    const colors = new Float32Array(n * 3)
    const cTeal = new THREE.Color(COLOR_TEAL)
    const cMint = new THREE.Color(COLOR_MINT)
    const cRed = new THREE.Color(COLOR_BLOOD)

    for (let i = 0; i < n; i++) {
      let v
      if (detRand(i, 0) < 0.5) {
        const h = hubs[Math.floor(detRand(i, 1) * hubs.length) % hubs.length]
        v = h
          .clone()
          .add(
            new THREE.Vector3(
              (detRand(i, 2) - 0.5) * 0.22,
              (detRand(i, 3) - 0.5) * 0.22,
              (detRand(i, 4) - 0.5) * 0.22,
            ),
          )
          .normalize()
          .multiplyScalar(1.006)
      } else {
        v = new THREE.Vector3(
          detRand(i, 5) * 2 - 1,
          detRand(i, 6) * 2 - 1,
          detRand(i, 7) * 2 - 1,
        )
          .normalize()
          .multiplyScalar(1.006)
      }
      positions[i * 3] = v.x
      positions[i * 3 + 1] = v.y
      positions[i * 3 + 2] = v.z

      const roll = detRand(i, 8)
      const col = roll < 0.5 ? cMint : roll < 0.82 ? cTeal : cRed
      colors[i * 3] = col.r
      colors[i * 3 + 1] = col.g
      colors[i * 3 + 2] = col.b
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return g
  }, [hubs])

  return (
    <points geometry={geom}>
      <pointsMaterial
        size={0.018}
        vertexColors
        transparent
        opacity={0.75}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  )
}

function GlobeScene({ isLight }) {
  const hubs = useMemo(
    () => HUB_LAT_LNG.map(([lat, lng]) => latLngToVec3(lat, lng, 1)),
    [],
  )

  return (
    <group>
      <ambientLight intensity={isLight ? 0.42 : 0.18} />
      <pointLight position={[6, 4, 8]} intensity={isLight ? 0.35 : 0.55} color={COLOR_TEAL} />
      <pointLight position={[-8, -2, -4]} intensity={isLight ? 0.15 : 0.25} color={COLOR_BLOOD} />
      <hemisphereLight
        color={COLOR_TEAL}
        groundColor={isLight ? '#dde8f8' : '#000000'}
        intensity={isLight ? 0.2 : 0.12}
      />
      <NightEarth isLight={isLight} />
      <Atmosphere isLight={isLight} />
      <DataArcs hubs={hubs} />
      <ScatterLights hubs={hubs} />
      <CityHubs hubs={hubs} />
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={2.6}
        minPolarAngle={Math.PI * 0.35}
        maxPolarAngle={Math.PI * 0.62}
      />
    </group>
  )
}

export function LandingGlobe() {
  const theme = useThemeStore((s) => s.theme)
  const isLight = theme === 'light'
  const canvasBg = isLight ? '#dce8f4' : '#050508'
  return (
    <div className="landing-globe-wrap" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0.08, 2.45], fov: 42 }}
        dpr={[1, 2]}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          alpha: false,
        }}
      >
        <color attach="background" args={[canvasBg]} />
        <GlobeScene isLight={isLight} />
      </Canvas>
      <div className="landing-globe-vignette" />
    </div>
  )
}
