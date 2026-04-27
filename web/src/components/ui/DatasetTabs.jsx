import { useCallback, useRef, useState } from 'react'
import { useSceneStore } from '../../store/useSceneStore.js'
import { importDatasetFile } from '../../utils/importDatasetFile.js'
const barStyle = {
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  background: 'var(--chrome-bar-bg)',
  borderBottom: '1px solid var(--chrome-bar-border)',
  zIndex: 18,
  minHeight: 40,
  boxSizing: 'border-box',
}

const tabBtn = (active) => ({
  fontFamily: "'DM Mono', ui-monospace, monospace",
  fontSize: 11,
  letterSpacing: '0.06em',
  padding: '6px 10px',
  maxWidth: 180,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  border: active
    ? '1px solid var(--chrome-tab-border-active)'
    : '1px solid var(--chrome-tab-border)',
  background: active ? 'var(--chrome-tab-bg-active)' : 'var(--chrome-tab-bg)',
  color: active ? 'var(--chrome-tab-text-active)' : 'var(--chrome-tab-text)',
})

const actionBtn = {
  fontFamily: "'DM Mono', ui-monospace, monospace",
  fontSize: 10,
  letterSpacing: '0.08em',
  padding: '6px 10px',
  background: 'var(--chrome-action-bg)',
  border: '1px solid var(--chrome-action-border)',
  color: 'var(--chrome-action-text)',
  cursor: 'pointer',
}

export function DatasetTabs() {
  const inputRef = useRef(null)
  const addVsReplaceRef = useRef(/** @type {'add' | 'replace'} */ ('add'))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const uploadedData = useSceneStore((s) => s.uploadedData)
  const datasetTabs = useSceneStore((s) => s.datasetTabs)
  const activeTabId = useSceneStore((s) => s.activeTabId)
  const setParsedDataset = useSceneStore((s) => s.setParsedDataset)
  const switchDatasetTab = useSceneStore((s) => s.switchDatasetTab)
  const removeDatasetTab = useSceneStore((s) => s.removeDatasetTab)
  const snapToDefaultView = useSceneStore((s) => s.snapToDefaultView)

  const onAddFile = useCallback(
    async (file) => {
      setErr(null)
      setBusy(true)
      try {
        const parsed = await importDatasetFile(file)
        setParsedDataset(parsed, { name: file.name }, { newTab: true })
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    },
    [setParsedDataset],
  )

  const onReplaceFile = useCallback(
    async (file) => {
      setErr(null)
      setBusy(true)
      try {
        const parsed = await importDatasetFile(file)
        setParsedDataset(parsed, { name: file.name })
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    },
    [setParsedDataset],
  )

  const onPick = useCallback(
    (e) => {
      const f = e.target.files?.[0]
      if (f) {
        if (addVsReplaceRef.current === 'replace') void onReplaceFile(f)
        else void onAddFile(f)
      }
      e.target.value = ''
    },
    [onAddFile, onReplaceFile],
  )

  if (!uploadedData || !datasetTabs.length) return null

  return (
    <div style={barStyle}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flex: 1,
          minWidth: 0,
          overflowX: 'auto',
        }}
      >
        {datasetTabs.map((t) => {
          const active = t.id === activeTabId
          return (
            <div
              key={t.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                style={tabBtn(active)}
                title={t.name}
                onClick={() => switchDatasetTab(t.id)}
              >
                {t.name}
              </button>
              {datasetTabs.length > 1 ? (
                <button
                  type="button"
                  aria-label={`Close ${t.name}`}
                  onClick={() => removeDatasetTab(t.id)}
                  style={{
                    ...actionBtn,
                    padding: '4px 8px',
                    fontSize: 12,
                    lineHeight: 1,
                    color: 'var(--chrome-close-color)',
                    borderColor: 'var(--chrome-close-border)',
                  }}
                >
                  ×
                </button>
              ) : null}
            </div>
          )
        })}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,.json,.geojson,.wav,.mp3"
        style={{ display: 'none' }}
        onChange={onPick}
      />

      <button
        type="button"
        style={{
          ...actionBtn,
          opacity: busy ? 0.6 : 1,
          pointerEvents: busy ? 'none' : 'auto',
        }}
        onClick={() => {
          addVsReplaceRef.current = 'add'
          inputRef.current?.click()
        }}
      >
        + DATA
      </button>

      <button
        type="button"
        title="Replace the active tab’s file (same tab)"
        style={{
          ...actionBtn,
          opacity: busy ? 0.6 : 1,
          pointerEvents: busy ? 'none' : 'auto',
          borderColor: 'var(--chrome-secondary-border)',
          color: 'var(--chrome-muted-text)',
        }}
        onClick={() => {
          addVsReplaceRef.current = 'replace'
          inputRef.current?.click()
        }}
      >
        REPLACE
      </button>

      <button type="button" style={actionBtn} onClick={() => snapToDefaultView()}>
        RESET VIEW
      </button>

      {err ? (
        <span
          style={{
            fontSize: 10,
            color: '#ff6b6b',
            maxWidth: 200,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={err}
        >
          {err}
        </span>
      ) : null}
    </div>
  )
}
