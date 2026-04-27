/* eslint-disable react/prop-types -- props documented via JSDoc */
import { Html } from '@react-three/drei'
import Plot from 'react-plotly.js'
import { useMemo } from 'react'
import { useThemeStore } from '../../store/useThemeStore.js'
import {
  buildLayout,
  buildTrace,
  rowsToXYZArrays,
} from '../../utils/chartUtils.js'

/**
 * @param {{ sub: import('../../store/pinTypes.js').SubScene }} props
 */
export function SubSceneChartNode({ sub }) {
  const colorTheme = useThemeStore((s) => s.theme)
  const { trace3d, layout3d } = useMemo(() => {
    const { x, y, z } = rowsToXYZArrays(
      sub.rows,
      sub.axisMapping,
      sub.detectedTypes,
    )
    return {
      trace3d: buildTrace(sub.chartType, { x, y, z }),
      layout3d: buildLayout(sub.axisMapping, undefined, colorTheme),
    }
  }, [sub, colorTheme])

  if (sub.collapsed) {
    return (
      <Html position={sub.offset} transform={false}>
        <div
          style={{
            fontFamily: "'DM Mono', ui-monospace, monospace",
            fontSize: 10,
            color: '#A81C1C',
            padding: '6px 10px',
            background: 'var(--ui-panel-bg)',
            border: '1px solid rgba(168,28,28,0.4)',
            borderRadius: 8,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {sub.label} (collapsed)
        </div>
      </Html>
    )
  }

  return (
    <Html position={sub.offset} transform={false}>
      <div
        style={{
          position: 'relative',
          width: 360,
          height: 360,
          pointerEvents: 'auto',
        }}
      >
        <Plot
          data={[trace3d]}
          layout={layout3d}
          config={{ displayModeBar: false }}
        />
      </div>
    </Html>
  )
}
