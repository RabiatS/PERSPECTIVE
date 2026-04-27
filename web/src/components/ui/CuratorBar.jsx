import { useState } from 'react'
import { useSceneStore } from '../../store/useSceneStore.js'
import { runCuratorSubScene } from '../../ai/agents/curator.js'

export function CuratorBar() {
  const selectedRowIndices = useSceneStore((s) => s.selectedRowIndices)
  const uploadedData = useSceneStore((s) => s.uploadedData)
  const axisMapping = useSceneStore((s) => s.axisMapping)
  const activeChartType = useSceneStore((s) => s.activeChartType)
  const is2DMode = useSceneStore((s) => s.is2DMode)
  const addSubScene = useSceneStore((s) => s.addSubScene)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(/** @type {string | null} */ (null))

  if (!uploadedData || !axisMapping || !activeChartType) return null

  const n = selectedRowIndices.length
  const canSpawn = n >= 3 && activeChartType !== 'globe'

  const onSpawn = async () => {
    if (!canSpawn || !uploadedData) return
    setBusy(true)
    setErr(null)
    try {
      const out = await runCuratorSubScene({
        rows: uploadedData.rows,
        selectedIndices: selectedRowIndices,
        columns: uploadedData.columns,
        detectedTypes: uploadedData.detectedTypes,
        axisMapping,
        chartType: activeChartType,
      })
      const id = `sub-${Date.now()}`
      const idx = useSceneStore.getState().subScenes.length
      addSubScene({
        id,
        label: `Cluster ${idx + 1}`,
        offset: [4 + idx * 0.3, 2, 4 + idx * 0.3],
        rows: out.filteredRows,
        columns: uploadedData.columns,
        detectedTypes: uploadedData.detectedTypes,
        axisMapping: out.axisMapping,
        chartType:
          /** @type {'scatter3d' | 'surface' | 'mesh3d' | 'bar3d' | 'globe' | 'graph3d'} */ (
            activeChartType
          ),
        collapsed: false,
      })
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: 16,
        bottom: 56,
        zIndex: 12,
        maxWidth: 320,
        padding: '12px 14px',
        background: 'var(--ui-panel-bg)',
        border: '1px solid rgba(168, 28, 28, 0.35)',
        borderRadius: 10,
        fontFamily: "'DM Mono', ui-monospace, monospace",
        fontSize: 11,
        color: 'var(--ui-text-muted)',
      }}
    >
      <div style={{ color: '#A81C1C', marginBottom: 8, fontSize: 10, letterSpacing: '0.1em' }}>
        CURATOR · {n} selected
      </div>
      {is2DMode && (
        <div
          style={{ marginBottom: 8, fontSize: 9, color: 'var(--ui-text-subtle)', lineHeight: 1.35 }}
        >
          Select points in the{' '}
          <strong style={{ color: 'var(--ui-text-muted)' }}>2D chart panel</strong> (right or
          below). Graphs: only node markers count toward selection.
        </div>
      )}
      <button
        type="button"
        disabled={!canSpawn || busy}
        onClick={() => void onSpawn()}
        style={{
          padding: '8px 12px',
          background: canSpawn ? 'rgba(168, 28, 28, 0.15)' : 'var(--ui-curator-disabled)',
          border: '1px solid rgba(168, 28, 28, 0.5)',
          color: '#A81C1C',
          borderRadius: 8,
          cursor: canSpawn ? 'pointer' : 'not-allowed',
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {busy ? 'Working…' : 'Spawn sub-scene'}
      </button>
      {!canSpawn && n > 0 && (
        <div style={{ marginTop: 8, fontSize: 10, color: '#6a6a78' }}>
          Need at least 3 points — lasso or box on the chart; hold Shift to add
          to the selection.
        </div>
      )}
      {err && (
        <div style={{ marginTop: 8, color: '#FFB800', fontSize: 10 }}>{err}</div>
      )}
    </div>
  )
}
