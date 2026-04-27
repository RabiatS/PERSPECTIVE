import { useEffect, useState } from 'react'

/**
 * Tracks Alt key for “pass pointer events to canvas” overlays (Plotly sits above WebGL).
 */
export function useAltOrbitPassthrough() {
  const [altHeld, setAltHeld] = useState(false)
  useEffect(() => {
    const down = (e) => {
      if (e.code === 'AltLeft' || e.code === 'AltRight') setAltHeld(true)
    }
    const up = (e) => {
      if (e.code === 'AltLeft' || e.code === 'AltRight') setAltHeld(false)
    }
    const blur = () => setAltHeld(false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])
  return altHeld
}
