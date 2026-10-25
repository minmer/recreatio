/**
 * LABOR 2D (v2) — DIE SEITEN EINES SCHMELZENDEN KÖRPERS (bodyMelt.ts): ihre
 * Randzellen und freien Längen, was vor einer Seite liegt (Fluid für das
 * Schmelzwasser und den Gefrierpunkt) und wie viel Wärme dort ansteht — so
 * schmilzt die Seite, durch die die Wärme kommt, auch wenn sie auf einem warmen
 * Feststoff liegt (einer Heizplatte, der Wand einer warmen Zlewka).
 */

import { meltsAt, type Body2D } from './body';
import { CLOSED, CLOSED_FREE } from './bodyCover';
import type { Engine } from './engine';
import type { Grid } from './grid';
import { kL, kMix, SOLIDS } from './materials';
import { freezingPoint, M_S } from './solution';
import { H2O, LIQUID } from './units';

/** Arbeitsfeld für die Strecke eines Seitenstücks (body.segment). */
const SG = new Float64Array(6);

/**
 * Die inneren Randzellen der Seite s des Rechtecks r: je Zelle ihre Länge
 * längs der Seite und der Anteil davon, der frei liegt (nicht in einer Fuge).
 */
export function edgeCells(b: Body2D, r: number, s: number, fn: (k: number, len: number, free: number) => void): void {
  const ni = b.ni[r];
  const nj = b.nj[r];
  const along = s < 2 ? nj : ni;
  for (let t = 0; t < along; t += 1) {
    const p = s === 0 ? 0 : s === 1 ? ni - 1 : t;
    const q = s === 2 ? 0 : s === 3 ? nj - 1 : t;
    const k = b.off[r] + p + q * ni;
    const lo = s < 2 ? b.ys[r][q] : b.xs[r][p];
    const hi = s < 2 ? b.ys[r][q + 1] : b.xs[r][p + 1];
    const free = freeOn(b, r, s, lo, hi);
    fn(k, hi - lo, hi > lo ? free / (hi - lo) : 0);
  }
}

/** Wie viel von [lo, hi] längs der Seite s des Rechtecks r frei liegt (m). */
export function freeOn(b: Body2D, r: number, s: number, lo: number, hi: number): number {
  let free = 0;
  for (let e = 0; e < b.nseg; e += 1) {
    if (b.segR[e] !== r || b.segS[e] !== s) continue;
    free += Math.max(0, Math.min(hi, b.segT1[e]) - Math.max(lo, b.segT0[e]));
  }
  return free;
}

/** Länge der ganzen Seite s des Rechtecks r (m). */
export function sideLength(b: Body2D, r: number, s: number): number {
  const [x0, y0, x1, y1] = b.bounds(r);
  return s < 2 ? y1 - y0 : x1 - x0;
}

/** Freie Länge der Seite s des Rechtecks r (m). */
export function freeLength(b: Body2D, r: number, s: number): number {
  let len = 0;
  for (let e = 0; e < b.nseg; e += 1) if (b.segR[e] === r && b.segS[e] === s) len += b.segT1[e] - b.segT0[e];
  return len;
}

/** Die Seite von r mit der längsten freien Strecke (sonst oben). */
export function widestFree(b: Body2D, r: number): number {
  let best = 3;
  let len = 0;
  for (let s = 0; s < 4; s += 1) {
    const l = freeLength(b, r, s);
    if (l > len) { len = l; best = s; }
  }
  return best;
}

/**
 * Punkte längs des Seitenstücks e, je ein halbes Δx: Weltort und die Normale
 * nach aussen (für fluidFront und supplyAt).
 */
function along(e: Engine, b: Body2D, seg: number, fn: (wx: number, wy: number, nwx: number, nwy: number, len: number) => void): void {
  b.segment(seg, SG);
  const len = Math.hypot(SG[2] - SG[0], SG[3] - SG[1]);
  const n = Math.max(1, Math.ceil(len / (0.5 * e.grid.dx)));
  const cs = Math.cos(b.a);
  const sn = Math.sin(b.a);
  const nwx = cs * SG[4] - sn * SG[5];
  const nwy = sn * SG[4] + cs * SG[5];
  const x0 = SG[0];
  const y0 = SG[1];
  const dxl = SG[2] - SG[0];
  const dyl = SG[3] - SG[1];
  for (let q = 0; q < n; q += 1) {
    const t = (q + 0.5) / n;
    const lx = x0 + t * dxl;
    const ly = y0 + t * dyl;
    fn(b.x + cs * lx - sn * ly, b.y + sn * lx + cs * ly, nwx, nwy, len / n);
  }
}

/**
 * Wie weit vor einem Punkt der Seite (längs der Normalen, m) „knapp davor“ liegt: ein Zwanzigstel Δx — es sei denn, dort
 * ist noch eine Zelle, die dieser Körper selbst geschlossen hat, weil er sie fast ganz bedeckt (zu mindestens `closed`:
 * CLOSED, bei einem freien Körper CLOSED_FREE — die Seite steckt in ihr, ihr Rest an Fluid zählt nicht); dann knapp
 * hinter dieser Zelle. Ein freier Körper schliesst seit 2026-10-25 schon ab 0,9, der Rest reicht bis 0,1 Δx vor die
 * Seite: ohne den Schritt fand eine wachsende Eisseite dort kein Fluid und blieb bei 0,9 Δx stehen. Eine Zelle, die nur
 * an einer Wand geschlossen ist (SQUEEZE, weniger bedeckt), bleibt wie zuvor „kein Fluid“ — sonst bekäme das Wasser
 * hinter ihr an den Enden einer Seite das ganze Schmelzwasser der Seite.
 */
