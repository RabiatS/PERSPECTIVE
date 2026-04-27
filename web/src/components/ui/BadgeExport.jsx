import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import Plot from 'react-plotly.js'
import Plotly from 'plotly.js-dist'
import { useSceneStore } from '../../store/useSceneStore.js'
import { useThemeStore } from '../../store/useThemeStore.js'
import { sanitizeFilename } from '../../utils/sanitizeFilename.js'
import { computeBadgeStats } from '../../utils/badgeStats.js'
import { buildMiniTrace } from '../../utils/badgeMiniTrace.js'

const MINI_W = 160
const MINI_H = 160

/** @param {'dark' | 'light'} theme */
function buildMiniLayout(theme) {
  const light = theme === 'light'
  const axisMuted = light ? '#5c5c6e' : '#5a5a68'
  const grid = light ? 'rgba(0,100,110,0.12)' : 'rgba(94,234,212,0.08)'
  const bgScene = light ? 'rgba(248,250,252,0.98)' : 'rgba(10,10,18,0.98)'
  const bgPlane = light ? 'rgba(240,242,248,0.96)' : 'rgba(8,8,14,0.9)'
  return {
    width: MINI_W,
    height: MINI_H,
    autosize: false,
    paper_bgcolor: light ? '#eef1f8' : '#0a0a12',
    plot_bgcolor: 'rgba(0,0,0,0)',
    margin: { l: 0, r: 0, t: 0, b: 0, pad: 0 },
    showlegend: false,
    scene: {
      bgcolor: bgScene,
      xaxis: {
        showbackground: true,
        backgroundcolor: bgPlane,
        gridcolor: grid,
        showgrid: true,
        zeroline: false,
        color: axisMuted,
        tickfont: { size: 8 },
      },
      yaxis: {
        showbackground: true,
        backgroundcolor: bgPlane,
        gridcolor: grid,
        showgrid: true,
        zeroline: false,
        color: axisMuted,
        tickfont: { size: 8 },
      },
      zaxis: {
        showbackground: true,
        backgroundcolor: bgPlane,
        gridcolor: grid,
        showgrid: true,
        zeroline: false,
        color: axisMuted,
        tickfont: { size: 8 },
      },
      camera: { eye: { x: 1.45, y: 1.45, z: 1.12 } },
      aspectmode: 'data',
    },
  }
}

const exportBtnStyle = {
  flex: 1,
  background: 'transparent',
  border: '1px solid var(--ui-accent-border)',
  color: 'var(--ui-accent)',
  borderRadius: '8px',
  padding: '8px',
  fontFamily: "'DM Mono', ui-monospace, monospace",
  fontSize: '11px',
  cursor: 'pointer',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
}

/**
 * @param {{ x?: string; y?: string; z?: string }} lensOutput
 * @param {{ columns?: string[]; detectedTypes?: Record<string, string> }} uploadedData
 */
function resolveAxisMapping(uploadedData, lensOutput, storeAxis) {
  if (storeAxis?.x && storeAxis?.y) {
    return {
      x: storeAxis.x,
      y: storeAxis.y,
      z: storeAxis.z ?? '',
    }
  }
  const axisCols =
    uploadedData?.columns?.filter(
      (c) =>
        uploadedData.detectedTypes?.[c] === 'numeric' ||
        uploadedData.detectedTypes?.[c] === 'datetime',
    ) ?? []
  const m = lensOutput?.axisMapping ?? {}
  const pick = (name) =>
    name && axisCols.includes(String(name)) ? String(name) : undefined
  return {
    x: pick(m.x) ?? axisCols[0] ?? '',
    y: pick(m.y) ?? axisCols[1] ?? axisCols[0] ?? '',
    z: pick(m.z) ?? axisCols[2] ?? axisCols[0] ?? '',
  }
}

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

