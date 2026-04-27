import { useCallback, useRef, useState } from 'react'
import { importDatasetFile } from '../../utils/importDatasetFile.js'
import { useSceneStore } from '../../store/useSceneStore.js'

const SAMPLE_FILE = '/sample-spatial-dataset.csv'
const SAMPLE_NAME = 'sample-spatial-dataset.csv'

export function UploadZone() {
  const inputRef = useRef(null)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState(null)
  const [hover, setHover] = useState(false)

  const uploadedData = useSceneStore((s) => s.uploadedData)
  const setParsedDataset = useSceneStore((s) => s.setParsedDataset)

  const hidden = Boolean(uploadedData)

  const processFile = useCallback(
    async (file) => {
      setError(null)
      setParsing(true)
      try {
        const parsed = await importDatasetFile(file)
        setParsedDataset(parsed, { name: file.name })
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setParsing(false)
      }
    },
    [setParsedDataset],
  )

  const loadSample = useCallback(async () => {
    setError(null)
    setParsing(true)
    try {
      const resp = await fetch(SAMPLE_FILE)
      if (!resp.ok) throw new Error(`Sample fetch failed: ${resp.status}`)
      const blob = await resp.blob()
      const file = new File([blob], SAMPLE_NAME, { type: 'text/csv' })
      await processFile(file)
    } catch (e) {
      setParsing(false)
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [processFile])

  const onDrop = useCallback(
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      setHover(false)
      const f = e.dataTransfer?.files?.[0]
      if (f) void processFile(f)
    },
    [processFile],
  )

  const onDragOver = useCallback((e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const onPick = useCallback(
    (e) => {
      const f = e.target.files?.[0]
      if (f) void processFile(f)
      e.target.value = ''
    },
    [processFile],
  )

  if (hidden) return null

  const border = hover
    ? '1px dashed var(--ui-upload-dash-hover)'
    : '1px dashed var(--ui-upload-dash)'
  const bg = hover ? 'var(--ui-upload-bg-hover)' : 'var(--ui-upload-bg)'

  return (
    <div
      role="presentation"
      onDragEnter={() => setHover(true)}
      onDragLeave={() => setHover(false)}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border,
        background: bg,
        backdropFilter: 'blur(8px)',
        transition: 'border-color 0.15s ease, background 0.15s ease',
        cursor: parsing ? 'wait' : 'pointer',
      }}
      onClick={() => {
        if (!parsing) inputRef.current?.click()
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.json,.geojson,.wav,.mp3"
        style={{ display: 'none' }}
        onChange={onPick}
      />

      {parsing ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              border: '2px solid var(--ui-accent-border-soft)',
              borderTopColor: 'var(--ui-accent)',
              animation: 'upload-spin 0.8s linear infinite',
            }}
            aria-label="Parsing"
          />
          <div
            style={{
              fontFamily: "'DM Mono', ui-monospace, monospace",
              fontSize: 10,
              color: 'var(--ui-text-muted)',
              letterSpacing: '0.08em',
            }}
          >
            Loading dataset…
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
            pointerEvents: 'none',
          }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
          >
            <path
              d="M12 4v12m0 0l-4-4m4 4l4-4M5 20h14"
              stroke="var(--ui-accent)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.85}
            />
          </svg>
          <div
            style={{
              fontFamily: "'DM Mono', ui-monospace, monospace",
              fontSize: 12,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#8A8A9A',
            }}
          >
            DROP DATASET HERE
          </div>
          <div
            style={{
              fontFamily: "'DM Mono', ui-monospace, monospace",
              fontSize: 10,
              color: 'var(--ui-text-subtle)',
            }}
          >
            .csv · .json · .geojson · .wav · .mp3
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              pointerEvents: 'auto',
            }}
          >
            <div
              style={{
                fontFamily: "'DM Mono', ui-monospace, monospace",
                fontSize: 9,
                color: 'var(--ui-text-faint)',
                letterSpacing: '0.04em',
              }}
            >
              or
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                void loadSample()
              }}
              style={{
                padding: '8px 16px',
                fontFamily: "'DM Mono', ui-monospace, monospace",
                fontSize: 10,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--ui-accent)',
                background: 'var(--ui-accent-dim)',
                border: '1px solid var(--ui-accent-border)',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              Try sample data
            </button>
          </div>

          {error ? (
            <div
              style={{
                marginTop: 4,
                fontSize: 11,
                color: '#ff6b6b',
                maxWidth: 320,
                textAlign: 'center',
                pointerEvents: 'none',
              }}
            >
              {error}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
