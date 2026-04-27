import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useEffect, useRef } from 'react'
import { MOUSE } from 'three'
import { useSceneStore } from '../../store/useSceneStore.js'
import { useThemeStore } from '../../store/useThemeStore.js'
import { GridFloor } from './GridFloor.jsx'
import { AxisGizmo } from './AxisGizmo.jsx'
import { ChartRenderer } from '../charts/ChartRenderer.jsx'
import { PinsLayer } from './PinsLayer.jsx'
import { SubScenesLayer } from './SubScenesLayer.jsx'
import { VrSceneLayer } from './VrSceneLayer.jsx'

function SceneContent() {
  const theme = useThemeStore((s) => s.theme)
  const isLight = theme === 'light'
  const fogColor = isLight ? '#cfd6e4' : '#0A0A0A'
  const controlsRef = useRef(null)
  const { camera, gl } = useThree()
  const xrImmersiveActive = useSceneStore((s) => s.xrImmersiveActive)
  const setOrbitControls = useSceneStore((s) => s.setOrbitControls)
  const setCameraPosition = useSceneStore((s) => s.setCameraPosition)
  const setOrbitTarget = useSceneStore((s) => s.setOrbitTarget)
  const setGl = useSceneStore((s) => s.setGl)

  useEffect(() => {
    setGl(gl)
    return () => setGl(null)
  }, [gl, setGl])

  useEffect(() => {
    let alive = true
    const register = () => {
      if (!alive) return
      const oc = controlsRef.current
      if (oc) {
        setOrbitControls(oc)
        const p = camera.position
        const t = oc.target
        setCameraPosition([p.x, p.y, p.z])
        setOrbitTarget([t.x, t.y, t.z])
      } else {
        requestAnimationFrame(register)
      }
    }
    register()
    return () => {
      alive = false
      setOrbitControls(null)
    }
  }, [camera, setCameraPosition, setOrbitTarget, setOrbitControls])

  return (
    <>
      <ambientLight intensity={isLight ? 0.52 : 0.3} />
      <pointLight position={[10, 10, 10]} intensity={isLight ? 0.45 : 0.8} color="#5EEAD4" />
      <hemisphereLight
        skyColor="#5EEAD4"
        groundColor={isLight ? '#e8ecf4' : '#000000'}
        intensity={isLight ? 0.18 : 0.08}
      />
      <fog attach="fog" args={[fogColor, 30, 80]} />
      <GridFloor />
      <AxisGizmo />
      <ChartRenderer />
      <PinsLayer />
      <SubScenesLayer />
      <VrSceneLayer />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enabled={!xrImmersiveActive}
        enableDamping
        dampingFactor={0.05}
        minDistance={1}
        maxDistance={100}
        mouseButtons={{
          LEFT: MOUSE.ROTATE,
          MIDDLE: MOUSE.DOLLY,
          RIGHT: MOUSE.PAN,
        }}
        onChange={() => {
          const p = camera.position
          const t = controlsRef.current?.target
          setCameraPosition([p.x, p.y, p.z])
          if (t) setOrbitTarget([t.x, t.y, t.z])
        }}
      />
    </>
  )
}

export function SceneCanvas() {
  const theme = useThemeStore((s) => s.theme)
  const bg = theme === 'light' ? '#d4dae8' : '#0A0A0A'
  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        margin: 0,
        padding: 0,
        background: 'var(--scene-canvas-bg)',
        overflow: 'hidden',
      }}
    >
      <Canvas
        camera={{ position: [8, 6, 8], fov: 60, near: 0.1, far: 500 }}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          margin: 0,
          padding: 0,
        }}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={[bg]} />
        <SceneContent />
      </Canvas>
    </div>
  )
}
