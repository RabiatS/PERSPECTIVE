import { useEffect } from 'react'
import { useSceneStore } from '../../store/useSceneStore.js'
import { runLens } from '../../ai/agents/lens.js'

export function LensBridge() {
  const uploadSessionId = useSceneStore((s) => s.uploadSessionId)
  const setLensOutput = useSceneStore((s) => s.setLensOutput)
  const setLensStatus = useSceneStore((s) => s.setLensStatus)
  const setLensError = useSceneStore((s) => s.setLensError)

  useEffect(() => {
    const data = useSceneStore.getState().uploadedData
    if (!data) return

    let cancelled = false
    setLensStatus('loading')
    setLensError(null)

    runLens({
      columns: data.columns,
      rowCount: data.rowCount,
      nullCounts: data.nullCounts,
      sample: data.rows.slice(0, 3),
      detectedTypes: data.detectedTypes,
      graphLinkCount: data.graphLinks?.length ?? 0,
    })
      .then(({ output, warnings }) => {
        if (!cancelled) setLensOutput(output, warnings)
      })
      .catch((err) => {
        if (!cancelled) {
          setLensError(err instanceof Error ? err.message : String(err))
          setLensStatus('error')
        }
      })

    return () => {
      cancelled = true
    }
  }, [uploadSessionId, setLensOutput, setLensStatus, setLensError])

  return null
}
