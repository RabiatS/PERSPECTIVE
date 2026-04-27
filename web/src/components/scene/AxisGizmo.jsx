import { Line, Html } from '@react-three/drei'

const L = 2

function axisLabelStyle(color) {
  return {
    fontFamily: "'DM Mono', ui-monospace, monospace",
    fontSize: 10,
    fontWeight: 600,
    color,
    pointerEvents: 'none',
    userSelect: 'none',
    textShadow: '0 0 6px rgba(0,0,0,0.9)',
    whiteSpace: 'nowrap',
  }
}

export function AxisGizmo() {
  return (
    <group>
      <Line
        points={[
          [0, 0, 0],
          [L, 0, 0],
        ]}
        color="#FF4444"
        lineWidth={2}
      />
      <group position={[L, 0, 0]}>
        <mesh>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshBasicMaterial color="#FF4444" />
        </mesh>
        <Html
          center
          distanceFactor={8}
          style={axisLabelStyle('#FF4444')}
          transform
          occlude={false}
        >
          X
        </Html>
      </group>

      <Line
        points={[
          [0, 0, 0],
          [0, L, 0],
        ]}
        color="#44FF44"
        lineWidth={2}
      />
      <group position={[0, L, 0]}>
        <mesh>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshBasicMaterial color="#44FF44" />
        </mesh>
        <Html
          center
          distanceFactor={8}
          style={axisLabelStyle('#44FF44')}
          transform
          occlude={false}
        >
          Y
        </Html>
      </group>

      <Line
        points={[
          [0, 0, 0],
          [0, 0, L],
        ]}
        color="#4488FF"
        lineWidth={2}
      />
      <group position={[0, 0, L]}>
        <mesh>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshBasicMaterial color="#4488FF" />
        </mesh>
        <Html
          center
          distanceFactor={8}
          style={axisLabelStyle('#4488FF')}
          transform
          occlude={false}
        >
          Z
        </Html>
      </group>
    </group>
  )
}
