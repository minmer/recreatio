/**
 * LABOR 2D (v2) — NEBEL (ARCHITECTURE.md §9, Teil 3 der Grenzflächenstufe):
 * ist p_H₂O > p_sat(T), kondensiert Δm so, dass der restliche Dampf bei der
 * neuen Temperatur genau gesättigt ist (H bleibt, T steigt um h_lv Δm/C) —
 * gesucht mit einem eingeschlossenen Sekantenverfahren; „den Überschuss bei
 * der alten Temperatur“ zu kondensieren schösse weit hinaus. Untersättigt
 * verdunstet Nebel ebenso. Die Zähler (fogMade, fogError, fogWrong) stehen in
 * der Grenzflächenstufe (phase.ts).
 */

import type { Engine } from './engine';
import { pSatFast } from './if97';
import { gasHeatCapacity, gasTemperature, hGas, hL, hV, MOLAR } from './materials';
import type { Phase } from './phase';
import { GAS, H2O, N2, O2 } from './units';

/** Die Temperatur einer Gaszelle mit geänderten Massen (Dampf mv, Nebel mf) bei gleicher Enthalpie H. */
function tempWith(e: Engine, c: number, mv: number, mf: number, T0: number): number {
  const g = e.grid;
  const n = g.n;
  const mN = g.mg[N2 * n + c];
  const mO = g.mg[O2 * n + c];
  const H = g.Hg[c];
  if (mf <= 0) return gasTemperature(mN, mO, mv, H);
  let T = T0;
  for (let it = 0; it < 6; it += 1) {
    const Hc = mN * hGas(N2, T) + mO * hGas(O2, T) + mv * hV(T) + mf * hL(T);
    const dT = (H - Hc) / gasHeatCapacity(mN, mO, mv, mf, T);
    T += dT;
    if (Math.abs(dT) < 1e-10) break;
  }
  return T;
}

/** Abstand zur Sättigung p_v − p_sat(T) (Pa) nach dem Kondensieren von d (kg Dampf → Nebel). */
function satGap(e: Engine, c: number, d: number, nDry: number, p: number, T0: number): number {
  const g = e.grid;
  const n = g.n;
  const mv = g.mg[H2O * n + c] - d;
  const mf = g.mfog[c] + d;
  const T = tempWith(e, c, mv, mf, T0);
  const nv = mv / MOLAR[H2O];
  /* Reiner Dampf ohne Luft: p_v = p; ganz ohne Gas: p_v = 0. */
  const pv = nv + nDry > 0 ? (nv / (nv + nDry)) * p : 0;
  return pv - pSatFast(T);
}

function setFog(e: Engine, ph: Phase, c: number, d: number): void {
  const { grid: g, gas } = e;
  const n = g.n;
  if (d === 0 || !Number.isFinite(d)) return;
  const dd = Math.max(-g.mfog[c], Math.min(g.mg[H2O * n + c], d));
  g.mg[H2O * n + c] -= dd;
  g.mfog[c] += dd;
  if (g.mfog[c] < 1e-30) g.mfog[c] = 0;
  ph.fogMade += dd;
  gas.deriveCell(c);
}

/** Nebel: Kondensation bis genau zur Sättigung, oder Verdunsten von Nebel in untersättigtem Gas. */
export function fogStep(e: Engine, ph: Phase): void {
  const { grid: g, regions: R } = e;
  const n = g.n;
  ph.fogError = 0;
  ph.fogWrong = 0;
  for (let c = 0; c < n; c += 1) {
    if (g.kind[c] !== GAS) continue;
    const mv = g.mg[H2O * n + c];
    const mf = g.mfog[c];
    if (mv <= 0 && mf <= 0) continue;
    const nDry = g.mg[N2 * n + c] / MOLAR[N2] + g.mg[O2 * n + c] / MOLAR[O2];
    const p = R.pAt(c);
    const T0 = g.T[c];
    if (mf <= 0) {
      const nv = mv / MOLAR[H2O];
      if ((nv / (nv + nDry)) * p < 0.999 * pSatFast(T0)) continue;
    }
    const gap0 = satGap(e, c, 0, nDry, p, T0);
    if (gap0 <= 0 && mf <= 0) continue;
    let lo: number, hi: number, flo: number, fhi: number;
    if (gap0 > 0) {
      lo = 0; flo = gap0;
      hi = mv; fhi = satGap(e, c, hi, nDry, p, T0);
    } else {
      hi = 0; fhi = gap0;
      lo = -mf; flo = satGap(e, c, lo, nDry, p, T0);
      if (flo <= 0) {
        /* Auch ohne Nebel untersättigt: aller Nebel verdunstet. */
        setFog(e, ph, c, lo);
        continue;
      }
    }
    if (fhi > 0) { setFog(e, ph, c, hi); continue; }
    /* Eingeschlossene Sekante (Illinois): f(lo) > 0 > f(hi). */
    let d = lo;
    let side = 0;
    for (let it = 0; it < 40; it += 1) {
      d = (lo * fhi - hi * flo) / (fhi - flo);
      if (!Number.isFinite(d) || d <= Math.min(lo, hi) || d >= Math.max(lo, hi)) d = 0.5 * (lo + hi);
      const f = satGap(e, c, d, nDry, p, T0);
      if (Math.abs(f) <= 1e-13 * p) break;
      if (f > 0) { lo = d; flo = f; if (side === 1) fhi /= 2; side = 1; }
      else { hi = d; fhi = f; if (side === -1) flo /= 2; side = -1; }
    }
    setFog(e, ph, c, d);
    if (gap0 < 0 && d > 0) ph.fogWrong += 1;
    if (g.mfog[c] > 0) {
      const after = satGap(e, c, 0, nDry, p, g.T[c]);
      ph.fogError = Math.max(ph.fogError, Math.abs(after) / pSatFast(g.T[c]));
    }
  }
}
