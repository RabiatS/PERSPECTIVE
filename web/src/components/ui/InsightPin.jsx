/* eslint-disable react/prop-types -- props documented via JSDoc */
import { Billboard, Html } from '@react-three/drei'
import { useState } from 'react'

/**
 * @param {{ pin: import('../../store/pinTypes.js').ScoutPin }} props
 */
export function InsightPin({ pin }) {
  const [expanded, setExpanded] = useState(false)
  const accent = pin.kind === 'correlation' ? '#A81C1C' : '#FF6B35'
  const border = `1px solid ${accent}55`

  return (
    <Billboard follow position={pin.position}>
      <Html
        center
        style={{ pointerEvents: 'auto', width: expanded ? 260 : 160 }}
        zIndexRange={[100, 0]}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={() => setExpanded(!expanded)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setExpanded(!expanded)
            }
          }}
          style={{
            background: 'var(--ui-pin-bg)',
            border,
            borderRadius: 10,
            padding: expanded ? '12px 14px' : '8px 10px',
            boxShadow: `0 8px 28px rgba(0,0,0,0.5), 0 0 12px ${accent}22`,
            fontFamily: "'DM Mono', ui-monospace, monospace",
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              fontSize: 9,
              letterSpacing: '0.08em',
              color: accent,
              marginBottom: 4,
              textTransform: 'uppercase',
            }}
          >
            {pin.kind === 'correlation' ? 'CORRELATION' : 'SCOUT'}
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--ui-pin-text)',
              lineHeight: 1.35,
              fontWeight: 600,
            }}
          >
            {pin.headline}
          </div>
          {expanded && (
            <div
              style={{
                marginTop: 10,
                fontSize: 10,
                color: '#8A8A9A',
                lineHeight: 1.45,
              }}
            >
              <p style={{ margin: '0 0 8px' }}>{pin.explanation}</p>
              <div style={{ color: 'var(--ui-text-subtle)', marginBottom: 4 }}>Columns</div>
              <div style={{ color: accent }}>{pin.columns_involved.join(', ')}</div>
              <div style={{ marginTop: 8, color: 'var(--ui-text-subtle)' }}>Suggested</div>
              <div style={{ color: 'var(--ui-text-body)' }}>{pin.suggested_action}</div>
              <div style={{ marginTop: 8, fontSize: 9, color: 'var(--ui-text-faint)' }}>
                confidence {(pin.confidence * 100).toFixed(0)}% · score{' '}
                {pin.anomaly_score.toFixed(2)}
              </div>
            </div>
          )}
        </div>
      </Html>
    </Billboard>
  )
}
