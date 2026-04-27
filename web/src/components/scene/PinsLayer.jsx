/**
 * SCOUT markers are drawn inside Plotly (see `buildScoutPinTrace3d` / 2d) so they share
 * the chart’s 3D camera and sit on the outlier. R3F billboards at raw x,y,z do not match
 * Plotly’s separate projection, so this layer is intentionally empty for Plotly charts.
 */
export function PinsLayer() {
  return null
}