function frontGap(g: Grid, own: number, closed: number, wx: number, wy: number, nwx: number, nwy: number): number {
  const eps = 0.05 * g.dx;
  const c = g.cellAt(wx + eps * nwx, wy + eps * nwy);
  if (c < 0 || g.solid[c] === 0 || g.owner[c] !== own || g.fs[c] < closed) return eps;
  const i = c % g.nx;
  const j = (c - i) / g.nx;
  let t = Infinity;
  if (nwx > 1e-9) t = Math.min(t, ((i + 1) * g.dx - wx) / nwx);
  else if (nwx < -1e-9) t = Math.min(t, (i * g.dx - wx) / nwx);
  if (nwy > 1e-9) t = Math.min(t, ((j + 1) * g.dx - wy) / nwy);
  else if (nwy < -1e-9) t = Math.min(t, (j * g.dx - wy) / nwy);
  return Number.isFinite(t) ? Math.max(eps, t + eps) : eps;
}

/**
 * Die Fluidzellen vor einem Seitenstück: knapp aussen und eine Zelle weiter
 * (der dünne Fluidteil einer gemischten Zelle hat oft kein Teilchen); dazu die
 * Zelle knapp innen, wenn sie Flüssigkeit enthält — alles nur, wo aussen
 * Fluid ist (an einer Wand gehört eine gemischte Zelle innen zur
 * Nachbarseite). Jede Zelle einmal je Lauf, mit der Länge, die auf sie fällt.
 * Die Zelle eine weiter nur, wenn kein anderer Körper dazwischen liegt (seit
 * 2026-10-25: an einer Becherwand quer über zwei Zellen lag sie draussen).
 */
export function fluidFront(e: Engine, b: Body2D, seg: number, fn: (c: number, len: number) => void, far = true): void {
  const g = e.grid;
  const eps = 0.05 * g.dx;
  const closed = b.free ? CLOSED_FREE : CLOSED;
  let last = -1;
  let lastIn = -1;
  let lastFar = -1;
  along(e, b, seg, (wx, wy, nwx, nwy, len) => {
    const d = frontGap(g, b.index + 1, closed, wx, wy, nwx, nwy);
    const out = g.cellAt(wx + d * nwx, wy + d * nwy);
    if (out < 0 || g.solid[out] !== 0) { last = out; return; }
    if (out !== last) fn(out, len);
    last = out;
    if (far) {
      const fx = wx + (g.dx + d) * nwx;
      const fy = wy + (g.dx + d) * nwy;
      const fc = g.cellAt(fx, fy);
      if (fc >= 0 && fc !== out && fc !== lastFar && g.solid[fc] === 0 && !e.bodies.blocks(b, wx, wy, fx, fy)) fn(fc, len);
      lastFar = fc;
    }
    const inn = g.cellAt(wx - eps * nwx, wy - eps * nwy);
    if (inn >= 0 && inn !== out && inn !== lastIn && g.solid[inn] === 0 && g.kind[inn] === LIQUID) fn(inn, len);
    lastIn = inn;
  });
}

/** Der Gefrierpunkt vor der Seite s des Rechtecks r (K): aus dem Salz der Flüssigkeit in den Zellen davor (ohne Flüssigkeit: reines Wasser); liegt Fluid davor, kommt die Seite nach open. */
export function freezingAt(e: Engine, b: Body2D, r: number, s: number, open: Set<number>): number {
  const ex = e.exchange;
  let salt = 0;
  let water = 0;
  for (let seg = 0; seg < b.nseg; seg += 1) {
    if (b.segR[seg] !== r || b.segS[seg] !== s) continue;
    fluidFront(e, b, seg, (c) => { salt += ex.salt[c]; water += ex.water[c]; open.add(4 * r + s); });
  }
  if (!(water > 0) || !(salt > 0)) return meltsAt(b.mat);
  return freezingPoint(salt / (water * M_S));
}

/**
 * Wie viel Wärme vor der Seite s des Rechtecks r ansteht (W/K · K): Σ k (T − T_f)⁺ · Länge über die Zellen knapp
 * davor — Flüssigkeit, Gas oder ein Feststoff (eine Heizplatte, die Wand einer Zlewka, ein anderer Körper); ausserhalb
 * der Kiste nichts. Die Seiten, an denen etwas Wärmeres als T_f liegt, bekommen die Überschüsse ihrer Randzellen.
 */
export function supplyAt(e: Engine, b: Body2D, r: number, s: number, tf: number): number {
  const g = e.grid;
  const ex = e.exchange;
  const n = g.n;
  const closed = b.free ? CLOSED_FREE : CLOSED;
  let sum = 0;
  for (let seg = 0; seg < b.nseg; seg += 1) {
    if (b.segR[seg] !== r || b.segS[seg] !== s) continue;
    along(e, b, seg, (wx, wy, nwx, nwy, len) => {
      const d = frontGap(g, b.index + 1, closed, wx, wy, nwx, nwy);
      const c = g.cellAt(wx + d * nwx, wy + d * nwy);
      if (c < 0) return;
      let T: number;
      let k: number;
      if (g.solid[c] !== 0) {
        T = g.T[c];
        k = SOLIDS[g.solid[c] - 1]?.k ?? 0;
      } else if (ex.cap[c] > 0) {
        T = ex.capT[c] / ex.cap[c];
        k = kL(T);
      } else {
        T = g.T[c];
        k = kMix(g.mg[c], g.mg[n + c], g.mg[H2O * n + c], T);
      }
      if (T > tf) sum += k * (T - tf) * len;
    });
  }
  return sum;
}
