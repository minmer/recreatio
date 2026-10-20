/**
 * LABOR 2D (v2) — DER ZUSTAND EINER BLASE (ARCHITECTURE.md §8.1).
 *
 * Eine Blase ist eine Kugel in der Schicht; aus ihren Massen und dem Druck
 * der Flüssigkeit um sie folgen Radius, Innendruck und Temperatur:
 *
 *   p_b = p_l + 2σ/r,   T_b = T_sat(p_v),
 *   V = m_v/ρ''(T_b) = n_a R T_b/(p_b − p_v)   (Dampf gesättigt bei seinem
 *   Partialdruck — ρ'' nach IAPWS SR1-86, damit die Dampfdichte der von
 *   IF97 entspricht; Luft ideal).
 *
 * Reiner Dampf: p_v = p_b. Reine Luft (noch kein Dampf): T_b = T der
 * Flüssigkeit. Wird die Kugel breiter als die Schicht (2r > D), wird sie
 * flacher (r bleibt D/2, bis ihr Volumen π (D/2)² D erreicht) und dann eine
 * Scheibe des Volumens π r² D (Prompt v2). Fläche für den Wärmeübergang:
 * Kugel 4πr², Scheibe 2πrD (Vorder- und Rückseite der Schicht tauschen nichts
 * aus); beide sind beim Übergang π D².
 */

import { rhoVapourSatFast, tSat } from './if97';
import { MOLAR, sigma } from './materials';
import { H2O, N2, O2, R_GAS, SPECIES_SLOTS } from './units';

/**
 * Höchstens so schnell (Zellvolumen je Sekunde) macht die Flüssigkeit den Blasen einer Zelle Platz oder füllt ihn
 * wieder; der Rest folgt in den nächsten Schritten. Verschmelzen, Platzen, Vergehen und Umrastern geschehen in einem
 * Schritt, gleich wie kurz er ist: ihre Volumenquelle Δα_b·V/Δt verlangte sonst Geschwindigkeiten ∝ 1/Δt, der
 * Zeitschritt nach der schnellsten Flüssigkeit fiel, und die Quelle wuchs weiter (kaltes Wasser auf die heisse Platte
 * gemalt: Δt gegen null, dann NaN). Im gewöhnlichen Sieden bleibt die Rate darunter (gemessen höchstens 22 /s bei
 * 2 mm, 121 /s bei 1 mm).
 */
export const ALPHA_RATE = 200;

export interface BubbleShape {
  r: number;
  V: number;
  pb: number;
  pv: number;
  Tb: number;
  /** Fläche für Wärme und Stoff (m²), angeströmte Fläche (m²). */
  area: number;
  front: number;
}

/** m_v/ρ''(T_sat(p_v)) − n_a R T_sat(p_v)/(p_b − p_v): die Volumina von Dampf und Luft beim Partialdruck p_v. */
function gap(p: number, mv: number, na: number, pb: number): number {
  const T = tSat(p);
  return mv / rhoVapourSatFast(T) - (na * R_GAS * T) / (pb - p);
}

/** Radius (in der Ebene) zu einem Volumen in einer Schicht der Dicke D. */
export function radiusOf(V: number, D: number): number {
  const v1 = (Math.PI * D * D * D) / 6;
  if (V <= v1) return Math.cbrt((3 * V) / (4 * Math.PI));
  const v2 = (Math.PI * D * D * D) / 4;
  if (V <= v2) return D / 2;
  return Math.sqrt(V / (Math.PI * D));
}

/** Fläche des Wärmeübergangs und angeströmte Fläche zu Volumen und Radius. */
function areas(V: number, r: number, D: number, out: BubbleShape): void {
  const v1 = (Math.PI * D * D * D) / 6;
  const v2 = (Math.PI * D * D * D) / 4;
  if (V <= v1) { out.area = 4 * Math.PI * r * r; out.front = Math.PI * r * r; return; }
  if (V >= v2) { out.area = 2 * Math.PI * r * D; out.front = 2 * r * D; return; }
  const t = (V - v1) / (v2 - v1);
  out.area = Math.PI * D * D;
  out.front = (1 - t) * (Math.PI * D * D) / 4 + t * D * D;
}

/**
 * Den Zustand einer Blase lösen: Massen m (je Gasart, kg) und Druck der
 * Flüssigkeit pl (Pa, absolut); Tl: Temperatur der Flüssigkeit (für eine
 * Blase ohne Dampf); rGuess: der letzte Radius.
 */
