/* eslint-disable react/prop-types */
import { useState } from 'react'
import { useSceneStore } from '../../store/useSceneStore.js'

const BLOOD = '#A81C1C'
const BLOOD_MUTED = '#B85C5C'
const BLOOD_DIM = 'rgba(168, 28, 28, 0.1)'
const BLOOD_BORDER = 'rgba(168, 28, 28, 0.35)'
const CORR_DIM = 'rgba(184, 92, 92, 0.1)'
const CORR_BORDER = 'rgba(184, 92, 92, 0.3)'

/** Compact diamond SVG marker matching the Plotly trace symbol */
function DiamondIcon({ color }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path d="M5 1L9 5L5 9L1 5Z" fill={color} />
    </svg>
  )
}

/** Chevron for expand / collapse */
function Chevron({ open }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
      style={{
        flexShrink: 0,
        transition: 'transform 0.18s ease',
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
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
  )
}

/**
 * Single expandable SCOUT/CORRELATION pin card.
 * @param {{ pin: import('../../store/pinTypes.js').ScoutPin }} props
 */
function PinCard({ pin }) {
  const [open, setOpen] = useState(false)
  const isCorr = pin.kind === 'correlation'
  const accent = isCorr ? BLOOD_MUTED : BLOOD
  const dimBg = isCorr ? CORR_DIM : BLOOD_DIM
  const borderClr = isCorr ? CORR_BORDER : BLOOD_BORDER

  return (
    <div
      style={{
        borderRadius: 10,
        border: `1px solid ${borderClr}`,
        background: 'var(--ui-panel-bg)',
        overflow: 'hidden',
        marginBottom: 6,
      }}
    >
      {/* ── Header row ─────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          width: '100%',
          padding: '8px 10px',
          background: open ? dimBg : 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background 0.15s ease',
        }}
      >
        <DiamondIcon color={accent} />

        {/* Kind badge */}
        <span
          style={{
            fontFamily: "'Bebas Neue', system-ui, sans-serif",
            fontSize: 9,
            letterSpacing: '0.12em',
            color: accent,
            flexShrink: 0,
          }}
        >
          {isCorr ? 'CORR' : 'SCOUT'}
        </span>

        {/* Headline — truncated */}
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontFamily: "'DM Mono', ui-monospace, monospace",
            fontSize: 10,
            color: 'var(--ui-text-body)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {pin.headline}
        </span>

        {/* Score pill */}
        <span
          style={{
            flexShrink: 0,
            fontFamily: "'DM Mono', ui-monospace, monospace",
            fontSize: 9,
            color: 'var(--ui-text-subtle)',
            background: dimBg,
            border: `1px solid ${borderClr}`,
            borderRadius: 999,
            padding: '1px 6px',
          }}
        >
          {pin.anomaly_score.toFixed(2)}
        </span>

        <span style={{ color: 'var(--ui-text-subtle)', flexShrink: 0 }}>
          <Chevron open={open} />
        </span>
      </button>

      {/* ── Expanded detail ─────────────────────────────────────────── */}
      {open && (
        <div
          style={{
            padding: '0 10px 10px',
            borderTop: `1px solid ${borderClr}`,
            background: dimBg,
          }}
        >
          <p
            style={{
              margin: '8px 0 6px',
              fontFamily: "'DM Mono', ui-monospace, monospace",
              fontSize: 10,
              color: 'var(--ui-text-muted)',
              lineHeight: 1.5,
            }}
          >
            {pin.explanation}
          </p>

          {pin.columns_involved?.length > 0 && (
            <div style={{ marginBottom: 5, fontSize: 9, color: 'var(--ui-text-subtle)' }}>
              <span style={{ color: 'var(--ui-text-faint)', fontFamily: "'DM Mono', ui-monospace, monospace" }}>
                Columns{' '}
              </span>
              <span style={{ color: accent, fontFamily: "'DM Mono', ui-monospace, monospace" }}>
                {pin.columns_involved.join(', ')}
              </span>
            </div>
          )}

          {pin.suggested_action && (
            <div
              style={{
                marginBottom: 6,
                fontFamily: "'DM Mono', ui-monospace, monospace",
                fontSize: 9,
                color: 'var(--ui-text-muted)',
                lineHeight: 1.4,
              }}
            >
              <span style={{ color: 'var(--ui-text-faint)' }}>Action </span>
              {pin.suggested_action}
            </div>
          )}

          <div
            style={{
              fontFamily: "'DM Mono', ui-monospace, monospace",
              fontSize: 9,
              color: 'var(--ui-text-faint)',
            }}
          >
            conf {(pin.confidence * 100).toFixed(0)}%
            {!isCorr && pin.rowIndex >= 0 ? ` · row ${pin.rowIndex}` : ''}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Floating SCOUT insights panel — top-right of the viewport.
 * Shown only when scoutVisible is true and there are pins.
 */
export function ScoutHud() {
  const scoutPins = useSceneStore((s) => s.scoutPins)
  const scoutVisible = useSceneStore((s) => s.scoutVisible)
  const scoutStatus = useSceneStore((s) => s.scoutStatus)
  const [collapsed, setCollapsed] = useState(false)

  if (!scoutVisible) return null
  if (scoutStatus !== 'ready' && scoutPins.length === 0) return null

  const count = scoutPins.length

  return (
    <div
      style={{
        position: 'absolute',
        right: 16,
        top: 52,
        zIndex: 12,
        width: 260,
        maxHeight: 'calc(100vh - 120px)',
        display: 'flex',
        flexDirection: 'column',
        pointerEvents: 'auto',
      }}
    >
      {/* ── Header / toggle ────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '7px 10px',
          background: 'var(--ui-panel-bg)',
          border: `1px solid ${BLOOD_BORDER}`,
          borderRadius: collapsed ? 10 : '10px 10px 0 0',
          cursor: 'pointer',
          textAlign: 'left',
          borderBottom: collapsed ? undefined : `1px solid ${BLOOD_BORDER}`,
        }}
      >
        {/* Animated pulse dot */}
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: BLOOD,
            boxShadow: `0 0 6px ${BLOOD}`,
            flexShrink: 0,
            animation: count > 0 ? 'workflow-pulse 2s ease-in-out infinite' : 'none',
          }}
        />
        <span
          style={{
            fontFamily: "'Bebas Neue', system-ui, sans-serif",
            fontSize: 10,
            letterSpacing: '0.14em',
            color: BLOOD,
            flex: 1,
          }}
        >
          SCOUT
        </span>
        <span
          style={{
            fontFamily: "'DM Mono', ui-monospace, monospace",
            fontSize: 9,
            color: 'var(--ui-text-subtle)',
            background: BLOOD_DIM,
            border: `1px solid ${BLOOD_BORDER}`,
            borderRadius: 999,
            padding: '1px 7px',
          }}
        >
          {count}
        </span>
        <span style={{ color: 'var(--ui-text-subtle)' }}>
          <Chevron open={!collapsed} />
        </span>
      </button>

      {/* ── Pin list ───────────────────────────────────────────────── */}
      {!collapsed && count > 0 && (
        <div
          style={{
            overflowY: 'auto',
            padding: '8px 0 2px',
            background: 'var(--ui-panel-bg)',
            border: `1px solid ${BLOOD_BORDER}`,
            borderTop: 'none',
            borderRadius: '0 0 10px 10px',
            maxHeight: 'calc(100vh - 160px)',
          }}
        >
          <div style={{ padding: '0 8px' }}>
            {scoutPins.map((pin) => (
              <PinCard key={pin.id} pin={pin} />
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────────────── */}
      {!collapsed && count === 0 && (
        <div
          style={{
            padding: '10px 12px',
            background: 'var(--ui-panel-bg)',
            border: `1px solid ${BLOOD_BORDER}`,
            borderTop: 'none',
            borderRadius: '0 0 10px 10px',
            fontFamily: "'DM Mono', ui-monospace, monospace",
            fontSize: 10,
            color: 'var(--ui-text-faint)',
          }}
        >
          {scoutStatus === 'loading' ? 'Scanning…' : 'No anomalies found.'}
        </div>
      )}
    </div>
  )
}
