/* eslint-disable react/prop-types -- props validated via JSDoc */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSceneStore } from '../../store/useSceneStore.js'
import { MAX_ROWS_BEFORE_SAMPLE, SAMPLE_SIZE } from '../../utils/chartUtils.js'
import { BadgeExport } from './BadgeExport.jsx'
import {
  buildInsightReportFromWorkspace,
  downloadInsightReportJson,
} from '../../ai/agents/bridge.js'
import { sanitizeFilename } from '../../utils/sanitizeFilename.js'

/**
 * @param {string} raw
 */
function normalizeChartType(raw) {
  const v = String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/[\s_]/g, '')
  const map = {
    scatter3d: 'scatter3d',
    surface: 'surface',
    mesh3d: 'mesh3d',
    bar3d: 'bar3d',
    globe: 'globe',
    graph3d: 'graph3d',
    graph: 'graph3d',
  }
  if (map[v]) return map[v]
  if (v.includes('graph') || v.includes('network')) return 'graph3d'
  if (v.includes('scatter')) return 'scatter3d'
  return 'scatter3d'
}

/**
 * @param {string} id
 */
function formatChartTitle(id) {
  const labels = {
    scatter3d: 'Scatter 3D',
    surface: 'Surface',
    mesh3d: 'Mesh 3D',
    bar3d: 'Bar 3D',
    globe: 'Globe',
    graph3d: 'Graph 3D',
  }
  return labels[id] ?? id
}

/** Dedupes auto-render across React StrictMode’s double mount (dev). */
const lensSessionsAutoRendered = new Set()

/** Chart type override options (value, label). */
const CHART_TYPE_OPTIONS = /** @type {const} */ ([
  ['scatter3d', 'Scatter 3D'],
  ['surface', 'Surface / heatmap'],
  ['mesh3d', 'Mesh 3D'],
  ['bar3d', 'Bar 3D'],
  ['globe', 'Globe'],
])

/**
 * @param {Record<string, unknown>} lensOutput
 * @param {string[]} axisSelectCols — numeric + datetime columns eligible for X/Y/Z
 */
function axisDefaults(lensOutput, axisSelectCols) {
  const m = lensOutput.axisMapping ?? {}
  const pick = (name) =>
    name && axisSelectCols.includes(String(name)) ? String(name) : undefined
  return {
    x: pick(m.x) ?? axisSelectCols[0] ?? '',
    y: pick(m.y) ?? axisSelectCols[1] ?? axisSelectCols[0] ?? '',
    z: pick(m.z) ?? axisSelectCols[2] ?? axisSelectCols[0] ?? '',
  }
}

/** v3: bottom-right dock; v2 was top-right */
const LENS_PANEL_POS_KEY = 'lens-panel-position-v3'
const LENS_PANEL_POS_KEY_LEGACY = 'lens-panel-position-v2'

/** Pixels from viewport edge when docked */
const DOCK_RIGHT = 16
/** Distance from bottom edge when docked — panel grows upward */
const DOCK_BOTTOM = 10
const PANEL_BASE_WIDTH = 320

/**
 * @param {number} left
 * @param {number} top
 * @param {number} width
 * @param {number} height
 */
function clampPanelToViewport(left, top, width, height) {
  const pad = 8
  const ww = window.innerWidth
  const wh = window.innerHeight
  const w = Math.max(80, width)
  const h = Math.max(48, height)
  const maxLeft = Math.max(pad, ww - w - pad)
  const maxTop = Math.max(pad, wh - h - pad)
  return {
    left: Math.max(pad, Math.min(maxLeft, left)),
    top: Math.max(pad, Math.min(maxTop, top)),
  }
}

/**
 * @param {string} key
 * @returns {{ left: number; top: number } | null}
 */
function readSavedPanelPos(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const p = JSON.parse(raw)
    if (typeof p.left === 'number' && typeof p.top === 'number') {
      return { left: p.left, top: p.top }
    }
  } catch {
    /* ignore */
  }
  return null
}

