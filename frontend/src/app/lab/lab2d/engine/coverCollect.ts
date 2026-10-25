/**
 * LABOR 2D (v2) — WAS DIE ZELLEN AN DEN KÖRPERTEILEN ÄNDERTEN, ZURÜCK IN DIE
 * INNEREN ZELLEN (bodyCover.collect; seit 2026-10-25 eine eigene Datei).
 *
 * Wärmeleitung, Tau, Verdunsten und Kristalle ändern Es, Film und Kruste der
 * Gitterzellen, in denen Körperteile liegen; am Ende des Schritts geht die
 * Änderung an die inneren Zellen der Körper:
 *
 * - Energie nach Wärmekapazität (w C_k / capB).
 * - Was an Film oder Kruste dazukommt, nach dem Gewicht (w / Σw).
 * - Was abnimmt, nach dem, was jede innere Zelle der Zelle wirklich beiträgt
 *   (w m_k, über alle Körper der Zelle: G) — höchstens dieser Beitrag; fehlt
 *   darüber hinaus etwas, gibt es der Körper, dem die Zelle gehört, aus seinem
 *   ganzen Film (bzw. seiner Kruste).
 *
 * Bis 2026-10-24 teilte sich eine Abnahme nach dem abgeglichenen Wert der Zelle
 * auf. Der weicht ab, sobald Tau in einer Zelle zunimmt und in der Nachbarzelle
 * verdunstet (eine innere Zelle liegt in beiden): dann nahm eine Zelle mit
 * fast keinem Film einer inneren Zelle ihren ganzen Film, der Rest wurde bei
 * null abgeschnitten — Wasser aus nichts (die Zlewka nach dem Verschieben, M0).
 */

import type { Body2D } from './body';
import type { Grid } from './grid';

export interface CollectSync {
  readonly esSync: Float64Array;
  readonly filmSync: Float64Array;
  readonly crustSync: Float64Array;
  readonly wsum: Float64Array;
}

/** Arbeitsfelder je Gitterzelle (in jedem collect neu geschrieben). */
export class CollectWork {
  readonly gF: Float64Array;
  readonly gK: Float64Array;
  readonly seen: Int32Array;
  /** Je Körper, was er aus seinem Ganzen gibt (Film, Kruste). */
  restF = new Float64Array(8);
  restK = new Float64Array(8);
  tag = 0;
  constructor(n: number) {
    this.gF = new Float64Array(n);
    this.gK = new Float64Array(n);
    this.seen = new Int32Array(n);
  }
}

/* Drei wiederverwendete Arbeitsfelder je Körper (Energie, Film, Kruste), jedes Mal auf null. */
const pools: Float64Array[] = [new Float64Array(64), new Float64Array(64), new Float64Array(64)];
function scratch(slot: number, n: number): Float64Array {
  if (pools[slot].length < n) pools[slot] = new Float64Array(2 * n);
  const a = pools[slot];
  a.fill(0, 0, n);
  return a;
}

/** Die Änderungen an den Körperteilen der Zellen an die inneren Zellen der Körper (Energie, Film, Kruste: genau). */
export function collectBodies(g: Grid, bodies: readonly Body2D[], sync: CollectSync, capK: readonly Float64Array[], work: CollectWork): void {
  const { gF, gK, seen } = work;
  /* Was die inneren Zellen jeder Zelle beitragen (über alle Körper). */
  for (const b of bodies) {
    if (b.gone || b.nw === 0) continue;
    for (let e = 0; e < b.nw; e += 1) { gF[b.wc[e]] = 0; gK[b.wc[e]] = 0; }
  }
  for (const b of bodies) {
    if (b.gone || b.nw === 0) continue;
    for (let e = 0; e < b.nw; e += 1) {
      const c = b.wc[e];
      gF[c] += b.ww[e] * b.film[b.wk[e]];
      gK[c] += b.ww[e] * b.crust[b.wk[e]];
    }
  }
  /* Was eine Zelle über das Beitragene hinaus verlor: der Körper, dem sie gehört, gibt es aus seinem Ganzen. */
  if (work.restF.length < bodies.length) { work.restF = new Float64Array(2 * bodies.length); work.restK = new Float64Array(2 * bodies.length); }
  const restF = work.restF;
  const restK = work.restK;
  restF.fill(0);
  restK.fill(0);
  const tag = ++work.tag;
  for (const b of bodies) {
    if (b.gone || b.nw === 0) continue;
    for (let e = 0; e < b.nw; e += 1) {
      const c = b.wc[e];
      if (seen[c] === tag) continue;
      seen[c] = tag;
      const owner = g.owner[c] > 0 ? g.owner[c] - 1 : b.index;
      const df = g.film[c] - sync.filmSync[c];
      if (df < 0 && -df > gF[c]) restF[owner] += -df - gF[c];
      const dk = g.crust[c] - sync.crustSync[c];
      if (dk < 0 && -dk > gK[c]) restK[owner] += -dk - gK[c];
    }
  }
  for (const b of bodies) {
    if (b.gone || b.nw === 0) continue;
    const C = capK[b.index];
    const dE = scratch(0, b.ncell);
    const dF = scratch(1, b.ncell);
    const dK = scratch(2, b.ncell);
    let any = restF[b.index] > 0 || restK[b.index] > 0;
    for (let e = 0; e < b.nw; e += 1) {
      const c = b.wc[e];
      const k = b.wk[e];
      const wgt = b.ww[e];
      const de = g.Es[c] - sync.esSync[c];
      if (de !== 0 && g.capB[c] > 0) { dE[k] += (de * wgt * C[k]) / g.capB[c]; any = true; }
      const df = g.film[c] - sync.filmSync[c];
      if (df > 0 && sync.wsum[c] > 0) { dF[k] += (df * wgt) / sync.wsum[c]; any = true; }
      else if (df < 0 && gF[c] > 0) { dF[k] -= Math.min(1, -df / gF[c]) * wgt * b.film[k]; any = true; }
      const dk = g.crust[c] - sync.crustSync[c];
      if (dk > 0 && sync.wsum[c] > 0) { dK[k] += (dk * wgt) / sync.wsum[c]; any = true; }
      else if (dk < 0 && gK[c] > 0) { dK[k] -= Math.min(1, -dk / gK[c]) * wgt * b.crust[k]; any = true; }
    }
    if (!any) continue;
    let F = 0;
    let K = 0;
    for (let k = 0; k < b.ncell; k += 1) {
      b.E[k] += dE[k];
      b.film[k] = Math.max(0, b.film[k] + dF[k]);
      b.crust[k] = Math.max(0, b.crust[k] + dK[k]);
      F += b.film[k];
      K += b.crust[k];
    }
    /* Der Rest aus dem ganzen Körper, nach dem, was jede innere Zelle trägt. */
    if (restF[b.index] > 0 && F > 0) { const f = Math.max(0, 1 - restF[b.index] / F); for (let k = 0; k < b.ncell; k += 1) b.film[k] *= f; }
    if (restK[b.index] > 0 && K > 0) { const f = Math.max(0, 1 - restK[b.index] / K); for (let k = 0; k < b.ncell; k += 1) b.crust[k] *= f; }
  }
  for (let c = 0; c < g.n; c += 1) {
    if (g.capB[c] <= 0) continue;
    sync.esSync[c] = g.Es[c];
    sync.filmSync[c] = g.film[c];
    sync.crustSync[c] = g.crust[c];
  }
}
