import { useSceneStore } from '../../store/useSceneStore.js'

const row = { margin: 0, marginBottom: 6 }
const rowLast = { margin: 0 }

/** What you’re seeing + how to drive orbit vs the Plotly overlay */
export function SceneNavigateHint() {
  const activeChartType = useSceneStore((s) => s.activeChartType)
  const is2DMode = useSceneStore((s) => s.is2DMode)

  if (!activeChartType) return null

  if (is2DMode) {
    return (
      <div
    style={{
        position: 'absolute',
        left: 12,
        top: 12,
        zIndex: 8,
        maxWidth: 'min(360px, 44vw)',
          padding: '10px 12px',
          borderRadius: 8,
          fontFamily: "'DM Mono', ui-monospace, monospace",
          fontSize: 9,
          lineHeight: 1.45,
          letterSpacing: '0.03em',
          color: 'var(--chrome-muted-text)',
          background: 'var(--ui-panel-bg)',
          border: '1px solid var(--ui-panel-border)',
          pointerEvents: 'none',
        }}
      >
        <p style={row}>
          <strong style={{ color: 'var(--ui-text-body)' }}>2D mode</strong> — Drag to lasso-select ·
          Scroll to zoom · Right-drag to pan.
        </p>
        <p style={rowLast}>Click <em>↩ Back to 3D</em> in the toolbar to return.</p>
      </div>
    )
  }

  return (
    <div
      title="Navigation cheatsheet"
    style={{
      position: 'absolute',
      left: 12,
      top: 12,
      zIndex: 8,
      maxWidth: 'min(380px, 46vw)',
        padding: '10px 12px',
        borderRadius: 8,
        fontFamily: "'DM Mono', ui-monospace, monospace",
        fontSize: 9,
        lineHeight: 1.45,
        letterSpacing: '0.03em',
        color: 'var(--chrome-muted-text)',
        background: 'var(--ui-panel-bg)',
        border: '1px solid var(--ui-panel-border)',
        pointerEvents: 'none',
      }}
    >
      <p style={row}>
        <strong style={{ color: 'var(--ui-text-body)' }}>Orbit mode</strong> — Left-drag to rotate the
        3D view · Scroll to zoom · Right-drag to pan.
      </p>
      <p style={row}>
        <strong style={{ color: 'var(--ui-text-body)' }}>Select mode</strong> — Switch in the toolbar
        above, then drag to lasso-select data points.
      </p>
      <p style={row}>
        <strong style={{ color: 'var(--ui-text-body)' }}>Alt + drag</strong> — Orbit the Three.js scene
        layer (grid & gizmo) even in Select mode.
      </p>
      <p style={rowLast}>
        <strong style={{ color: 'var(--ui-text-body)' }}>Camera</strong> — Use Bird / Iso / Front / Side
        / Top at the bottom to snap angles.
      </p>
    </div>
  )
}
