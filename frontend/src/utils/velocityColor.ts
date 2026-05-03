/**
 * Maps pipe flow velocity (m/s) to a hex colour for map rendering.
 *
 * Thresholds align with water distribution engineering standards:
 *   < 0.001 m/s  — no flow / stagnant   (handled separately as zero-flow)
 *   0–0.3  m/s   — low (below recommended minimum, sedimentation risk)
 *   0.3–1.0 m/s  — normal operating range
 *   1.0–2.0 m/s  — high (approaching erosion/noise limit)
 *   > 2.0  m/s   — excessive (PUB max; erosion and transient risk)
 */
export function velocityToColor(velocity_mps: number): string {
  const v = Math.abs(velocity_mps);
  if (v < 0.001) return '#90a4ae';   // grey  — stagnant / zero flow
  if (v < 0.3)   return '#4dd0e1';   // cyan  — low flow
  if (v < 1.0)   return '#66bb6a';   // green — normal
  if (v < 2.0)   return '#ffa726';   // amber — high
  return '#ef5350';                  // red   — excessive
}

export const VELOCITY_LEGEND = [
  { label: '0 m/s (no flow)',          color: '#90a4ae' },
  { label: '0 – 0.3 m/s (low)',        color: '#4dd0e1' },
  { label: '0.3 – 1.0 m/s (normal)',   color: '#66bb6a' },
  { label: '1.0 – 2.0 m/s (high)',     color: '#ffa726' },
  { label: '> 2.0 m/s (excessive)',    color: '#ef5350' },
];
