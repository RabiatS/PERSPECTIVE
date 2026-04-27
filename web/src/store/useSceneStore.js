import { create } from 'zustand'
import {
  computeDataBoundingRadius,
  computeDataCentroid,
  computeSampleSeed,
  sampleRowsForChart,
} from '../utils/chartUtils.js'

/**
 * @typedef {'scatter3d' | 'surface' | 'mesh3d' | 'bar3d' | 'globe' | 'graph3d' | null} ChartType
 */

const DEFAULT_CAMERA = /** @type {const} */ ([8, 6, 8])
const DEFAULT_ORBIT_TARGET = /** @type {const} */ ([0, 0, 0])

function newDatasetTabId() {
  return `ds-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

/** @param {object} state */
function snapshotFromState(state) {
  return {
    uploadedData: state.uploadedData,
    datasetMeta: state.datasetMeta,
    uploadSessionId: state.uploadSessionId,
    lensSessionId: state.lensSessionId,
    lensOutput: state.lensOutput,
    lensWarnings: state.lensWarnings,
    lensStatus: state.lensStatus,
    lensError: state.lensError,
    scoutPins: state.scoutPins,
    scoutStatus: state.scoutStatus,
    scoutError: state.scoutError,
    renderGeneration: state.renderGeneration,
    selectedRowIndices: state.selectedRowIndices,
    subScenes: state.subScenes,
    activeChartType: state.activeChartType,
    axisMapping: state.axisMapping,
    is2DMode: state.is2DMode,
    cameraPosition: state.cameraPosition,
    orbitTarget: state.orbitTarget,
    chartSpaceOrigin: state.chartSpaceOrigin,
    plotlyViewPresetId: state.plotlyViewPresetId,
    plotlyViewRevision: state.plotlyViewRevision,
    xrImmersiveActive: state.xrImmersiveActive,
  }
}

/** @param {object} state */
function freshDatasetFields(state, data, meta) {
  return {
    uploadedData: data,
    datasetMeta: meta ?? state.datasetMeta,
    uploadSessionId: state.uploadSessionId + 1,
    lensOutput: null,
    lensWarnings: [],
    lensStatus: 'idle',
    lensError: null,
    activeChartType: null,
    axisMapping: null,
    is2DMode: false,
    scoutPins: [],
    scoutStatus: 'idle',
    scoutError: null,
    renderGeneration: 0,
    selectedRowIndices: [],
    subScenes: [],
    cameraPosition: /** @type {[number, number, number]} */ ([...DEFAULT_CAMERA]),
    orbitTarget: /** @type {[number, number, number]} */ ([...DEFAULT_ORBIT_TARGET]),
    chartSpaceOrigin: /** @type {[number, number, number]} */ ([0, 0, 0]),
    plotlyViewPresetId: /** @type {string | null} */ (null),
    plotlyViewRevision: 0,
    xrImmersiveActive: false,
  }
}

/** @param {() => object} get */
function applyOrbitFromSnapshot(get) {
  const controls = get()._orbitControls
  if (!controls) return
  const { cameraPosition, orbitTarget } = get()
  const [x, y, z] = cameraPosition
  const [tx, ty, tz] = orbitTarget
  controls.object.position.set(x, y, z)
  controls.target.set(tx, ty, tz)
  controls.update()
}

export const useSceneStore = create((set, get) => ({
  uploadedData: null,
  datasetMeta: null,
  uploadSessionId: 0,
  /** Bumps when a new LENS result is stored; use as React key for axis pickers */
  lensSessionId: 0,
  lensOutput: null,
  /** Non-fatal LENS validation / fallback messages */
  lensWarnings: /** @type {string[]} */ ([]),
  lensStatus: /** @type {'idle' | 'loading' | 'ready' | 'error'} */ ('idle'),
  /** @type {string | null} */
  lensError: null,
  /** @type {import('./pinTypes.js').ScoutPin[]} */
  scoutPins: [],
  scoutStatus: /** @type {'idle' | 'loading' | 'ready' | 'error'} */ ('idle'),
  /** @type {string | null} */
  scoutError: null,
  /** Increments when user clicks Render; SCOUT and shareable state key off this */
  renderGeneration: 0,
  /** Row indices from Plotly selection (full uploaded row indices after sampling remap — see ChartRenderer) */
  selectedRowIndices: [],
  /** @type {import('./pinTypes.js').SubScene[]} */
  subScenes: [],
  cameraPosition: /** @type {[number, number, number]} */ ([...DEFAULT_CAMERA]),
  /** OrbitControls target (pan); kept in sync for tab restore */
  orbitTarget: /** @type {[number, number, number]} */ ([...DEFAULT_ORBIT_TARGET]),
  activeChartType: null,
  /** @type {{ x: string; y: string; z: string } | null} */
  axisMapping: null,
  /** When true, chart renders as 2D Plotly beside the scene; when false, 3D chart in Html overlay */
  is2DMode: false,

  /**
   * Centroid of the current chart sample in raw column space; subtracted from traces/pins so
   * the plot sits at world (0,0,0) with the axis gizmo.
   * @type {[number, number, number]}
   */
  chartSpaceOrigin: [0, 0, 0],

  /**
   * When set, Plotly 3D layout.scene.camera matches CameraPresets (orbit only moved world before).
   * @type {string | null}
   */
  plotlyViewPresetId: null,
  /** Bumps when plotly camera preset changes so Plotly applies layout.scene.camera */
  plotlyViewRevision: 0,

  /** True while WebXR immersive session is active (orbit disabled so XR camera owns view) */
  xrImmersiveActive: false,
  setXrImmersiveActive: (xrImmersiveActive) => set({ xrImmersiveActive }),

  /** Inactive tabs store a frozen workspace; the active tab has snapshot: null */
  datasetTabs: /** @type {{ id: string; name: string; snapshot: object | null }[]} */ ([]),
  /** @type {string | null} */
  activeTabId: null,

  _orbitControls: null,
  setOrbitControls: (controls) => set({ _orbitControls: controls }),

  /** @type {import('three').WebGLRenderer | null} */
  _gl: null,
  /** @param {import('three').WebGLRenderer | null} gl */
  setGl: (gl) => set({ _gl: gl }),

  /** @param {[number, number, number]} cameraPosition */
  setCameraPosition: (cameraPosition) => set({ cameraPosition }),

  /** @param {[number, number, number]} orbitTarget */
  setOrbitTarget: (orbitTarget) => set({ orbitTarget }),

  /** @param {string | null} plotlyViewPresetId */
  setPlotlyViewPreset: (plotlyViewPresetId) =>
    set((s) => ({
      plotlyViewPresetId,
      plotlyViewRevision: s.plotlyViewRevision + 1,
    })),

  /**
   * @param {{
   *   rows: Record<string, unknown>[];
   *   columns: string[];
   *   rowCount: number;
   *   nullCounts: Record<string, number>;
   *   detectedTypes: Record<string, 'numeric' | 'categorical' | 'datetime'>;
   *   graphLinks?: [number, number][];
   * }} data
   * @param {{ name: string }} [meta]
   * @param {{ newTab?: boolean }} [opts] — `newTab: true` keeps the current dataset in a tab and opens a new one
   */
  setParsedDataset: (data, meta, opts) => {
    const newTab = opts?.newTab ?? false
    const state = get()
    const fresh = freshDatasetFields(state, data, meta)

    if (newTab && state.uploadedData) {
      const snap = snapshotFromState(state)
      const idx = state.datasetTabs.findIndex((t) => t.id === state.activeTabId)
      const nextTabs =
        idx >= 0
          ? state.datasetTabs.map((t, i) =>
              i === idx ? { ...t, snapshot: snap } : t,
            )
          : state.datasetTabs
      const id = newDatasetTabId()
      const name = meta?.name ?? 'Dataset'
      set({
        ...fresh,
        datasetTabs: [...nextTabs, { id, name, snapshot: null }],
        activeTabId: id,
      })
      queueMicrotask(() => applyOrbitFromSnapshot(get))
      return
    }

    if (!state.datasetTabs.length) {
      const id = newDatasetTabId()
      const name = meta?.name ?? 'Dataset'
      set({
        ...fresh,
        datasetTabs: [{ id, name, snapshot: null }],
        activeTabId: id,
      })
      queueMicrotask(() => applyOrbitFromSnapshot(get))
      return
    }

    const idx = state.datasetTabs.findIndex((t) => t.id === state.activeTabId)
    const tabName = meta?.name ?? state.datasetMeta?.name ?? 'Dataset'
    const nextTabs =
      idx >= 0
        ? state.datasetTabs.map((t, i) =>
            i === idx ? { ...t, name: tabName, snapshot: null } : t,
          )
        : state.datasetTabs
    set({
      ...fresh,
      datasetTabs: nextTabs,
      activeTabId: state.activeTabId,
    })
    queueMicrotask(() => applyOrbitFromSnapshot(get))
  },

  /** @param {string} id */
  switchDatasetTab: (id) => {
    const state = get()
    if (id === state.activeTabId) return
    const fromIdx = state.datasetTabs.findIndex((t) => t.id === state.activeTabId)
    const toIdx = state.datasetTabs.findIndex((t) => t.id === id)
    if (toIdx < 0) return
    const raw = state.datasetTabs[toIdx].snapshot
    if (!raw) return

    const toSnap = {
      ...raw,
      orbitTarget: Array.isArray(raw.orbitTarget)
        ? raw.orbitTarget
        : [...DEFAULT_ORBIT_TARGET],
      cameraPosition: Array.isArray(raw.cameraPosition)
        ? raw.cameraPosition
        : [...DEFAULT_CAMERA],
      chartSpaceOrigin: Array.isArray(raw.chartSpaceOrigin)
        ? raw.chartSpaceOrigin
        : /** @type {[number, number, number]} */ ([0, 0, 0]),
      plotlyViewPresetId:
        typeof raw.plotlyViewPresetId === 'string'
          ? raw.plotlyViewPresetId
          : null,
      plotlyViewRevision:
        typeof raw.plotlyViewRevision === 'number'
          ? raw.plotlyViewRevision
          : 0,
    }

    const snapFrom = snapshotFromState(state)
    const nextTabs = state.datasetTabs.map((t, i) => {
      if (i === fromIdx) return { ...t, snapshot: snapFrom }
      if (i === toIdx) return { ...t, snapshot: null }
      return t
    })
    set({
      ...toSnap,
      xrImmersiveActive: false,
      datasetTabs: nextTabs,
      activeTabId: id,
    })
    queueMicrotask(() => applyOrbitFromSnapshot(get))
  },

  /** @param {string} id */
  removeDatasetTab: (id) => {
    const state = get()
    if (state.datasetTabs.length <= 1) return
    const other = state.datasetTabs.find((t) => t.id !== id)
    if (!other) return
    if (state.activeTabId === id) {
      get().switchDatasetTab(other.id)
      set((s) => ({
        datasetTabs: s.datasetTabs.filter((t) => t.id !== id),
      }))
    } else {
      set({ datasetTabs: state.datasetTabs.filter((t) => t.id !== id) })
    }
  },

  setDatasetMeta: (datasetMeta) => set({ datasetMeta }),

  setLensStatus: (lensStatus) => set({ lensStatus }),

  setLensError: (lensError) => set({ lensError }),

  /**
   * @param {Record<string, unknown>} lensOutput
   * @param {string[]} [warnings]
   */
  setLensOutput: (lensOutput, warnings = []) =>
    set((state) => ({
      lensOutput,
      lensWarnings: warnings,
      lensStatus: 'ready',
      lensError: null,
      lensSessionId: state.lensSessionId + 1,
    })),

  /** @param {ChartType} activeChartType */
  setActiveChartType: (activeChartType) => set({ activeChartType }),

  /** @param {{ x: string; y: string; z: string }} axisMapping */
  setAxisMapping: (axisMapping) => set({ axisMapping }),

  /**
   * Move orbit target and camera to face the current chart data (same sample as Plotly).
   */
  frameChartInView: () => {
    const state = get()
    const data = state.uploadedData
    const axis = state.axisMapping
    if (!data?.rows?.length || !axis) return
    if (state.activeChartType === 'globe') return

    const sampleSeed = computeSampleSeed(
      state.uploadSessionId,
      data.rows.length,
      axis,
    )
    const chartType = state.activeChartType
    const { rows } = sampleRowsForChart(data.rows, sampleSeed, {
      chartType,
    })
    const types = data.detectedTypes
    const centroid = computeDataCentroid(rows, axis, types)
    const rmax = computeDataBoundingRadius(rows, axis, centroid, types)
    const dist = Math.min(100, Math.max(4, rmax * 2.75 + 3.5))
    const len = Math.hypot(8, 6, 8)
    const camPos = /** @type {[number, number, number]} */ ([
      (8 / len) * dist,
      (6 / len) * dist,
      (8 / len) * dist,
    ])
    const target = /** @type {[number, number, number]} */ ([0, 0, 0])

    const controls = state._orbitControls
    if (controls) {
      controls.target.set(0, 0, 0)
      controls.object.position.set(camPos[0], camPos[1], camPos[2])
      controls.update()
    }
    set({
      cameraPosition: camPos,
      orbitTarget: target,
    })
  },

  /**
   * @param {ChartType} activeChartType
   * @param {{ x: string; y: string; z: string }} axisMapping
   */
  applyChartRender: (activeChartType, axisMapping) => {
    const s0 = get()
    /** @type {[number, number, number]} */
    let chartSpaceOrigin = [0, 0, 0]
    const data = s0.uploadedData
    if (
      data?.rows?.length &&
      activeChartType &&
      activeChartType !== 'globe'
    ) {
      const seed = computeSampleSeed(
        s0.uploadSessionId,
        data.rows.length,
        axisMapping,
      )
      const { rows } = sampleRowsForChart(data.rows, seed, {
        chartType: activeChartType,
      })
      chartSpaceOrigin = computeDataCentroid(
        rows,
        axisMapping,
        data.detectedTypes,
      )
    }

    set((s) => ({
      activeChartType,
      axisMapping,
      chartSpaceOrigin,
      plotlyViewPresetId: null,
      plotlyViewRevision: s.plotlyViewRevision + 1,
      renderGeneration: s.renderGeneration + 1,
      scoutPins: [],
      scoutStatus: 'idle',
      scoutError: null,
    }))
    queueMicrotask(() => {
      if (activeChartType !== 'globe') {
        get().frameChartInView()
      }
    })
  },

  /** @param {import('./pinTypes.js').ScoutPin[]} scoutPins */
  setScoutPins: (scoutPins) =>
    set({ scoutPins, scoutStatus: 'ready', scoutError: null }),

  setScoutStatus: (scoutStatus) => set({ scoutStatus }),

  setScoutError: (scoutError) =>
    set({ scoutError, scoutStatus: 'error' }),

  /**
   * @param {number[] | ((prev: number[]) => number[])} selectedRowIndicesOrUpdater
   */
  setSelectedRowIndices: (selectedRowIndicesOrUpdater) =>
    set((s) => {
      const next =
        typeof selectedRowIndicesOrUpdater === 'function'
          ? selectedRowIndicesOrUpdater(s.selectedRowIndices)
          : selectedRowIndicesOrUpdater
      return { selectedRowIndices: next }
    }),

  /** @param {import('./pinTypes.js').SubScene} sub */
  addSubScene: (sub) =>
    set((s) => ({ subScenes: [...s.subScenes, sub] })),

  removeSubScene: (id) =>
    set((s) => ({
      subScenes: s.subScenes.filter((x) => x.id !== id),
    })),

  /** @param {string} id
   *  @param {string} label */
  renameSubScene: (id, label) =>
    set((s) => ({
      subScenes: s.subScenes.map((x) =>
        x.id === id ? { ...x, label } : x,
      ),
    })),

  toggleSubSceneCollapsed: (id) =>
    set((s) => ({
      subScenes: s.subScenes.map((x) =>
        x.id === id ? { ...x, collapsed: !x.collapsed } : x,
      ),
    })),

  /** Move orbit to face a sub-scene chart (offset in world space). */
  focusSubScene: (id) => {
    const state = get()
    const sub = state.subScenes.find((x) => x.id === id)
    if (!sub) return
    const [tx, ty, tz] = sub.offset
    const controls = state._orbitControls
    if (!controls) return
    const camX = tx + 7
    const camY = ty + 5
    const camZ = tz + 7
    controls.target.set(tx, ty, tz)
    controls.object.position.set(camX, camY, camZ)
    controls.update()
    set({
      cameraPosition: [camX, camY, camZ],
      orbitTarget: [tx, ty, tz],
    })
  },

  /** @param {boolean} is2DMode */
  setIs2DMode: (is2DMode) => set({ is2DMode }),

  snapToDefaultView: () => {
    const controls = get()._orbitControls
    if (!controls) return
    const cam = controls.object
    cam.position.set(8, 6, 8)
    controls.target.set(0, 0, 0)
    controls.update()
    set((s) => ({
      cameraPosition: [8, 6, 8],
      orbitTarget: [0, 0, 0],
      selectedRowIndices: [],
      plotlyViewPresetId: null,
      plotlyViewRevision: s.plotlyViewRevision + 1,
    }))
  },
}))