export function BadgeExport() {
  const theme = useThemeStore((s) => s.theme)
  const miniLayout = useMemo(() => buildMiniLayout(theme), [theme])
  const badgeRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [plotSnapshot, setPlotSnapshot] = useState(
    /** @type {string | null} */ (null),
  )
  const thumbGenRef = useRef(0)
  const thumbTimerRef = useRef(0)

  const uploadedData = useSceneStore((s) => s.uploadedData)
  const datasetMeta = useSceneStore((s) => s.datasetMeta)
  const lensOutput = useSceneStore((s) => s.lensOutput)
  const activeChartType = useSceneStore((s) => s.activeChartType)
  const axisMapping = useSceneStore((s) => s.axisMapping)
  const uploadSessionId = useSceneStore((s) => s.uploadSessionId)
  const renderGeneration = useSceneStore((s) => s.renderGeneration)

  const axis = useMemo(
    () => resolveAxisMapping(uploadedData, lensOutput, axisMapping),
    [uploadedData, lensOutput, axisMapping],
  )

  const chartType =
    activeChartType ?? normalizeChartType(lensOutput?.recommendedChart)

  const displayName =
    datasetMeta?.name ?? datasetMeta?.filename ?? 'dataset'
  const baseName = sanitizeFilename(displayName, 'dataset')

  const stats = useMemo(
    () => computeBadgeStats(uploadedData, axis),
    [uploadedData, axis],
  )

  const trace = useMemo(
    () =>
      buildMiniTrace(
        chartType,
        uploadedData?.rows ?? [],
        axis,
        uploadedData?.detectedTypes,
      ),
    [chartType, uploadedData, axis],
  )

  const plotKey = `${uploadSessionId}-${renderGeneration}-${chartType}-${axis.x}-${axis.y}-${axis.z}-${theme}`

  useEffect(() => {
    thumbGenRef.current += 1
    queueMicrotask(() => setPlotSnapshot(null))
  }, [plotKey])

  const schedulePlotSnapshot = useCallback(
    /** @param {HTMLElement | null | undefined} gd */
    (gd) => {
      if (!gd) return
      window.clearTimeout(thumbTimerRef.current)
      const gen = thumbGenRef.current
      thumbTimerRef.current = window.setTimeout(() => {
        void Plotly.toImage(gd, {
          format: 'png',
          width: MINI_W * 2,
          height: MINI_H * 2,
          scale: 2,
        })
          .then((url) => {
            if (gen === thumbGenRef.current) setPlotSnapshot(url)
          })
          .catch(() => {
            if (gen === thumbGenRef.current) setPlotSnapshot(null)
          })
      }, 120)
    },
    [],
  )

  if (!uploadedData?.rows?.length || !lensOutput) return null

  const timestamp = new Date().toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const snapshotBg = () =>
    getComputedStyle(document.documentElement).getPropertyValue('--ui-export-canvas-bg').trim() ||
    '#0a0a0a'

  const exportPNG = async () => {
    const el = badgeRef.current
    if (!el || busy) return
    setBusy(true)
    try {
      const canvas = await html2canvas(el, {
        backgroundColor: snapshotBg(),
        scale: 2,
        logging: false,
      })
      const link = document.createElement('a')
      link.download = `${baseName}-badge.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } finally {
      setBusy(false)
    }
  }

  /** SVG wraps a PNG snapshot so WebGL Plotly reliably appears in exported SVG */
  const exportSVG = async () => {
    const el = badgeRef.current
    if (!el || busy) return
    setBusy(true)
    try {
      const canvas = await html2canvas(el, {
        backgroundColor: snapshotBg(),
        scale: 2,
        logging: false,
      })
      const pngData = canvas.toDataURL('image/png')
      const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="400" height="220" viewBox="0 0 400 220">
  <image width="400" height="220" xlink:href="${pngData}" href="${pngData}" />
</svg>`
      const blob = new Blob([svgContent], { type: 'image/svg+xml' })
      const link = document.createElement('a')
      link.download = `${baseName}-badge.svg`
      link.href = URL.createObjectURL(blob)
      link.click()
      URL.revokeObjectURL(link.href)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div
        ref={badgeRef}
        style={{
          width: '400px',
          height: '220px',
          background: 'var(--ui-badge-surface)',
          border: '1px solid var(--ui-panel-border)',
          borderRadius: '16px',
          padding: '20px',
          display: 'flex',
          gap: '16px',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: "'DM Mono', ui-monospace, monospace",
          boxShadow: 'var(--ui-panel-shadow)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'var(--ui-badge-grid)',
            backgroundSize: '20px 20px',
            borderRadius: '16px',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            width: `${MINI_W}px`,
            height: `${MINI_H}px`,
            flexShrink: 0,
            background: 'var(--ui-badge-thumb-bg)',
            borderRadius: '10px',
            border: '1px solid var(--ui-badge-thumb-border)',
            overflow: 'hidden',
            boxShadow: 'var(--ui-panel-shadow)',
            position: 'relative',
          }}
        >
          {!plotSnapshot ? (
            <Plot
              key={plotKey}
              data={[trace]}
              layout={miniLayout}
              config={{ displayModeBar: false, staticPlot: true }}
              style={{ width: '100%', height: '100%' }}
              onInitialized={(_fig, gd) => schedulePlotSnapshot(gd)}
              onUpdate={(_fig, gd) => schedulePlotSnapshot(gd)}
            />
          ) : (
            <img
              src={plotSnapshot}
              alt=""
              width={MINI_W}
              height={MINI_H}
              style={{
                display: 'block',
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          )}
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            zIndex: 1,
            minWidth: 0,
          }}
        >
          <div>
            <div
              style={{
                fontSize: '9px',
                color: 'var(--ui-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                marginBottom: '4px',
              }}
            >
              DATASET
            </div>
            <div
              style={{
                fontSize: '13px',
                color: 'var(--ui-badge-filename)',
                fontWeight: 600,
                lineHeight: '1.2',
                marginBottom: '12px',
                wordBreak: 'break-word',
              }}
            >
              {displayName}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              marginBottom: '12px',
            }}
          >
            {stats.map((stat, i) => (
              <div key={i}>
                <div
                  style={{
                    fontSize: '8px',
                    color: 'var(--ui-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}
                >
                  {stat.label}
                </div>
                <div
                  style={{
                    fontSize: '14px',
                    color: 'var(--ui-accent)',
                    fontWeight: 700,
                  }}
                >
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              gap: 8,
            }}
          >
            <div
              style={{
                fontSize: '9px',
                color: 'var(--ui-accent)',
                background: 'var(--ui-accent-dim)',
                border: '1px solid var(--ui-accent-border-soft)',
                borderRadius: '4px',
                padding: '2px 6px',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}
            >
              {chartType ?? '—'}
            </div>
            <div
              style={{
                fontSize: '8px',
                color: 'var(--ui-badge-timestamp)',
                textAlign: 'right',
              }}
            >
              {timestamp}
            </div>
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            right: '14px',
            fontSize: '8px',
            color: 'var(--ui-badge-watermark)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}
        >
          SPATIAL VIZ
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <button
          type="button"
          disabled={busy}
          onClick={() => void exportPNG()}
          style={exportBtnStyle}
        >
          {busy ? '…' : 'EXPORT PNG'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void exportSVG()}
          style={{
            ...exportBtnStyle,
            borderColor: 'rgba(168,28,28,0.4)',
            color: '#A81C1C',
          }}
        >
          EXPORT SVG
        </button>
      </div>
      <p
        style={{
          margin: '8px 0 0',
          fontSize: 9,
          color: 'var(--ui-text-subtle)',
          lineHeight: 1.4,
        }}
      >
        The chart square is a Plotly snapshot (PNG) so WebGL shows up in the
        card and in PNG/SVG exports (html2canvas cannot paint WebGL canvases)
      </p>
    </div>
  )
}
