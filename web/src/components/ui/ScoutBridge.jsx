import { useEffect, useMemo } from 'react'
import { useSceneStore } from '../../store/useSceneStore.js'
import { runScoutPipeline } from '../../ai/agents/scout.js'
import {
  computeSampleSeed,
  sampleRowsForChart,
} from '../../utils/chartUtils.js'
import { isScoutPipelineEnabled } from '../../ai/aiPolicy.js'

export function ScoutBridge() {
  const uploadSessionId = useSceneStore((s) => s.uploadSessionId)
  const renderGeneration = useSceneStore((s) => s.renderGeneration)
  const activeChartType = useSceneStore((s) => s.activeChartType)
  const axisMapping = useSceneStore((s) => s.axisMapping)
  const chartSpaceOrigin = useSceneStore((s) => s.chartSpaceOrigin)
  const setScoutPins = useSceneStore((s) => s.setScoutPins)
  const setScoutStatus = useSceneStore((s) => s.setScoutStatus)
  const setScoutError = useSceneStore((s) => s.setScoutError)

  const axisKey = useMemo(
    () =>
      axisMapping
        ? `${axisMapping.x}\0${axisMapping.y}\0${axisMapping.z}`
        : '',
    [axisMapping],
  )

  useEffect(() => {
    if (!isScoutPipelineEnabled()) {
      setScoutPins([])
      return
    }

    const data = useSceneStore.getState().uploadedData
    if (
      !data?.rows?.length ||
      !activeChartType ||
      !axisMapping ||
      activeChartType === 'globe'
    ) {
      setScoutPins([])
      return
    }

    let cancelled = false
    setScoutStatus('loading')

    const sampleSeed = computeSampleSeed(
      uploadSessionId,
      data.rows.length,
      axisMapping,
    )
    const { rows, rowIndices } = sampleRowsForChart(data.rows, sampleSeed, {
      chartType: activeChartType,
    })

    runScoutPipeline({
      rows,
      rowIndices,
      columns: data.columns,
      detectedTypes: data.detectedTypes,
      axisMapping,
      chartSpaceOrigin,
    })
      .then((pins) => {
        if (!cancelled) setScoutPins(pins)
      })
      .catch((err) => {
        if (!cancelled) {
          setScoutError(err instanceof Error ? err.message : String(err))
        }
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- axisKey tracks axisMapping
  }, [
    uploadSessionId,
    renderGeneration,
    activeChartType,
    axisKey,
    chartSpaceOrigin,
    setScoutPins,
    setScoutStatus,
    setScoutError,
  ])

  return null
}
