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

/** Metadata for each LENS data type — icon (inline SVG), readable label, one-line descriptor. */
const DATA_TYPE_META = /** @type {Record<string, { label: string; desc: string; icon: import('react').ReactElement }>} */ ({
  tabular: {
    label: 'Tabular',
    desc: 'Rows & columns — standard dataset',
    icon: (
      <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
        <rect x="0.5" y="0.5" width="4.5" height="4.5" rx="0.75" fill="currentColor" opacity="0.9" />
        <rect x="7" y="0.5" width="4.5" height="4.5" rx="0.75" fill="currentColor" opacity="0.55" />
        <rect x="0.5" y="7" width="4.5" height="4.5" rx="0.75" fill="currentColor" opacity="0.55" />
        <rect x="7" y="7" width="4.5" height="4.5" rx="0.75" fill="currentColor" opacity="0.9" />
      </svg>
    ),
  },
  'time-series': {
    label: 'Time Series',
    desc: 'Ordered by time — trends & seasonality',
    icon: (
      <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
        <polyline
          points="0.5,9.5 2.5,5.5 5,7.5 7.5,2.5 11.5,4.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  geographic: {
    label: 'Geographic',
    desc: 'Lat / lng — spatial patterns',
    icon: (
      <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
        <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.3" />
        <ellipse cx="6" cy="6" rx="2.4" ry="5" stroke="currentColor" strokeWidth="1.1" />
        <line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1.1" />
      </svg>
    ),
  },
  audio: {
    label: 'Audio',
    desc: 'Waveform or spectral data',
    icon: (
      <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
        <rect x="0" y="4.5" width="1.8" height="3" rx="0.9" fill="currentColor" opacity="0.6" />
        <rect x="2.5" y="2.5" width="1.8" height="7" rx="0.9" fill="currentColor" opacity="0.8" />
        <rect x="5.1" y="0.5" width="1.8" height="11" rx="0.9" fill="currentColor" />
        <rect x="7.7" y="2.5" width="1.8" height="7" rx="0.9" fill="currentColor" opacity="0.8" />
        <rect x="10.2" y="4.5" width="1.8" height="3" rx="0.9" fill="currentColor" opacity="0.6" />
      </svg>
    ),
  },
  graph: {
    label: 'Graph / Network',
    desc: 'Nodes & edges — relationships',
    icon: (
      <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
        <circle cx="6" cy="1.8" r="1.5" fill="currentColor" />
        <circle cx="1.8" cy="9.5" r="1.5" fill="currentColor" />
        <circle cx="10.2" cy="9.5" r="1.5" fill="currentColor" />
        <line x1="6" y1="3.3" x2="1.8" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="6" y1="3.3" x2="10.2" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="3.3" y1="9.5" x2="8.7" y2="9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
})

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
 * Sidebar variant — plain scrollable container, no drag, no fixed position.
 * @param {{ children: import('react').ReactNode }} props
 */
function LensPanelSidebarShell({ children }) {
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

/**
 * Draggable shell: fixed default slot (bottom-right); drag header to move; Default slot resets dock.
 * @param {{ children: import('react').ReactNode }} props
 */
function LensPanelDraggableShell({ children }) {
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
 * Draggable shell: fixed default slot (bottom-right); drag header to move; Default slot resets dock.
 * When `sidebar` is true, renders as a plain scrollable container (no dragging, no fixed position).
 * @param {{ children: import('react').ReactNode; sidebar?: boolean }} props
 */
function LensPanelShell({ children, sidebar = false }) {
  if (sidebar) {
    return <LensPanelSidebarShell>{children}</LensPanelSidebarShell>
  }
  return <LensPanelDraggableShell>{children}</LensPanelDraggableShell>
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
  const [reasoningOpen, setReasoningOpen] = useState(false)

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

      {/* ── Alerts (low confidence / warnings) ─────────────────────── */}
      {lowConfidence && (
        <div
          style={{
            marginBottom: 10,
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid rgba(255, 107, 53, 0.5)',
            background: 'rgba(255, 107, 53, 0.1)',
            fontFamily: "'DM Mono', ui-monospace, monospace",
            fontSize: 10,
            color: '#FF9B70',
            lineHeight: 1.4,
          }}
        >
          <strong style={{ color: '#A81C1C' }}>Low confidence {conf.toFixed(2)}</strong>
          {' — '}review axes before rendering.
        </div>
      )}
      {lensWarnings.length > 0 && (
        <div
          style={{
            marginBottom: 10,
            padding: '7px 9px',
            borderRadius: 8,
            border: '1px solid rgba(255, 184, 0, 0.35)',
            background: 'rgba(255, 184, 0, 0.07)',
            fontFamily: "'DM Mono', ui-monospace, monospace",
            fontSize: 9,
            color: '#FFB800',
            lineHeight: 1.4,
          }}
        >
          {lensWarnings.map((w) => (
            <div key={w}>• {w}</div>
          ))}
        </div>
      )}

      {/* ── 1. Dataset identity row ─────────────────────────────────── */}
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: 6,
          }}
        >
          <span
            style={{
              fontFamily: "'DM Mono', ui-monospace, monospace",
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--ui-text-strong)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}
          >
            {datasetMeta?.name ?? 'Dataset'}
          </span>
          <span
            style={{
              fontFamily: "'DM Mono', ui-monospace, monospace",
              fontSize: 10,
              color: 'var(--ui-text-faint)',
              flexShrink: 0,
            }}
          >
            {(uploadedData?.rowCount ?? 0) > MAX_ROWS_BEFORE_SAMPLE
              ? `${SAMPLE_SIZE.toLocaleString()} / ${(uploadedData?.rowCount ?? 0).toLocaleString()} rows`
              : `${uploadedData?.rowCount ?? 0} rows`}
          </span>
        </div>

        {/* Data type — compact inline pill */}
        {(() => {
          const rawType = String(lensOutput.dataType ?? '')
          const meta = DATA_TYPE_META[rawType]
          return (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '2px 8px 2px 6px',
                borderRadius: 999,
                background: 'var(--ui-surface-chip)',
                border: '1px solid var(--ui-accent-border)',
                fontFamily: "'DM Mono', ui-monospace, monospace",
                fontSize: 9,
                color: 'var(--ui-accent)',
                letterSpacing: '0.04em',
              }}
            >
              {meta ? meta.icon : null}
              {meta ? meta.label : rawType}
            </span>
          )
        })()}
      </div>

      {/* ── Divider ─────────────────────────────────────────────────── */}
      <div style={{ height: 1, background: 'var(--ui-divider)', marginBottom: 14 }} />

      {/* ── 2. Visualization config ─────────────────────────────────── */}
      <div
        style={{
          fontFamily: "'DM Mono', ui-monospace, monospace",
          fontSize: 9,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--ui-text-faint)',
          marginBottom: 5,
        }}
      >
        Chart Type
      </div>
      <select
        value={chartChoice}
        onChange={(e) => setChartChoice(/** @type {never} */ (e.target.value))}
        style={{
          width: '100%',
          marginBottom: 12,
          fontFamily: "'DM Mono', ui-monospace, monospace",
          fontSize: 11,
          padding: '7px 9px',
          borderRadius: 6,
          border: '1px solid var(--ui-accent-border-soft)',
          background: 'var(--ui-surface-input)',
          color: 'var(--ui-text-body)',
        }}
      >
        {chartTypeOptions.map(([id, label]) => (
          <option key={id} value={id}>{label}</option>
        ))}
      </select>

      <div
        style={{
          fontFamily: "'DM Mono', ui-monospace, monospace",
          fontSize: 9,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--ui-text-faint)',
          marginBottom: 7,
        }}
      >
        Axes
      </div>
      {(/** @type {const} */ ([['X', 'x'], ['Y', 'y'], ['Z', 'z']])).map(([label, key]) => (
        <label
          key={key}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 6,
          }}
        >
          <span
            style={{
              width: 14,
              fontFamily: "'DM Mono', ui-monospace, monospace",
              fontSize: 9,
              color: 'var(--ui-accent)',
              letterSpacing: '0.06em',
              flexShrink: 0,
            }}
          >
            {label}
          </span>
          <select
            value={axis[key]}
            onChange={(e) => setAxis((a) => ({ ...a, [key]: e.target.value }))}
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
              axisSelectCols.map((c) => <option key={c} value={c}>{c}</option>)
            )}
          </select>
        </label>
      ))}

      {/* Data quality alerts */}
      {(nullWarnings.length > 0 || outliers.length > 0) && (
        <div
          style={{
            margin: '8px 0 4px',
            fontFamily: "'DM Mono', ui-monospace, monospace",
            fontSize: 10,
            color: '#FFB800',
            lineHeight: 1.45,
          }}
        >
          {nullWarnings.length > 0 && (
            <div style={{ marginBottom: outliers.length ? 6 : 0 }}>
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

      {/* ── 3. Primary action ───────────────────────────────────────── */}
      <button
        type="button"
        onClick={onRender}
        disabled={updateBusy}
        style={{
          width: '100%',
          marginTop: 12,
          padding: '11px 14px',
          fontFamily: "'Bebas Neue', system-ui, sans-serif",
          fontWeight: 700,
          fontSize: 13,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: updateBusy ? 'var(--ui-text-subtle)' : '#ffffff',
          background: updateBusy ? 'var(--ui-surface-muted)' : 'var(--ui-accent)',
          border: 'none',
          borderRadius: 8,
          cursor: updateBusy ? 'wait' : 'pointer',
          transition: 'opacity 0.15s ease, box-shadow 0.15s ease',
          opacity: updateBusy ? 0.6 : 1,
        }}
        onMouseEnter={(e) => {
          if (updateBusy) return
          e.currentTarget.style.opacity = '0.88'
          e.currentTarget.style.boxShadow = '0 4px 16px var(--ui-accent-glow)'
        }}
        onMouseLeave={(e) => {
          if (updateBusy) return
          e.currentTarget.style.opacity = '1'
          e.currentTarget.style.boxShadow = 'none'
        }}
      >
        {updateBusy ? 'Rendering…' : 'Update scene'}
      </button>

      {/* ── Divider ─────────────────────────────────────────────────── */}
      <div style={{ height: 1, background: 'var(--ui-divider)', margin: '14px 0 10px' }} />

      {/* ── 4. Collapsible reasoning ────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setReasoningOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          background: 'none',
          border: 'none',
          padding: '2px 0',
          cursor: 'pointer',
          fontFamily: "'DM Mono', ui-monospace, monospace",
          fontSize: 9,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--ui-text-faint)',
          marginBottom: reasoningOpen ? 6 : 0,
        }}
      >
        <span>LENS Reasoning</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          aria-hidden="true"
          style={{
            transition: 'transform 0.18s ease',
            transform: reasoningOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          <path
            d="M2 3.5L5 6.5L8 3.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {reasoningOpen && (
        <p
          style={{
            margin: '0 0 4px',
            fontFamily: "'DM Mono', ui-monospace, monospace",
            fontSize: 10,
            color: 'var(--ui-text-muted)',
            lineHeight: 1.55,
          }}
        >
          {String(lensOutput.reasoning ?? '')}
        </p>
      )}

      {/* ── 5. Secondary actions — side by side ─────────────────────── */}
      <div style={{ display: 'flex', gap: 7, marginTop: 12 }}>
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
            flex: 1,
            padding: '8px 6px',
            fontFamily: "'DM Mono', ui-monospace, monospace",
            fontSize: 9,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: downloadDone ? '#4ade80' : 'var(--ui-accent)',
            background: downloadDone ? 'rgba(74, 222, 128, 0.07)' : 'var(--ui-accent-dim)',
            border: downloadDone
              ? '1px solid rgba(74, 222, 128, 0.35)'
              : '1px solid var(--ui-accent-border)',
            borderRadius: 7,
            cursor: 'pointer',
            transition: 'color 0.25s, background 0.25s, border-color 0.25s',
          }}
        >
          {downloadDone ? '✓ Saved' : 'JSON'}
        </button>
        <button
          type="button"
          onClick={() => setBadgeOpen(true)}
          style={{
            flex: 1,
            padding: '8px 6px',
            fontFamily: "'DM Mono', ui-monospace, monospace",
            fontSize: 9,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#A81C1C',
            background: 'rgba(168, 28, 28, 0.06)',
            border: '1px solid rgba(168, 28, 28, 0.35)',
            borderRadius: 7,
            cursor: 'pointer',
          }}
        >
          Badge
        </button>
      </div>

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