const DRAG_HANDLE_STYLE = {
  cursor: 'grab',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  touchAction: 'none',
  margin: '-8px -18px 12px',
  padding: '10px 18px',
  borderRadius: '11px 11px 0 0',
  borderBottom: '1px solid var(--ui-accent-border-soft)',
  fontFamily: "'DM Mono', ui-monospace, monospace",
  fontSize: 9,
  letterSpacing: '0.1em',
  color: 'var(--ui-text-subtle)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  flexShrink: 0,
}

/**
 * Draggable shell: fixed default slot (bottom-right); drag header to move; Default slot resets dock.
 * When `sidebar` is true, renders as a plain scrollable container (no dragging, no fixed position).
 * @param {{ children: import('react').ReactNode; sidebar?: boolean }} props
 */
function LensPanelShell({ children, sidebar = false }) {
  if (sidebar) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          overflowY: 'auto',
          padding: '12px 16px 24px',
          boxSizing: 'border-box',
        }}
      >
        {children}
      </div>
    )
  }
  const is2DMode = useSceneStore((s) => s.is2DMode)
  const rootRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const [panelPos, setPanelPos] = useState(() => {
    const v2 = readSavedPanelPos(LENS_PANEL_POS_KEY)
    if (v2) return v2
    const legacy = readSavedPanelPos(LENS_PANEL_POS_KEY_LEGACY)
    if (legacy) return legacy
    return null
  })
  const drag = useRef(
    /** @type {null | { pointerId: number; x0: number; y0: number; l0: number; t0: number }} */ (
      null
    ),
  )
  const lastPos = useRef(
    /** @type {{ left: number; top: number } | null} */ (null),
  )

  const dock = () => {
    setPanelPos(null)
    lastPos.current = null
    try {
      localStorage.removeItem(LENS_PANEL_POS_KEY)
      localStorage.removeItem(LENS_PANEL_POS_KEY_LEGACY)
      localStorage.removeItem('lens-panel-position-v1')
    } catch {
      /* ignore */
    }
  }

  const persist = (p) => {
    try {
      localStorage.setItem(LENS_PANEL_POS_KEY, JSON.stringify(p))
    } catch {
      /* ignore */
    }
  }

  /** Keep any saved (or restored) free position within the real viewport and panel size */
  useLayoutEffect(() => {
    if (panelPos == null || !rootRef.current) return
    const el = rootRef.current
    const { width, height } = el.getBoundingClientRect()
    if (width < 4) return
    const n = clampPanelToViewport(panelPos.left, panelPos.top, width, height)
    if (Math.abs(n.left - panelPos.left) < 0.5 && Math.abs(n.top - panelPos.top) < 0.5) {
      return
    }
    setPanelPos(n)
    try {
      localStorage.setItem(LENS_PANEL_POS_KEY, JSON.stringify(n))
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- full panelPos would loop with setPanelPos; left/top suffice
  }, [panelPos?.left, panelPos?.top, is2DMode])

  useEffect(() => {
    if (panelPos == null) return
    const onResize = () => {
      const el = rootRef.current
      if (!el) return
      const { width, height } = el.getBoundingClientRect()
      setPanelPos((p) => {
        if (p == null) return p
        const n = clampPanelToViewport(p.left, p.top, width, height)
        if (n.left !== p.left || n.top !== p.top) {
          try {
            localStorage.setItem(LENS_PANEL_POS_KEY, JSON.stringify(n))
          } catch {
            /* ignore */
          }
        }
        return n
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [panelPos])

  /** @param {import('react').PointerEvent<HTMLDivElement>} e */
  const onPointerDown = (e) => {
    if (e.button !== 0) return
    const root = e.currentTarget.closest('.lens-panel-root')
    if (!root) return
    const rect = root.getBoundingClientRect()
    drag.current = {
      pointerId: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      l0: rect.left,
      t0: rect.top,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  /** @param {import('react').PointerEvent<HTMLDivElement>} e */
  const onPointerMove = (e) => {
    const d = drag.current
    if (!d || e.pointerId !== d.pointerId) return
    const el = rootRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    let left = d.l0 + (e.clientX - d.x0)
    let top = d.t0 + (e.clientY - d.y0)
    const next = clampPanelToViewport(left, top, width, height)
    lastPos.current = next
    setPanelPos(next)
  }

  /** @param {import('react').PointerEvent<HTMLDivElement>} e */
  const onPointerUp = (e) => {
    const d = drag.current
    if (d && e.pointerId === d.pointerId) {
      drag.current = null
      if (lastPos.current) persist(lastPos.current)
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const isDocked = panelPos == null
  const rootStyle = {
    width: PANEL_BASE_WIDTH,
    maxWidth: 'calc(100vw - 24px)',
    maxHeight: isDocked ? 'calc(100vh - 60px)' : 'calc(100vh - 24px)',
    overflowY: 'auto',
    padding: '8px 18px 20px',
    zIndex: 150,
    position: 'fixed',
    left: isDocked ? 'auto' : panelPos.left,
    top: isDocked ? 'auto' : panelPos.top,
    bottom: isDocked ? DOCK_BOTTOM : 'auto',
    right: isDocked ? DOCK_RIGHT : 'auto',
    transform: 'none',
    background: 'var(--ui-panel-bg)',
    border: '1px solid var(--ui-panel-border)',
    borderRadius: 12,
    boxShadow: 'var(--ui-panel-shadow)',
  }

  return (
    <div ref={rootRef} className="lens-panel-root lens-panel-in" style={rootStyle}>
      <div
        role="toolbar"
        aria-label="Move LENS panel"
        title="Default: heuristic LENS (no API tokens). Optional: VITE_AI_LENS_LLM=true in .env.local for LLM classification."
        style={DRAG_HANDLE_STYLE}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span>⋮⋮ LENS — drag to move</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            dock()
          }}
          title="Return panel to the default bottom-right slot"
          style={{
            fontFamily: "'DM Mono', ui-monospace, monospace",
            fontSize: 9,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            padding: '4px 8px',
            borderRadius: 6,
            border: '1px solid var(--ui-accent-border)',
            background: 'var(--ui-accent-dim)',
            color: 'var(--ui-accent)',
            cursor: 'pointer',
          }}
        >
          Default slot
        </button>
      </div>
      {children}
    </div>
  )
}

/**
 * @param {{
 *   lensSessionId: number;
 *   lensOutput: Record<string, unknown>;
 *   uploadedData: { rowCount?: number };
 *   datasetMeta: { name?: string } | null;
 *   axisSelectCols: string[];
 *   graphLinksCount: number;
 *   sidebar?: boolean;
 * }} props
 */
function LensPanelSuccess({
  lensSessionId,
  lensOutput,
  uploadedData,
  datasetMeta,
  axisSelectCols,
  graphLinksCount,
  lensWarnings,
  sidebar = false,
}) {
  const applyChartRender = useSceneStore((s) => s.applyChartRender)

  const [chartChoice, setChartChoice] = useState(() =>
    normalizeChartType(/** @type {string} */ (lensOutput.recommendedChart)),
  )

  const chartTypeOptions = useMemo(() => {
    const opts = [...CHART_TYPE_OPTIONS]
    if (graphLinksCount > 0) opts.push(['graph3d', 'Graph 3D'])
    return opts
  }, [graphLinksCount])

  const [axis, setAxis] = useState(() =>
    axisDefaults(lensOutput, axisSelectCols),
  )
  const [badgeOpen, setBadgeOpen] = useState(false)
  const [updateBusy, setUpdateBusy] = useState(false)
  const [downloadDone, setDownloadDone] = useState(false)

  useEffect(() => {
    if (!badgeOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') setBadgeOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [badgeOpen])

  const onRender = () => {
    setUpdateBusy(true)
    applyChartRender(chartChoice, { x: axis.x, y: axis.y, z: axis.z })
    setTimeout(() => setUpdateBusy(false), 600)
  }

  /** First LENS result applies the recommended view immediately; user can override and Render again */
  useEffect(() => {
    if (lensSessionsAutoRendered.has(lensSessionId)) return
    if (!axis.x || !axis.y || !axis.z) return
    if (axisSelectCols.length === 0) return
    lensSessionsAutoRendered.add(lensSessionId)
    if (lensSessionsAutoRendered.size > 64) {
      const it = lensSessionsAutoRendered.values()
      const first = it.next().value
      if (first != null) lensSessionsAutoRendered.delete(first)
    }
    applyChartRender(chartChoice, { x: axis.x, y: axis.y, z: axis.z })
  }, [
    applyChartRender,
    axis.x,
    axis.y,
    axis.z,
    axisSelectCols.length,
    chartChoice,
    lensSessionId,
  ])

  const nullWarnings =
    /** @type {{ column: string; nullCount: number }[]} */ (
      lensOutput.flaggedNulls
    )?.filter((f) => f.nullCount > 0) ?? []
  const outliers =
    /** @type {{ column: string; description: string }[]} */ (
      lensOutput.flaggedOutliers
    ) ?? []

  const conf = Number(lensOutput.confidence)
  const lowConfidence = Number.isFinite(conf) && conf < 0.6

  return (
    <LensPanelShell sidebar={sidebar}>
      {lowConfidence && (
        <div
          style={{
            marginBottom: 12,
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid rgba(255, 107, 53, 0.55)',
            background: 'rgba(255, 107, 53, 0.12)',
            fontFamily: "'DM Mono', ui-monospace, monospace",
            fontSize: 11,
            color: '#FF9B70',
            lineHeight: 1.45,
          }}
        >
          <strong style={{ color: '#FF6B35' }}>Low confidence ({conf.toFixed(2)})</strong>
          — review axis mapping and chart type before rendering.
        </div>
      )}
      {lensWarnings.length > 0 && (
        <div
          style={{
            marginBottom: 12,
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid rgba(255, 184, 0, 0.4)',
            background: 'rgba(255, 184, 0, 0.08)',
            fontFamily: "'DM Mono', ui-monospace, monospace",
            fontSize: 10,
            color: '#FFB800',
            lineHeight: 1.4,
          }}
        >
          {lensWarnings.map((w) => (
            <div key={w}>• {w}</div>
          ))}
        </div>
      )}
      <div
        style={{
          fontFamily: "'Bebas Neue', system-ui, sans-serif",
          fontWeight: 700,
          fontSize: 10,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--ui-accent)',
          marginBottom: 14,
        }}
      >
        LENS ANALYSIS
      </div>

      <div
        style={{
          fontFamily: "'DM Mono', ui-monospace, monospace",
          fontSize: 11,
          color: 'var(--ui-text-hint)',
          marginBottom: 12,
          lineHeight: 1.4,
        }}
      >
        <span style={{ color: 'var(--ui-text-strong)' }}>
          {datasetMeta?.name ?? 'Dataset'}
        </span>
        <span style={{ color: 'var(--ui-text-subtle)' }}> · </span>
        <span>{uploadedData?.rowCount ?? 0} rows</span>
      </div>

      {(uploadedData?.rowCount ?? 0) > MAX_ROWS_BEFORE_SAMPLE && (
        <div
          style={{
            fontFamily: "'DM Mono', ui-monospace, monospace",
            fontSize: 10,
            color: 'var(--ui-text-muted)',
            marginBottom: 12,
            lineHeight: 1.4,
          }}
        >
          Showing {SAMPLE_SIZE.toLocaleString()} of{' '}
          {(uploadedData?.rowCount ?? 0).toLocaleString()} rows (sampled)
        </div>
      )}

      <div
        style={{
          display: 'inline-block',
          padding: '4px 10px',
          borderRadius: 999,
          background: 'var(--ui-surface-chip)',
          border: '1px solid var(--ui-accent-border)',
          fontFamily: "'DM Mono', ui-monospace, monospace",
          fontSize: 10,
          color: 'var(--ui-accent)',
          marginBottom: 14,
        }}
      >
        {String(lensOutput.dataType ?? '')}
      </div>

      <div
        style={{
          fontFamily: "'Bebas Neue', system-ui, sans-serif",
          fontWeight: 600,
          fontSize: 18,
          color: 'var(--ui-text-on-accent)',
          marginBottom: 10,
          lineHeight: 1.25,
        }}
      >
        {formatChartTitle(chartChoice)}
      </div>

      <p
        style={{
          margin: '0 0 16px',
          fontFamily: "'DM Mono', ui-monospace, monospace",
          fontSize: 13,
          color: 'var(--ui-text-muted)',
          lineHeight: 1.5,
        }}
      >
        {String(lensOutput.reasoning ?? '')}
      </p>

      <div
        style={{
          fontFamily: "'DM Mono', ui-monospace, monospace",
          fontSize: 10,
          color: 'var(--ui-text-subtle)',
          letterSpacing: '0.06em',
          marginBottom: 6,
        }}
      >
        CHART TYPE
      </div>
      <select
        value={chartChoice}
        onChange={(e) =>
          setChartChoice(/** @type {never} */ (e.target.value))
        }
        style={{
          width: '100%',
          marginBottom: 14,
          fontFamily: "'DM Mono', ui-monospace, monospace",
          fontSize: 11,
          padding: '8px 10px',
          borderRadius: 6,
          border: '1px solid var(--ui-accent-border-soft)',
          background: 'var(--ui-surface-input)',
          color: 'var(--ui-text-body)',
        }}
      >
        {chartTypeOptions.map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>

      <div
        style={{
          fontFamily: "'DM Mono', ui-monospace, monospace",
          fontSize: 10,
          color: 'var(--ui-text-subtle)',
          letterSpacing: '0.06em',
          marginBottom: 8,
        }}
      >
        AXIS MAPPING
        <span
          style={{
            display: 'block',
            fontSize: 9,
            letterSpacing: '0.04em',
            color: 'var(--ui-text-faint)',
            marginTop: 4,
            lineHeight: 1.45,
            fontWeight: 400,
          }}
        >
          3D views use three channels (X, Y, Z). Extra columns remain in the dataset for agents and exports
        </span>
      </div>

      {(
        /** @type {const} */ ([
          ['X', 'x'],
          ['Y', 'y'],
          ['Z', 'z'],
        ])
      ).map(([label, key]) => (
        <label
          key={key}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 8,
            fontSize: 11,
            color: 'var(--ui-text-label)',
          }}
        >
          <span style={{ width: 18 }}>{label}</span>
          <select
            value={axis[key]}
            onChange={(e) =>
              setAxis((a) => ({ ...a, [key]: e.target.value }))
            }
            style={{
              flex: 1,
              fontFamily: "'DM Mono', ui-monospace, monospace",
              fontSize: 11,
              padding: '6px 8px',
              borderRadius: 6,
              border: '1px solid var(--ui-accent-border-soft)',
              background: 'var(--ui-surface-input)',
              color: 'var(--ui-text-body)',
            }}
          >
            {axisSelectCols.length === 0 ? (
              <option value="">No plottable columns</option>
            ) : (
              axisSelectCols.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))
            )}
          </select>
        </label>
      ))}

      {(nullWarnings.length > 0 || outliers.length > 0) && (
        <div
          style={{
            marginTop: 12,
            marginBottom: 16,
            fontFamily: "'DM Mono', ui-monospace, monospace",
            fontSize: 11,
            color: '#FFB800',
            lineHeight: 1.45,
          }}
        >
          {nullWarnings.length > 0 && (
            <div style={{ marginBottom: outliers.length ? 8 : 0 }}>
              <strong>Nulls:</strong>{' '}
              {nullWarnings.map((n) => `${n.column} (${n.nullCount})`).join(', ')}
            </div>
          )}
          {outliers.length > 0 && (
            <div>
              <strong>Outliers:</strong>{' '}
              {outliers.map((o) => `${o.column}: ${o.description}`).join(' · ')}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={onRender}
        disabled={updateBusy}
        style={{
          width: '100%',
          marginTop: 4,
          padding: '12px 14px',
          fontFamily: "'Bebas Neue', system-ui, sans-serif",
          fontWeight: 600,
          fontSize: 11,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: updateBusy ? 'var(--ui-text-muted)' : 'var(--ui-accent)',
          background: updateBusy ? 'var(--ui-accent-dim)' : 'transparent',
          border: '1px solid var(--ui-accent-border)',
          borderRadius: 8,
          cursor: updateBusy ? 'wait' : 'pointer',
          transition: 'box-shadow 0.2s ease, background 0.2s ease, color 0.2s ease',
        }}
        onMouseEnter={(e) => {
          if (updateBusy) return
          e.currentTarget.style.boxShadow = `0 0 24px var(--ui-accent-glow)`
          e.currentTarget.style.background = 'var(--ui-accent-dim)'
        }}
        onMouseLeave={(e) => {
          if (updateBusy) return
          e.currentTarget.style.boxShadow = 'none'
          e.currentTarget.style.background = 'transparent'
        }}
      >
        {updateBusy ? 'Rendering…' : 'Update scene'}
      </button>

      <button
        type="button"
        onClick={() => {
          const report = buildInsightReportFromWorkspace(useSceneStore.getState())
          const base = sanitizeFilename(datasetMeta?.name ?? 'dataset', 'dataset')
          downloadInsightReportJson(report, base)
          setDownloadDone(true)
          setTimeout(() => setDownloadDone(false), 2500)
        }}
        style={{
          width: '100%',
          marginTop: 8,
          padding: '10px 14px',
          fontFamily: "'DM Mono', ui-monospace, monospace",
          fontWeight: 600,
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: downloadDone ? '#4ade80' : 'var(--ui-accent)',
          background: downloadDone ? 'rgba(74, 222, 128, 0.08)' : 'var(--ui-accent-dim)',
          border: downloadDone
            ? '1px solid rgba(74, 222, 128, 0.4)'
            : '1px solid var(--ui-accent-border)',
          borderRadius: 8,
          cursor: 'pointer',
          transition: 'color 0.3s ease, background 0.3s ease, border-color 0.3s ease',
        }}
      >
        {downloadDone ? 'Saved to downloads' : 'Download insight JSON'}
      </button>

      <button
        type="button"
        onClick={() => setBadgeOpen(true)}
        style={{
          width: '100%',
          marginTop: 10,
          padding: '10px 14px',
          fontFamily: "'DM Mono', ui-monospace, monospace",
          fontWeight: 600,
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: '#A81C1C',
          background: 'rgba(168, 28, 28, 0.06)',
          border: '1px solid rgba(168, 28, 28, 0.45)',
          borderRadius: 8,
          cursor: 'pointer',
        }}
      >
        Export badge
      </button>

      {badgeOpen && (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'var(--ui-modal-scrim)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => setBadgeOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Data badge export"
            style={{
              position: 'relative',
              maxWidth: 'min(440px, 100vw)',
              padding: 20,
              borderRadius: 16,
              background: 'var(--ui-panel-bg-solid)',
              border: '1px solid var(--ui-panel-border)',
              boxShadow: 'var(--ui-dialog-shadow)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Close"
              onClick={() => setBadgeOpen(false)}
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                width: 32,
                height: 32,
                border: 'none',
                borderRadius: 8,
                background: 'var(--ui-close-bg)',
                color: 'var(--ui-text-muted)',
                cursor: 'pointer',
                fontSize: 18,
                lineHeight: 1,
              }}
            >
              ×
            </button>
            <div
              style={{
                fontFamily: "'Bebas Neue', system-ui, sans-serif",
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--ui-accent)',
                marginBottom: 16,
                paddingRight: 36,
              }}
            >
              Data badge
            </div>
            <BadgeExport />
          </div>
        </div>
      )}
    </LensPanelShell>
  )
}

/** @param {{ sidebar?: boolean }} [props] */
export function LensPanel({ sidebar = false } = {}) {
  const uploadedData = useSceneStore((s) => s.uploadedData)
  const datasetMeta = useSceneStore((s) => s.datasetMeta)
  const lensOutput = useSceneStore((s) => s.lensOutput)
  const lensWarnings = useSceneStore((s) => s.lensWarnings)
  const lensSessionId = useSceneStore((s) => s.lensSessionId)
  const lensStatus = useSceneStore((s) => s.lensStatus)
  const lensError = useSceneStore((s) => s.lensError)

  const axisSelectCols = useMemo(() => {
    if (!uploadedData?.columns || !uploadedData.detectedTypes) return []
    return uploadedData.columns.filter(
      (c) =>
        uploadedData.detectedTypes[c] === 'numeric' ||
        uploadedData.detectedTypes[c] === 'datetime',
    )
  }, [uploadedData])

  const graphLinksCount = uploadedData?.graphLinks?.length ?? 0

  const visible =
    Boolean(uploadedData) &&
    (lensStatus === 'loading' ||
      lensOutput != null ||
      (lensStatus === 'error' && lensError != null))

  if (!uploadedData || !visible) return null

  if (lensStatus === 'loading' && !lensOutput) {
    return (
      <LensPanelShell sidebar={sidebar}>
        <div
          style={{
            fontFamily: "'Bebas Neue', system-ui, sans-serif",
            fontWeight: 700,
            fontSize: 10,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--ui-accent)',
            marginBottom: 12,
          }}
        >
          LENS ANALYSIS
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontFamily: "'DM Mono', ui-monospace, monospace",
            fontSize: 11,
            color: 'var(--ui-text-muted)',
            lineHeight: 1.45,
          }}
        >
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              border: '2px solid var(--ui-accent-border-soft)',
              borderTopColor: 'var(--ui-accent)',
              animation: 'upload-spin 0.8s linear infinite',
              flexShrink: 0,
            }}
            aria-hidden
          />
          <span>
            Classifying{' '}
            <strong style={{ color: 'var(--ui-text-body)' }}>
              {datasetMeta?.name ?? 'dataset'}
            </strong>
            … chart type and axes update in a moment.
          </span>
        </div>
      </LensPanelShell>
    )
  }

  if (lensStatus === 'error' && !lensOutput) {
    return (
      <LensPanelShell sidebar={sidebar}>
        <div
          style={{
            fontFamily: "'Bebas Neue', system-ui, sans-serif",
            fontWeight: 700,
            fontSize: 10,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--ui-accent)',
            marginBottom: 10,
          }}
        >
          LENS ANALYSIS
        </div>
        <p style={{ margin: 0, fontSize: 12, color: '#FFB800', lineHeight: 1.5 }}>
          {lensError}
        </p>
      </LensPanelShell>
    )
  }

  if (!lensOutput || !uploadedData) return null

  return (
    <LensPanelSuccess
      key={lensSessionId}
      lensSessionId={lensSessionId}
      lensOutput={lensOutput}
      uploadedData={uploadedData}
      datasetMeta={datasetMeta}
      axisSelectCols={axisSelectCols}
      graphLinksCount={graphLinksCount}
      lensWarnings={lensWarnings}
      sidebar={sidebar}
    />
  )
}
