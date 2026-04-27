/* eslint-disable react/prop-types -- props documented via JSDoc */
import { useEffect, useRef } from 'react'
import Globe from 'globe.gl'

/**
 * @param {{ lat: number; lng: number; color?: string; size?: number }[]} points
 */
export function GlobeHtmlChart({ points }) {
  const ref = useRef(/** @type {HTMLDivElement | null} */ (null))

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const globe = Globe()(el)
      .globeImageUrl(
        'https://unpkg.com/three-globe/example/img/earth-night.jpg',
      )
      .backgroundColor('rgba(0,0,0,0)')
      .showAtmosphere(true)
      .atmosphereColor('#5EEAD4')
      .atmosphereAltitude(0.22)
      .pointsData(points)
      .pointLat('lat')
      .pointLng('lng')
      .pointColor((d) => d.color ?? '#5EEAD4')
      .pointAltitude(0.01)
      .pointRadius((d) => d.size ?? 0.35)

    globe.pointOfView({ altitude: 3.2 })

    const onResize = () => {
      const w = el.clientWidth || 600
      const h = el.clientHeight || 600
      globe.width(w).height(h)
    }
    onResize()
    const ro = new ResizeObserver(onResize)
    ro.observe(el)

    return () => {
      ro.disconnect()
      el.innerHTML = ''
    }
  }, [points])

  return (
    <div
      ref={ref}
      style={{ width: '100%', height: '100%', minHeight: 0, minWidth: 0 }}
    />
  )
}
