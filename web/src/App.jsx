import { useEffect, useRef } from 'react'
import { useSceneStore } from './store/useSceneStore.js'
import { importDatasetFile } from './utils/importDatasetFile.js'
import { SceneCanvas } from './components/scene/SceneCanvas.jsx'
import { DatasetTabs } from './components/ui/DatasetTabs.jsx'
import { UploadZone } from './components/ui/UploadZone.jsx'
import { LensBridge } from './components/ui/LensBridge.jsx'
import { LensPanel } from './components/ui/LensPanel.jsx'
import { Chart2DPanel, Chart3DPanel } from './components/charts/ChartRenderer.jsx'
import { ScoutBridge } from './components/ui/ScoutBridge.jsx'
import { CuratorBar } from './components/ui/CuratorBar.jsx'
import { SubSceneManager } from './components/ui/SubSceneManager.jsx'
import { ShareableUrlBanner } from './components/ui/ShareableUrlBanner.jsx'
import { CameraPresets } from './components/ui/CameraPresets.jsx'
import { XrEntry } from './components/ui/XrEntry.jsx'
import { ThemeToggle } from './components/ui/ThemeToggle.jsx'
import { SceneNavigateHint } from './components/ui/SceneNavigateHint.jsx'
import { ScoutHud } from './components/ui/ScoutHud.jsx'
import {
  SAMPLE_SPATIAL_DATASET_NAME,
  SAMPLE_SPATIAL_DATASET_URL,
} from './config/sampleDataset.js'

const SIDEBAR_WIDTH = 300

export default function App() {
  const hasData = Boolean(useSceneStore((s) => s.uploadedData))
  const canShare = Boolean(useSceneStore((s) => s.activeChartType))
  const demoLoadedRef = useRef(false)
  const setParsedDataset = useSceneStore((s) => s.setParsedDataset)

  // Auto-load sample data when ?demo=1 is in the URL
  useEffect(() => {
    if (demoLoadedRef.current) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('demo') !== '1') return
    demoLoadedRef.current = true
    void (async () => {
      try {
        const resp = await fetch(SAMPLE_SPATIAL_DATASET_URL)
        if (!resp.ok) return
        const blob = await resp.blob()
        const file = new File([blob], SAMPLE_SPATIAL_DATASET_NAME, { type: 'text/csv' })
        const parsed = await importDatasetFile(file)
        setParsedDataset(parsed, { name: SAMPLE_SPATIAL_DATASET_NAME })
      } catch {
        // silently skip if sample unavailable
      }
    })()
  }, [setParsedDataset])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--app-shell-bg)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ── Top chrome bar ─────────────────────────────────────────────── */}
      <DatasetTabs />

      {/* ── Main area: viewport + inspector ────────────────────────────── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'row',
          overflow: 'hidden',
        }}
      >
        {/* ── Center viewport ─────────────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Three.js canvas — always rendered in background */}
          <SceneCanvas />

          {/* Plotly overlays — mutually exclusive */}
          <Chart3DPanel />
          <Chart2DPanel />

          {/* Empty-state drop zone — covers viewport when no data */}
          <UploadZone />

          {/* Contextual hints (left side, top of viewport) */}
          <SceneNavigateHint />

          {/* Camera preset buttons — centered at bottom of viewport */}
          <CameraPresets />

          {/* Selection curator — bottom-left of viewport */}
          <CuratorBar />

          {/* WebXR entry — right side of viewport */}
          <XrEntry />

          {/* Sub-scene thumbnails */}
          <SubSceneManager />

          {/* SCOUT anomaly insights panel — top-right */}
          <ScoutHud />
        </div>

        {/* ── Right inspector sidebar ──────────────────────────────────── */}
        {hasData && (
          <div
            style={{
              width: SIDEBAR_WIDTH,
              minWidth: SIDEBAR_WIDTH,
              maxWidth: SIDEBAR_WIDTH,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--ui-panel-bg)',
              borderLeft: '1px solid var(--ui-panel-border)',
              overflow: 'hidden',
            }}
          >
            {/* Sidebar header */}
            <div
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px 8px',
                borderBottom: '1px solid var(--ui-accent-border-soft)',
                gap: 8,
              }}
            >
              <span
                style={{
                  fontFamily: "'Bebas Neue', system-ui, sans-serif",
                  fontSize: 11,
                  letterSpacing: '0.16em',
                  color: 'var(--ui-accent)',
                }}
              >
                INSPECTOR
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {canShare && <ShareableUrlBanner />}
                <ThemeToggle variant="chrome" />
              </div>
            </div>

            {/* LENS panel content fills the rest */}
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <LensPanel sidebar />
            </div>
          </div>
        )}
      </div>

      {/* Invisible effect bridges */}
      <LensBridge />
      <ScoutBridge />
    </div>
  )
}
