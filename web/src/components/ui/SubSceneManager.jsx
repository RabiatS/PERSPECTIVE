import { useSceneStore } from '../../store/useSceneStore.js'

export function SubSceneManager() {
  const subScenes = useSceneStore((s) => s.subScenes)
  const renameSubScene = useSceneStore((s) => s.renameSubScene)
  const removeSubScene = useSceneStore((s) => s.removeSubScene)
  const toggleSubSceneCollapsed = useSceneStore((s) => s.toggleSubSceneCollapsed)
  const focusSubScene = useSceneStore((s) => s.focusSubScene)

  if (subScenes.length === 0) return null

  return (
    <div
      style={{
        position: 'absolute',
        left: 16,
        top: 52,
        zIndex: 12,
        width: 260,
        maxHeight: '40vh',
        overflowY: 'auto',
        padding: '10px 12px',
        background: 'var(--ui-panel-bg)',
        border: '1px solid rgba(168, 28, 28, 0.25)',
        borderRadius: 10,
        fontFamily: "'DM Mono', ui-monospace, monospace",
        fontSize: 10,
        color: 'var(--ui-text-muted)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <div
          style={{
            color: '#A81C1C',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          Sub-scenes
        </div>
        <div
          title="Sub-scenes live in memory only — they are cleared on page refresh"
          style={{
            fontSize: 9,
            color: '#5a5a68',
            letterSpacing: '0.04em',
            cursor: 'default',
          }}
        >
          session only
        </div>
      </div>
      {subScenes.map((s) => (
        <div
          key={s.id}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            marginBottom: 10,
            paddingBottom: 10,
            borderBottom: '1px solid var(--ui-divider)',
          }}
        >
          <input
            value={s.label}
            onChange={(e) => renameSubScene(s.id, e.target.value)}
            style={{
              background: 'rgba(20,20,28,0.9)',
              border: '1px solid rgba(168,28,28,0.3)',
              color: '#e0e0e8',
              borderRadius: 6,
              padding: '4px 8px',
              fontSize: 11,
            }}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => focusSubScene(s.id)}
              style={{
                flex: '1 1 45%',
                padding: '4px 8px',
                fontSize: 9,
                background: 'transparent',
                border: '1px solid var(--ui-accent-border)',
                color: 'var(--ui-accent)',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Focus
            </button>
            <button
              type="button"
              onClick={() => toggleSubSceneCollapsed(s.id)}
              style={{
                flex: '1 1 45%',
                padding: '4px 8px',
                fontSize: 9,
                background: 'transparent',
                border: '1px solid rgba(168,28,28,0.35)',
                color: '#A81C1C',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              {s.collapsed ? 'Expand' : 'Collapse'}
            </button>
            <button
              type="button"
              onClick={() => removeSubScene(s.id)}
              style={{
                padding: '4px 8px',
                fontSize: 9,
                background: 'transparent',
                border: '1px solid rgba(255,107,53,0.4)',
                color: '#FF6B35',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
