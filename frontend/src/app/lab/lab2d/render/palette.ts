/**
 * LABOR 2D (v2) — FARBEN: die Einblendungen mit einer für Farbsehschwäche
 * geeigneten Skala (viridis, van der Walt & Smith 2015, CC0 — hier mit neun
 * Stützstellen linear gelesen), Werkstoffe aus materials.json.
 */

export const VIRIDIS: readonly (readonly [number, number, number])[] = [
  [68, 1, 84], [72, 40, 120], [62, 74, 137], [49, 104, 142], [38, 130, 142],
  [31, 158, 137], [53, 183, 121], [109, 205, 89], [180, 222, 44], [253, 231, 37]
];

/** viridis(t) für t in [0, 1] → RGB 0–255 in out[o..o+2]. */
export function viridis(t: number, out: Uint8Array, o: number): void {
  const x = Math.min(1, Math.max(0, t)) * (VIRIDIS.length - 1);
  const i = Math.min(VIRIDIS.length - 2, Math.floor(x));
  const f = x - i;
  const a = VIRIDIS[i];
  const b = VIRIDIS[i + 1];
  out[o] = a[0] + (b[0] - a[0]) * f;
  out[o + 1] = a[1] + (b[1] - a[1]) * f;
  out[o + 2] = a[2] + (b[2] - a[2]) * f;
}

/** "#rrggbb" → [r, g, b]. */
export function hex(color: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  if (m === null) return [128, 128, 128];
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** Die Skala der Temperatur-Einblendung (°C): 0 bis 120. */
export const T_SCALE: readonly [number, number] = [0, 120];
