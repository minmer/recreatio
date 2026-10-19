/**
 * PARTIKEL-LABOR — Messungen für die Prüfungen: wie ruhig und eben steht
 * Wasser in einer Kiste?
 */

import type { Engine } from '../engine/engine';
import { LIQUID } from '../engine/units';

export interface Settled {
  /** Alle Orte endlich. */
  readonly finite: boolean;
  /** Die schnellste bewegliche Partikel (m/s) und der quadratische Mittelwert aller (m/s). */
  readonly vmax: number;
  readonly rms: number;
  /** Standardabweichung der Höhe der obersten Wasserpartikel je Spalte (m). */
  readonly surfaceStd: number;
  /** Mittlere Dichte des Wassers im Löser (1 = Ruhe). */
  readonly meanDensity: number;
}

export function settled(e: Engine): Settled {
  const st = e.store;
  let finite = true;
  let vmax = 0;
  let sum2 = 0;
  let moving = 0;
  let dens = 0;
  let n = 0;
  /* Je Spalte der Kiste die höchste Wasserpartikel; Spalten am Rand (Menisken) zählen nicht. */
  const columns = new Map<number, number>();
  for (let i = 0; i < st.highWater; i += 1) {
    if (st.alive[i] === 0 || st.fixed[i] === 1) continue;
    if (!Number.isFinite(st.x[i]) || !Number.isFinite(st.y[i])) finite = false;
    const v = Math.hypot(st.vx[i], st.vy[i]);
    vmax = Math.max(vmax, v);
    sum2 += v * v;
    moving += 1;
    if (st.phase[i] !== LIQUID) continue;
    dens += st.dens[i];
    n += 1;
    const c = Math.floor(st.x[i] / e.s);
    columns.set(c, Math.max(columns.get(c) ?? -Infinity, st.y[i]));
  }
  const tops = [...columns.entries()].filter(([c]) => c >= 2 && c < e.nx - 2).map(([, y]) => y);
  const mean = tops.reduce((a, b) => a + b, 0) / tops.length;
  const std = Math.sqrt(tops.reduce((a, b) => a + (b - mean) ** 2, 0) / tops.length);
  return { finite, vmax, rms: Math.sqrt(sum2 / Math.max(1, moving)), surfaceStd: std, meanDensity: dens / n };
}
