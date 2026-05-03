/**
 * Maps a pressure value (bar) to a hex colour.
 * Threshold = 1 bar (PUB minimum).
 *
 * Red     < 1.0 bar  — below minimum (critical)
 * Orange  1.0–1.5    — marginal
 * Yellow  1.5–2.5    — acceptable
 * Green   >= 2.5     — healthy
 */
export function pressureToColor(pressure_bar: number): string {
  if (pressure_bar < 1.0) return '#e53935';   // red
  if (pressure_bar < 1.5) return '#fb8c00';   // orange
  if (pressure_bar < 2.5) return '#fdd835';   // yellow
  return '#43a047';                           // green
}

export const PRESSURE_LEGEND = [
  { label: '< 1.0 bar (critical)', color: '#e53935' },
  { label: '1.0 – 1.5 bar',        color: '#fb8c00' },
  { label: '1.5 – 2.5 bar',        color: '#fdd835' },
  { label: '>= 2.5 bar (healthy)', color: '#43a047' },
];
