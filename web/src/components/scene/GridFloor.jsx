import { Grid } from '@react-three/drei'
import { useThemeStore } from '../../store/useThemeStore.js'

/** Unity-style static grid: 40×40 units, 40 cells per side, no distance fade */
export function GridFloor() {
  const theme = useThemeStore((s) => s.theme)
  const isLight = theme === 'light'
  const cellColor = isLight ? 'rgba(0, 0, 0, 0.07)' : 'rgba(255, 255, 255, 0.04)'
  const sectionColor = isLight ? 'rgba(0, 130, 145, 0.22)' : 'rgba(94, 234, 212, 0.12)'
  return (
    <Grid
      position={[0, -0.01, 0]}
      args={[40, 40]}
      cellSize={1}
      cellThickness={0.6}
      cellColor={cellColor}
      sectionSize={10}
      sectionThickness={1}
      sectionColor={sectionColor}
      fadeDistance={0}
      fadeStrength={0}
      infiniteGrid={false}
      followCamera={false}
    />
  )
}
