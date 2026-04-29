import Plot from 'react-plotly.js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSceneStore } from '../../store/useSceneStore.js'
import {
  buildGraphEdgeTrace2d,
  buildGraphEdgeTrace3d,
  buildLayout,
  buildLayout2D,
  buildScoutPinTrace2d,
  buildScoutPinTrace3d,
  buildTrace,
  buildTrace2D,
  computeSampleSeed,
  rowsToXYZArrays,
  sampleRowsForChart,
  subtractDataSpaceOrigin,
} from '../../utils/chartUtils.js'
import { mergePlotlySceneCamera } from '../../utils/plotlyViewPresets.js'
import { plotlySelectionToGlobalRowIndices } from '../../utils/plotlySelection.js'
import { useAltOrbitPassthrough } from '../../hooks/useAltOrbitPassthrough.js'
import { useThemeStore } from '../../store/useThemeStore.js'
import { GlobeHtmlChart } from './GlobeHtmlChart.jsx'

// ─── Toolbar button style ────────────────────────────────────────────────────

/** @param {boolean} active */
function toolbarBtnStyle(active) {
  return {
    fontFamily: "'DM Mono', ui-monospace, monospace",
    fontSize: 9,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    padding: '5px 10px',
    background: active ? 'var(--ui-accent-dim)' : 'transparent',
    border: active
      ? '1px solid var(--ui-accent-border)'
      : '1px solid var(--ui-camera-btn-border)',
    color: active ? 'var(--ui-accent)' : 'var(--ui-text-subtle)',
    boxShadow: active
      ? '0 0 0 1px rgba(94, 234, 212, 0.08), 0 0 12px rgba(94, 234, 212, 0.15)'
      : 'none',
    cursor: 'pointer',
    borderRadius: 4,
    transition:
      'background 0.15s ease, color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
  }
}

