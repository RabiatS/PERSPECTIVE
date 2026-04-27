import { useCallback, useEffect, useState } from 'react'
import { useSceneStore } from '../../store/useSceneStore.js'
import { decodeSceneState, encodeSceneState } from '../../utils/sceneStateCodec.js'

export function ShareableUrlBanner() {
  const activeChartType = useSceneStore((s) => s.activeChartType)
  const axisMapping = useSceneStore((s) => s.axisMapping)
  const cameraPosition = useSceneStore((s) => s.cameraPosition)
  const is2DMode = useSceneStore((s) => s.is2DMode)
  const datasetMeta = useSceneStore((s) => s.datasetMeta)
  const applyChartRender = useSceneStore((s) => s.applyChartRender)
  const setIs2DMode = useSceneStore((s) => s.setIs2DMode)
  const [note, setNote] = useState(/** @type {string | null} */ (null))

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const raw = params.get('scene')
    if (!raw) return
    const decoded = decodeSceneState(raw)
    if (!decoded || typeof decoded !== 'object') {
      queueMicrotask(() => setNote('Invalid scene link'))
      return
    }
    const ct = decoded.chart
    const ax = decoded.axes
    const cam = decoded.camera
    const d2 = decoded.is2D
    if (
      typeof ct === 'string' &&
      ax &&
      typeof ax === 'object' &&
      ax.x &&
      ax.y
    ) {
      applyChartRender(/** @type {never} */ (ct), {
        x: String(ax.x),
        y: String(ax.y),
        z: String(ax.z ?? ax.y),
      })
    }
    if (Array.isArray(cam) && cam.length === 3) {
      const controls = useSceneStore.getState()._orbitControls
      if (controls) {
        controls.object.position.set(cam[0], cam[1], cam[2])
        controls.update()
        useSceneStore.getState().setCameraPosition([cam[0], cam[1], cam[2]])
      }
    }
    if (typeof d2 === 'boolean') setIs2DMode(d2)
    queueMicrotask(() =>
      setNote('Restored view from URL (dataset not loaded).'),
    )
  }, [applyChartRender, setIs2DMode])

  const copyLink = useCallback(() => {
    if (!activeChartType || !axisMapping) {
      setNote('Render a chart first')
      return
    }
    const payload = {
      chart: activeChartType,
      axes: axisMapping,
      camera: cameraPosition,
      is2D: is2DMode,
      dataset: datasetMeta?.name ?? '',
    }
    const enc = encodeSceneState(payload)
    const url = new URL(window.location.href)
    url.searchParams.set('scene', enc)
    void navigator.clipboard.writeText(url.toString())
    setNote('Link copied. Large URLs may hit browser limits.')
  }, [activeChartType, axisMapping, cameraPosition, is2DMode, datasetMeta])

  if (!activeChartType) return null

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 8,
        maxWidth: 280,
      }}
    >
      <button
        type="button"
        onClick={copyLink}
        style={{
          padding: '8px 12px',
          fontFamily: "'DM Mono', ui-monospace, monospace",
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#5EEAD4',
          background: 'rgba(94, 234, 212, 0.08)',
          border: '1px solid rgba(94, 234, 212, 0.45)',
          borderRadius: 8,
          cursor: 'pointer',
        }}
      >
        Copy shareable URL
      </button>
      {note && (
        <div
          style={{
            fontSize: 10,
            color: '#8A8A9A',
            lineHeight: 1.4,
            textAlign: 'right',
          }}
        >
          {note}
        </div>
      )}
    </div>
  )
}
