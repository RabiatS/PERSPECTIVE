import { useSceneStore } from '../../store/useSceneStore.js'
import { SubSceneChartNode } from '../charts/SubSceneChartNode.jsx'

export function SubScenesLayer() {
  const subScenes = useSceneStore((s) => s.subScenes)
  const activeChartType = useSceneStore((s) => s.activeChartType)
  if (activeChartType === 'globe') return null
  return (
    <>
      {subScenes.map((sub) => (
        <SubSceneChartNode key={sub.id} sub={sub} />
      ))}
    </>
  )
}
