import { useEffect } from 'react'
import { useSceneStore } from '../../store/useSceneStore.js'

const PRESETS = /** @type {const} */ ([
  { id: 'bird', label: 'Bird', eye: [0, 24, 0], target: [0, 0, 0] },
  { id: 'iso', label: 'Iso', eye: [12, 12, 12], target: [0, 0, 0] },
  { id: 'front', label: 'Front', eye: [0, 0, 18], target: [0, 0, 0] },
  { id: 'side', label: 'Side', eye: [18, 0, 0], target: [0, 0, 0] },
  { id: 'top', label: 'Top', eye: [0, 18, 0.001], target: [0, 0, 0] },
])

function isTypingTarget(/** @type {EventTarget | null} */ target) {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return false
}

const hintLineStyle = {
  width: '100%',
  textAlign: 'center',
  fontFamily: "'DM Mono', ui-monospace, monospace",
  fontSize: 8,
  letterSpacing: '0.05em',
  color: 'var(--ui-text-faint)',
  marginBottom: 2,
  lineHeight: 1.4,
}

export function CameraPresets() {
  const setCameraPosition = useSceneStore((s) => s.setCameraPosition)
  const setOrbitTarget = useSceneStore((s) => s.setOrbitTarget)
  const setPlotlyViewPreset = useSceneStore((s) => s.setPlotlyViewPreset)

  useEffect(() => {
    const snap = () => useSceneStore.getState().snapToDefaultView()

    const onKeyDown = (/** @type {KeyboardEvent} */ e) => {
      if (isTypingTarget(e.target)) return

      if (e.key === 'Home') {
        e.preventDefault()
        snap()
        return
      }

      const cmdOrCtrl = e.metaKey || e.ctrlKey
      if (cmdOrCtrl && e.shiftKey && e.code === 'Digit0') {
        e.preventDefault()
        snap()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  /**
   * @param {[number, number, number]} eye
   * @param {[number, number, number]} target
   * @param {string} presetId — matches Plotly scene.camera in plotlyViewPresets.js
   */
  const apply = (eye, target, presetId) => {
    const controls = useSceneStore.getState()._orbitControls
    if (!controls) return
    controls.object.position.set(eye[0], eye[1], eye[2])
    controls.target.set(target[0], target[1], target[2])
    controls.update()
    setCameraPosition([eye[0], eye[1], eye[2]])
    setOrbitTarget([target[0], target[1], target[2]])
    setPlotlyViewPreset(presetId)
  }

  return (
    <div
      title="Sets both orbit and Plotly 3D camera. Shortcuts: Home, or ⌘/Ctrl + Shift + 0"
      style={{
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: 16,
        zIndex: 9,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        justifyContent: 'center',
        maxWidth: '92vw',
      }}
    >
      <div style={{ ...hintLineStyle, marginBottom: 6 }}>
        Camera preset · Home or ⌘/Ctrl + Shift + 0 to reset
      </div>
      {PRESETS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => apply([...p.eye], [...p.target], p.id)}
          style={{
            padding: '6px 10px',
            fontFamily: "'DM Mono', ui-monospace, monospace",
            fontSize: 9,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--ui-text-muted)',
            background: 'var(--ui-camera-btn-bg)',
            border: '1px solid var(--ui-camera-btn-border)',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