export function solveBubble(m: Float64Array, o: number, pl: number, Tl: number, D: number, rGuess: number, out: BubbleShape): void {
  const mv = m[o + H2O];
  const na = m[o + N2] / MOLAR[N2] + m[o + O2] / MOLAR[O2];
  const nv = mv / MOLAR[H2O];
  let r = rGuess > 0 ? rGuess : Math.cbrt((3 * Math.max(1e-30, (nv + na) * R_GAS * Tl / pl)) / (4 * Math.PI));
  let pb = pl;
  let pv = 0;
  let Tb = Tl;
  let V = 0;
  for (let it = 0; it < 8; it += 1) {
    pb = pl + (2 * sigma(Tb)) / r;
    if (na <= 0) {
      pv = pb;
      Tb = tSat(pv);
      V = mv / rhoVapourSatFast(Tb);
    } else if (nv <= 1e-9 * na) {
      pv = 0;
      Tb = Tl;
      V = (na * R_GAS * Tb) / pb;
    } else {
      /* p_v in (p_min, p_b): m_v/ρ''(T_sat(p_v)) = n_a R T_sat(p_v)/(p_b − p_v); links ist die Differenz positiv, rechts negativ. */
      let lo = 611.213;
      let hi = pb * (1 - 1e-12);
      let flo = gap(lo, mv, na, pb);
      let fhi = gap(hi, mv, na, pb);
      if (flo <= 0) { pv = lo; } else if (fhi >= 0) { pv = hi; } else {
        let side = 0;
        pv = 0.5 * (lo + hi);
        for (let k = 0; k < 40; k += 1) {
          pv = (lo * fhi - hi * flo) / (fhi - flo);
          const fv = gap(pv, mv, na, pb);
          if (Math.abs(fv) <= 1e-12 * (mv / rhoVapourSatFast(Tl) + 1e-30)) break;
          if (fv > 0) { lo = pv; flo = fv; if (side === 1) fhi /= 2; side = 1; }
          else { hi = pv; fhi = fv; if (side === -1) flo /= 2; side = -1; }
        }
      }
      Tb = tSat(pv);
      V = mv / rhoVapourSatFast(Tb);
    }
    const rn = radiusOf(V, D);
    if (Math.abs(rn - r) <= 1e-7 * r) { r = rn; break; }
    r = rn;
  }
  out.r = r;
  out.V = V;
  out.pb = pl + (2 * sigma(Tb)) / r;
  out.pv = pv;
  out.Tb = Tb;
  areas(V, r, D, out);
}

/** Die Enthalpie des Inhalts bei T_b (J) — mit den Funktionen der Schliessung. */
export function bubbleEnthalpy(m: Float64Array, o: number, T: number, hGas: (k: number, T: number) => number): number {
  let H = 0;
  for (let k = 0; k < SPECIES_SLOTS; k += 1) if (m[o + k] > 0) H += m[o + k] * hGas(k, T);
  return H;
}

/**
 * Wie eine Blase auf die Zellen wirkt (Volumen, Wärme, Kraft): bis d = 3Δx
 * mit den Gewichten des quadratischen B-Splines um ihre Mitte (3 × 3 Zellen),
 * grösser auf die Zellen gerastert, die sie überdeckt (je Zelle 4 × 4
 * Stichpunkte, bei einer Kugel mit der Sehnenlänge gewichtet). Die Gewichte
 * summieren sich zu 1; Rückgabe: Anzahl der Einträge in cells/weights.
 */
export function footprint(x: number, y: number, r: number, V: number, D: number, dx: number, nx: number, ny: number, cells: Int32Array, weights: Float64Array): number {
  let k = 0;
  if (2 * r <= 3 * dx) {
    const sx = x / dx - 0.5;
    const sy = y / dx - 0.5;
    const i0 = Math.floor(sx - 0.5);
    const j0 = Math.floor(sy - 0.5);
    const fx = sx - i0;
    const fy = sy - j0;
    const wx0 = 0.5 * (1.5 - fx) ** 2, wx1 = 0.75 - (fx - 1) ** 2, wx2 = 0.5 * (fx - 0.5) ** 2;
    const wy0 = 0.5 * (1.5 - fy) ** 2, wy1 = 0.75 - (fy - 1) ** 2, wy2 = 0.5 * (fy - 0.5) ** 2;
    let sum = 0;
    for (let b = 0; b < 3; b += 1) {
      const j = j0 + b;
      if (j < 0 || j >= ny) continue;
      const wy = b === 0 ? wy0 : b === 1 ? wy1 : wy2;
      for (let a = 0; a < 3; a += 1) {
        const i = i0 + a;
        if (i < 0 || i >= nx) continue;
        const w = wy * (a === 0 ? wx0 : a === 1 ? wx1 : wx2);
        cells[k] = i + j * nx;
        weights[k] = w;
        sum += w;
        k += 1;
      }
    }
    for (let q = 0; q < k; q += 1) weights[q] /= sum;
    return k;
  }
  const sphere = V <= (Math.PI * D * D * D) / 6;
  const i0 = Math.max(0, Math.floor((x - r) / dx));
  const i1 = Math.min(nx - 1, Math.floor((x + r) / dx));
  const j0 = Math.max(0, Math.floor((y - r) / dx));
  const j1 = Math.min(ny - 1, Math.floor((y + r) / dx));
  let sum = 0;
  for (let j = j0; j <= j1; j += 1) {
    for (let i = i0; i <= i1; i += 1) {
      let w = 0;
      for (let b = 0; b < 4; b += 1) {
        const py = (j + (b + 0.5) / 4) * dx - y;
        for (let a = 0; a < 4; a += 1) {
          const px = (i + (a + 0.5) / 4) * dx - x;
          const q = r * r - px * px - py * py;
          if (q > 0) w += sphere ? Math.sqrt(q) : 1;
        }
      }
      if (w <= 0 || k >= cells.length) continue;
      cells[k] = i + j * nx;
      weights[k] = w;
      sum += w;
      k += 1;
    }
  }
  if (sum <= 0) {
    cells[0] = Math.min(nx - 1, Math.max(0, Math.floor(x / dx))) + Math.min(ny - 1, Math.max(0, Math.floor(y / dx))) * nx;
    weights[0] = 1;
    return 1;
  }
  for (let q = 0; q < k; q += 1) weights[q] /= sum;
  return k;
}