function useShiftKeyHeld() {
  const shiftHeldRef = useRef(false)
  useEffect(() => {
    const down = (e) => {
      if (e.key === 'Shift') shiftHeldRef.current = true
    }
    const up = (e) => {
      if (e.key === 'Shift') shiftHeldRef.current = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])
  return shiftHeldRef
}

/**
 * @param {Record<string, unknown>[]} rows
 * @param {{ x: string; y: string; z: string }} axisMapping
 */
function rowsToGlobePoints(rows, axisMapping) {
  return rows
    .map((row) => {
      const lng = Number(row[axisMapping.x])
      const lat = Number(row[axisMapping.y])
      const z = Number(row[axisMapping.z])
      return {
        lat,
        lng,
        size: 0.25 + Math.min(0.75, (Number.isFinite(z) ? Math.abs(z) : 0) / 50),
        color: '#5EEAD4',
      }
    })
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
}

/**
 * Shared trace/layout builder — works both inside and outside R3F.
 * @param {{ width: number; height: number } | undefined} _viewportSize
 * @param {'dark' | 'light'} colorTheme
 */
function useChartTraces(_viewportSize, colorTheme) {
  const uploadedData = useSceneStore((s) => s.uploadedData)
  const uploadSessionId = useSceneStore((s) => s.uploadSessionId)
  const lensOutput = useSceneStore((s) => s.lensOutput)
  const activeChartType = useSceneStore((s) => s.activeChartType)
  const axisMapping = useSceneStore((s) => s.axisMapping)
  const chartSpaceOrigin = useSceneStore((s) => s.chartSpaceOrigin)
  const plotlyViewPresetId = useSceneStore((s) => s.plotlyViewPresetId)
  const scoutPins = useSceneStore((s) => s.scoutPins)
  const scoutVisible = useSceneStore((s) => s.scoutVisible)

  return useMemo(() => {
    if (
      !uploadedData?.rows?.length ||
      !lensOutput ||
      !activeChartType ||
      !axisMapping
    ) {
      return {
        traces3d: /** @type {Record<string, unknown>[]} */ ([]),
        layout3d: null,
        traces2d: /** @type {Record<string, unknown>[]} */ ([]),
        layout2d: null,
        rowIndices: /** @type {number[]} */ ([]),
        globePoints: /** @type {{ lat: number; lng: number; size?: number; color?: string }[]} */ ([]),
        mainTraceIndex3d: 0,
        mainTraceIndex2d: 0,
      }
    }
    const sampleSeed = computeSampleSeed(
      uploadSessionId,
      uploadedData.rows.length,
      axisMapping,
    )
    const { rows, rowIndices } = sampleRowsForChart(
      uploadedData.rows,
      sampleSeed,
      { chartType: activeChartType },
    )
    const raw = rowsToXYZArrays(rows, axisMapping, uploadedData.detectedTypes)
    const globePoints =
      activeChartType === 'globe' ? rowsToGlobePoints(rows, axisMapping) : []

    const origin =
      activeChartType === 'globe' ? [0, 0, 0] : chartSpaceOrigin
    const { x, y, z } =
      activeChartType === 'globe'
        ? raw
        : subtractDataSpaceOrigin(raw.x, raw.y, raw.z, origin)

    const graphLinks = uploadedData.graphLinks
    const visiblePins = scoutVisible ? scoutPins : []

    const traces3d = []
    if (activeChartType === 'graph3d' && graphLinks?.length) {
      const edge = buildGraphEdgeTrace3d(x, y, z, rowIndices, graphLinks)
      if (edge) traces3d.push(edge)
    }
    traces3d.push(buildTrace(activeChartType, { x, y, z }))
    const mainTraceIndex3d = traces3d.length - 1
    if (activeChartType !== 'globe' && visiblePins.length > 0) {
      const pin3d = buildScoutPinTrace3d(visiblePins, colorTheme)
      if (pin3d) traces3d.push(pin3d)
    }

    const traces2d = []
    if (activeChartType === 'graph3d' && graphLinks?.length) {
      const edge2d = buildGraphEdgeTrace2d(x, y, rowIndices, graphLinks)
      if (edge2d) traces2d.push(edge2d)
    }
    traces2d.push(buildTrace2D(activeChartType, { x, y, z }))
    const mainTraceIndex2d = traces2d.length - 1
    if (activeChartType !== 'globe' && visiblePins.length > 0) {
      const pin2d = buildScoutPinTrace2d(visiblePins, colorTheme)
      if (pin2d) traces2d.push(pin2d)
    }

    const baseLayout = buildLayout(
      axisMapping,
      _viewportSize?.width > 0 ? _viewportSize : undefined,
      colorTheme,
    )
    const layout3d = mergePlotlySceneCamera(baseLayout, plotlyViewPresetId)

    const layout2d = buildLayout2D(axisMapping, colorTheme)

    return {
      traces3d,
      layout3d,
      traces2d,
      layout2d,
      rowIndices,
      globePoints,
      mainTraceIndex3d,
      mainTraceIndex2d,
    }
  }, [
    uploadedData,
    uploadSessionId,
    lensOutput,
    activeChartType,
    axisMapping,
    chartSpaceOrigin,
    _viewportSize,
    plotlyViewPresetId,
    colorTheme,
    scoutPins,
    scoutVisible,
  ])
}

/**
 * R3F stub — kept as a mount point in SceneCanvas so the Three.js scene
 * (grid, gizmo, pins) continues to render. Plotly lives in DOM overlays.
 */
export function ChartRenderer() {
  return null
}

// ─── 3D viewport toolbar (top of the viewport) ──────────────────────────────

/**
 * @param {{
 *   orbitMode: boolean;
 *   onOrbit: () => void;
 *   onSelect: () => void;
 *   onSwitch2D: () => void;
 *   scoutVisible: boolean;
 *   hasScout: boolean;
 *   onToggleScout: () => void;
 * }} props
 */
function ViewportToolbar({ orbitMode, onOrbit, onSelect, onSwitch2D, scoutVisible, hasScout, onToggleScout }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 10,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 5,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 6px',
        background: 'var(--ui-panel-bg)',
        border: '1px solid var(--ui-panel-border)',
        borderRadius: 8,
        pointerEvents: 'auto',
      }}
    >
      <button type="button" style={toolbarBtnStyle(orbitMode)} onClick={onOrbit}
        title="Drag to rotate the 3D view (turntable mode)">
        ↻ Orbit
      </button>
      <button type="button" style={toolbarBtnStyle(!orbitMode)} onClick={onSelect}
        title="Drag to lasso-select data points">
        ◻ Select
      </button>
      <div
        style={{
          width: 1,
          height: 16,
          background: 'var(--ui-panel-border)',
          margin: '0 4px',
        }}
      />
      <button
        type="button"
        style={{
          ...toolbarBtnStyle(false),
          color: 'var(--ui-text-muted)',
        }}
        onClick={onSwitch2D}
        title="Switch to 2D flat view"
      >
        2D
      </button>
      {hasScout && (
        <>
          <div
            style={{
              width: 1,
              height: 16,
              background: 'var(--ui-panel-border)',
              margin: '0 4px',
            }}
          />
          <button
            type="button"
            onClick={onToggleScout}
            title={scoutVisible ? 'Hide SCOUT anomaly markers' : 'Show SCOUT anomaly markers'}
            style={{
              fontFamily: "'DM Mono', ui-monospace, monospace",
              fontSize: 9,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '5px 10px',
              background: scoutVisible ? 'rgba(168, 28, 28, 0.12)' : 'transparent',
              border: scoutVisible
                ? '1px solid rgba(168, 28, 28, 0.5)'
                : '1px solid var(--ui-camera-btn-border)',
              color: scoutVisible ? '#A81C1C' : 'var(--ui-text-subtle)',
              boxShadow: scoutVisible
                ? '0 0 10px rgba(168, 28, 28, 0.18)'
                : 'none',
              cursor: 'pointer',
              borderRadius: 4,
              transition:
                'background 0.15s ease, color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
            }}
          >
            ◈ Scout
          </button>
        </>
      )}
    </div>
  )
}

