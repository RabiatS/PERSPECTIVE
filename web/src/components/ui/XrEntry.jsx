import { useCallback, useEffect, useRef, useState } from 'react'
import { useSceneStore } from '../../store/useSceneStore.js'

/** Immersive WebXR via Three.js renderer; PRD A-Frame spatial UI is deferred in favor of R3F + Html overlays */
export function XrEntry() {
  const glFromStore = useSceneStore((s) => s._gl)
  const setXrImmersiveActive = useSceneStore((s) => s.setXrImmersiveActive)
  /** @type {React.MutableRefObject<import('three').WebGLRenderer | null>} */
  const glRef = useRef(/** @type {import('three').WebGLRenderer | null} */ (null))
  useEffect(() => {
    glRef.current = glFromStore
  }, [glFromStore])

  const [vr, setVr] = useState(false)
  const [ar, setAr] = useState(false)
  const [active, setActive] = useState(false)
  const [err, setErr] = useState(/** @type {string | null} */ (null))
  const sessionRef = useRef(/** @type {XRSession | null} */ (null))

  useEffect(() => {
    if (!navigator.xr) return
    void navigator.xr.isSessionSupported('immersive-vr').then(setVr)
    void navigator.xr.isSessionSupported('immersive-ar').then(setAr)
  }, [])

  const handleSessionEnd = useCallback(() => {
    sessionRef.current = null
    setActive(false)
    setXrImmersiveActive(false)
    const renderer = glRef.current
    if (renderer) {
      renderer.xr.enabled = false
    }
  }, [setXrImmersiveActive])

  const enter = useCallback(
    async (mode) => {
      const gl = glRef.current
      if (!gl) {
        setErr('Scene not ready — canvas not mounted')
        return
      }
      if (sessionRef.current) return
      setErr(null)
      try {
        gl.xr.enabled = true

        const isAr = mode === 'immersive-ar'

        /** @type {XRSessionInit} */
        const sessionInit = {
          requiredFeatures: ['local'],
          optionalFeatures: ['local-floor', 'bounded-floor'],
        }

        if (isAr) {
          sessionInit.optionalFeatures = [
            .../** @type {string[]} */ (sessionInit.optionalFeatures),
            'dom-overlay',
          ]
          sessionInit.domOverlay = { root: document.body }
        }

        const session = await navigator.xr.requestSession(mode, sessionInit)
        session.addEventListener('end', handleSessionEnd)
        sessionRef.current = session
        await gl.xr.setSession(session)
        setXrImmersiveActive(true)
        setActive(true)
      } catch (e) {
        const r = glRef.current
        if (r) r.xr.enabled = false
        setXrImmersiveActive(false)
        setErr(e instanceof Error ? e.message : String(e))
      }
    },
    [handleSessionEnd, setXrImmersiveActive],
  )

  const exitXr = useCallback(async () => {
    if (!sessionRef.current) return
    try {
      await sessionRef.current.end()
    } catch {
      handleSessionEnd()
    }
  }, [handleSessionEnd])

  // No XR support at all — show a grayed-out indicator so users know it exists
  if (!navigator.xr || (!vr && !ar)) {
    return (
      <div
        style={{
          position: 'absolute',
          right: 16,
          bottom: 100,
          zIndex: 14,
        }}
      >
        <button
          type="button"
          disabled
          title="WebXR not detected. Connect a VR/AR headset and use a supported browser (Chrome/Edge on Windows) to enable."
          style={{
            padding: '8px 12px',
            fontFamily: "'DM Mono', ui-monospace, monospace",
            fontSize: 10,
            color: 'var(--ui-text-faint)',
            background: 'transparent',
            border: '1px solid var(--ui-camera-btn-border)',
            borderRadius: 8,
            cursor: 'not-allowed',
            opacity: 0.5,
          }}
        >
          VR / AR
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'absolute',
        right: 16,
        bottom: 100,
        zIndex: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        alignItems: 'flex-end',
      }}
    >
      {active ? (
        <button
          type="button"
          onClick={exitXr}
          style={{
            padding: '8px 12px',
            fontFamily: "'DM Mono', ui-monospace, monospace",
            fontSize: 10,
            color: '#A81C1C',
            background: 'rgba(168, 28, 28, 0.1)',
            border: '1px solid rgba(168, 28, 28, 0.5)',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          Exit XR
        </button>
      ) : (
        <>
          {vr && (
            <button
              type="button"
              onClick={() => void enter('immersive-vr')}
              style={{
                padding: '8px 12px',
                fontFamily: "'DM Mono', ui-monospace, monospace",
                fontSize: 10,
                color: 'var(--ui-accent)',
                background: 'var(--ui-accent-dim)',
                border: '1px solid var(--ui-accent-border)',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              View in VR
            </button>
          )}
          {ar && (
            <button
              type="button"
              onClick={() => void enter('immersive-ar')}
              style={{
                padding: '8px 12px',
                fontFamily: "'DM Mono', ui-monospace, monospace",
                fontSize: 10,
                color: 'var(--ui-accent)',
                background: 'var(--ui-accent-dim)',
                border: '1px solid var(--ui-accent-border)',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              View in AR
            </button>
          )}
        </>
      )}
      {err && (
        <div style={{ fontSize: 10, color: '#FFB800', maxWidth: 220, lineHeight: 1.4 }}>
          {err}
        </div>
      )}
    </div>
  )
}
