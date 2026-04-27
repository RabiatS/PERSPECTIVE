import { useSceneStore } from '../../store/useSceneStore.js'

const railStyle = {
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 0,
  padding: '6px 12px 8px',
  background: 'var(--chrome-bar-bg)',
  borderBottom: '1px solid var(--chrome-bar-border)',
  zIndex: 17,
  minHeight: 36,
  boxSizing: 'border-box',
}

/**
 * Compact stepper: Dataset → LENS → 3D scene. Orients new users; mirrors landing “how it works”.
 */
export function WorkflowRail() {
  const uploadedData = useSceneStore((s) => s.uploadedData)
  const lensStatus = useSceneStore((s) => s.lensStatus)
  const lensOutput = useSceneStore((s) => s.lensOutput)
  const lensError = useSceneStore((s) => s.lensError)
  const activeChartType = useSceneStore((s) => s.activeChartType)

  if (!uploadedData) return null

  const lensDone =
    lensStatus === 'ready' ||
    (lensStatus === 'error' && lensError != null)
  const lensBusy =
    lensStatus === 'loading' ||
    (lensStatus === 'idle' && lensOutput == null && lensError == null)
  const sceneDone = Boolean(activeChartType)

  /** @type {{ label: string; done: boolean; busy: boolean }[]} */
  const steps = [
    { label: '1 · Dataset', done: true, busy: false },
    {
      label: '2 · LENS',
      done: lensDone,
      busy: lensBusy && !lensDone,
    },
    {
      label: '3 · 3D scene',
      done: sceneDone,
      busy: lensDone && !sceneDone,
    },
  ]

  return (
    <div style={railStyle} role="navigation" aria-label="Workspace workflow">
      {steps.map((s, i) => {
        const isLast = i === steps.length - 1
        const color = s.done
          ? 'var(--chrome-action-text)'
          : s.busy
            ? 'var(--chrome-tab-text-active)'
            : 'var(--chrome-muted-text)'
        const weight = s.busy ? 600 : 500
        return (
          <div
            key={s.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 0,
              fontFamily: "'DM Mono', ui-monospace, monospace",
              fontSize: 10,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            <span
              style={{
                color,
                fontWeight: weight,
                animation: s.busy ? 'workflow-pulse 1.2s ease-in-out infinite' : undefined,
              }}
            >
              {s.label}
            </span>
            {!isLast ? (
              <span
                aria-hidden
                style={{
                  margin: '0 10px',
                  color: 'var(--chrome-bar-border)',
                  fontWeight: 300,
                  letterSpacing: 0,
                }}
              >
                →
              </span>
            ) : null}
          </div>
        )
      })}
      <span
        style={{
          marginLeft: 'auto',
          paddingLeft: 12,
          fontFamily: "'DM Mono', ui-monospace, monospace",
          fontSize: 9,
          letterSpacing: '0.04em',
          color: 'var(--chrome-muted-text)',
          maxWidth: 'min(280px, 38vw)',
          lineHeight: 1.35,
          textTransform: 'none',
        }}
      >
        {lensBusy
          ? 'Classifying columns and chart…'
          : lensStatus === 'error' && !lensOutput
            ? 'LENS failed — fix API keys or try again from the panel'
            : !sceneDone
              ? 'LENS applies a first pass to the scene; adjust the panel and click Update scene to refresh'
              : 'Orbit scene · SCOUT pins · CURATOR selection'}
      </span>
    </div>
  )
}