// ─── Chart3DPanel — DOM overlay for the 3D Plotly scene ─────────────────────

/**
 * Absolutely-positioned DOM overlay covering the scene viewport.
 * Render this as a sibling to <SceneCanvas> inside a `position: relative` wrapper.
 * Hidden when in 2D mode or no data.
 */
export function Chart3DPanel() {
  const colorTheme = useThemeStore((s) => s.theme)
  const is2DMode = useSceneStore((s) => s.is2DMode)
  const setIs2DMode = useSceneStore((s) => s.setIs2DMode)
  const activeChartType = useSceneStore((s) => s.activeChartType)
  const setSelectedRowIndices = useSceneStore((s) => s.setSelectedRowIndices)
  const plotlyViewRevision = useSceneStore((s) => s.plotlyViewRevision)
  const scoutVisible = useSceneStore((s) => s.scoutVisible)
  const setScoutVisible = useSceneStore((s) => s.setScoutVisible)
  const scoutPins = useSceneStore((s) => s.scoutPins)
  const shiftHeldRef = useShiftKeyHeld()
  const altOrbit = useAltOrbitPassthrough()

  // Orbit mode: turntable rotation. Select mode: lasso selection.
  const [orbitMode, setOrbitMode] = useState(true)

  const { traces3d, layout3d, rowIndices, globePoints, mainTraceIndex3d } =
    useChartTraces(undefined, colorTheme)

  // In orbit mode let Plotly receive full pointer events.
  // In select mode also keep events; alt-hold passes them to Three.js.
  const plotPointerEvents = altOrbit ? 'none' : 'auto'

  const onSelected = useCallback(
    (ev) => {
      const mapped = plotlySelectionToGlobalRowIndices(
        ev,
        rowIndices,
        traces3d.length,
        mainTraceIndex3d,
      )
      setSelectedRowIndices((prev) => {
        if (!shiftHeldRef.current) return mapped
        return [...new Set([...prev, ...mapped])].sort((a, b) => a - b)
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rowIndices, setSelectedRowIndices, traces3d.length, mainTraceIndex3d],
  )

  const onDeselect = useCallback(() => {
    setSelectedRowIndices([])
  }, [setSelectedRowIndices])

  if (is2DMode || !layout3d) return null

  if (activeChartType === 'globe') {
    if (globePoints.length === 0) return null
    return (
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
        <ViewportToolbar
          orbitMode
          onOrbit={() => {}}
          onSelect={() => {}}
          onSwitch2D={() => setIs2DMode(true)}
          scoutVisible={scoutVisible}
          hasScout={scoutPins.length > 0}
          onToggleScout={() => setScoutVisible(!scoutVisible)}
        />
        <div style={{ pointerEvents: 'auto', position: 'absolute', inset: 0 }}>
          <GlobeHtmlChart points={globePoints} />
        </div>
      </div>
    )
  }

  if (!traces3d.length) return null

  const dragmode = orbitMode ? 'turntable' : 'lasso'

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
      <ViewportToolbar
        orbitMode={orbitMode}
        onOrbit={() => setOrbitMode(true)}
        onSelect={() => setOrbitMode(false)}
        onSwitch2D={() => setIs2DMode(true)}
        scoutVisible={scoutVisible}
        hasScout={scoutPins.length > 0}
        onToggleScout={() => setScoutVisible(!scoutVisible)}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: plotPointerEvents,
        }}
      >
        <Plot
          data={traces3d.map((tr, idx) => ({
            ...tr,
            selectedpoints: idx === traces3d.length - 1 ? null : undefined,
          }))}
          layout={{
            ...layout3d,
            dragmode,
            revision: plotlyViewRevision,
          }}
          config={{ displayModeBar: false }}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler
          onSelected={onSelected}
          onDeselect={onDeselect}
        />
      </div>
    </div>
  )
}

// ─── Chart2DPanel — full-viewport overlay in 2D mode ────────────────────────

/**
 * Full-viewport DOM overlay for the 2D Plotly chart.
 * Shown only when `is2DMode` is true. Render inside the same `position: relative`
 * viewport wrapper as Chart3DPanel.
 */
export function Chart2DPanel() {
  const colorTheme = useThemeStore((s) => s.theme)
  const is2DMode = useSceneStore((s) => s.is2DMode)
  const setIs2DMode = useSceneStore((s) => s.setIs2DMode)
  const setSelectedRowIndices = useSceneStore((s) => s.setSelectedRowIndices)
  const shiftHeldRef = useShiftKeyHeld()
  const { traces2d, layout2d, rowIndices, mainTraceIndex2d } = useChartTraces(
    undefined,
    colorTheme,
  )

  const onSelected = useCallback(
    (ev) => {
      const mapped = plotlySelectionToGlobalRowIndices(
        ev,
        rowIndices,
        traces2d.length,
        mainTraceIndex2d,
      )
      setSelectedRowIndices((prev) => {
        if (!shiftHeldRef.current) return mapped
        return [...new Set([...prev, ...mapped])].sort((a, b) => a - b)
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rowIndices, setSelectedRowIndices, traces2d.length, mainTraceIndex2d],
  )

  const onDeselect = useCallback(() => {
    setSelectedRowIndices([])
  }, [setSelectedRowIndices])

  if (!is2DMode || !traces2d.length || !layout2d) return null

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 2,
        background: 'var(--scene-canvas-bg, #0A0A0A)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Toolbar row */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          borderBottom: '1px solid var(--ui-chart-rail-border-outer)',
          gap: 8,
        }}
      >
        <span
          style={{
            fontFamily: "'DM Mono', ui-monospace, monospace",
            fontSize: 9,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--chrome-muted-text, #5c5c6e)',
          }}
        >
          2D view — lasso to select · drag to pan · scroll to zoom
        </span>
        <button
          type="button"
          style={{
            fontFamily: "'DM Mono', ui-monospace, monospace",
            fontSize: 9,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            padding: '5px 10px',
            background: 'var(--ui-accent-dim)',
            border: '1px solid var(--ui-accent-border)',
            color: 'var(--ui-accent)',
            cursor: 'pointer',
            borderRadius: 4,
          }}
          onClick={() => setIs2DMode(false)}
        >
          ↩ Back to 3D
        </button>
      </div>
      {/* Chart fills the rest */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <Plot
          data={traces2d.map((tr, idx) => ({
            ...tr,
            selectedpoints: idx === traces2d.length - 1 ? null : undefined,
          }))}
          layout={{ ...layout2d, dragmode: 'lasso' }}
          config={{ displayModeBar: false }}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler
          onSelected={onSelected}
          onDeselect={onDeselect}
        />
      </div>
    </div>
  )
}
