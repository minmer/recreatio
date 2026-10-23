/**
 * LABOR 2D (v2) — WERKZEUGE AN KÖRPERN (seit 2026-10-23): ein Körper bleibt
 * aus Rechtecken.
 *
 * - <b>Radieren</b> (und ein neuer Bau darüber) schneidet aus jedem Rechteck
 *   den Kasten, den die Fläche im Rahmen des Körpers umschliesst (ein Kreis:
 *   sein Quadrat um die Mitte) — übrig bleiben bis zu vier Rechtecke: links,
 *   rechts, darunter, darüber. Was wegfällt, ist als Eingriff gebucht; zerfällt
 *   der Rest, wird jedes zusammenhängende Stück ein eigener Körper mit derselben
 *   Lage und Bewegung.
 * - <b>Przesuń</b> hebt jeden Körper, dessen Rechteck die Fläche trifft, als
 *   Ganzes heraus und setzt ihn versetzt wieder ein.
 * - <b>reshape</b>: neue Rechtecke im eigenen Rahmen übernehmen — die inneren
 *   Zellen neu, Energie, Film und Kruste nach dem Anteil der Fläche aus den
 *   alten (regrid ohne das Ableiten; auch das Schmelzen, bodyMelt.ts, ordnet
 *   so seine Zellen neu).
 * - <b>separate</b>: zerfallen die Rechtecke eines Körpers in getrennte Stücke
 *   (Radieren, Schmelzen), wird jedes weitere Stück ein eigener Körper.
 */

import { Body2D, meltsAt } from './body';
import type { Bodies } from './bodies';
import { bounds, type Region } from './shapes';

/** Dünner als das (Anteil der Zellkante) bleibt von einem geschnittenen Rechteck nichts. */
const SLIVER = 0.05;

export interface Removed { energy: number; film: number; crust: number }

/** Ein Rechteck im eigenen Rahmen: x0, y0, x1, y1. */
export type RectLocal = [number, number, number, number];

/**
 * Neue Rechtecke im eigenen Rahmen übernehmen: innere Zellen neu (etwa Δx),
 * Energie, Film und Kruste nach Flächenanteil aus den alten. Liefert, was in
 * keinem neuen Rechteck mehr liegt (Energie J, Film und Kruste kg); Masse,
 * Schwerpunkt, Seiten neu (derive). Dünner als SLIVER bleibt nichts.
 */
export function reshape(b: Body2D, rects: readonly RectLocal[]): Removed {
  const latent0 = b.latentOffset();
  const out = regrid(b, rects.filter(([x0, y0, x1, y1]) => x1 - x0 > SLIVER * b.dx && y1 - y0 > SLIVER * b.dx));
  b.derive();
  /* Ein schmelzender Stoff: der Versatz der weggefallenen Masse fällt mit weg. */
  out.energy += latent0 - b.latentOffset();
  return out;
}

/**
 * Wie reshape, aber ohne Ableiten und ohne Mindestgrösse (der Rahmen bleibt,
 * wo er ist — bodyMelt.ts legt danach noch Eis in Teile der neuen Zellen).
 * Liefert, was in keinem neuen Rechteck mehr liegt (ohne den Versatz).
 */
export function regrid(b: Body2D, rects: readonly RectLocal[] | readonly (readonly [number, number, number, number])[]): Removed {
  const oldXs = b.xs;
  const oldYs = b.ys;
  const oldNi = b.ni;
  const oldNj = b.nj;
  const oldOff = b.off;
  const oldNr = b.nr;
  const oldE = b.E;
  const oldF = b.film;
  const oldK = b.crust;
  let totalE = 0;
  let totalF = 0;
  let totalK = 0;
  for (let k = 0; k < b.ncell; k += 1) { totalE += oldE[k]; totalF += oldF[k]; totalK += oldK[k]; }
  const xs: Float64Array[] = [];
  const ys: Float64Array[] = [];
  for (const [x0, y0, x1, y1] of rects) {
    if (!(x1 > x0) || !(y1 > y0)) continue;
    xs.push(Body2D.splits(x0, x1, b.dx));
    ys.push(Body2D.splits(y0, y1, b.dx));
  }
  b.setRects(xs, ys);
  let keptE = 0;
  let keptF = 0;
  let keptK = 0;
  for (let r = 0; r < b.nr; r += 1) {
    const nxs = b.xs[r];
    const nys = b.ys[r];
    for (let q = 0; q < b.nj[r]; q += 1) {
      for (let p = 0; p < b.ni[r]; p += 1) {
        const k = b.off[r] + p + q * b.ni[r];
        const ax0 = nxs[p], ax1 = nxs[p + 1], ay0 = nys[q], ay1 = nys[q + 1];
        for (let o = 0; o < oldNr; o += 1) {
          const oxs = oldXs[o];
          const oys = oldYs[o];
          if (oxs[0] >= ax1 || oxs[oldNi[o]] <= ax0 || oys[0] >= ay1 || oys[oldNj[o]] <= ay0) continue;
          for (let oq = 0; oq < oldNj[o]; oq += 1) {
            const oy = Math.min(ay1, oys[oq + 1]) - Math.max(ay0, oys[oq]);
            if (oy <= 0) continue;
            for (let op = 0; op < oldNi[o]; op += 1) {
              const ox = Math.min(ax1, oxs[op + 1]) - Math.max(ax0, oxs[op]);
              if (ox <= 0) continue;
              const ok = oldOff[o] + op + oq * oldNi[o];
              const share = (ox * oy) / ((oxs[op + 1] - oxs[op]) * (oys[oq + 1] - oys[oq]));
              b.E[k] += share * oldE[ok];
              b.film[k] += share * oldF[ok];
              b.crust[k] += share * oldK[ok];
            }
          }
        }
        keptE += b.E[k];
        keptF += b.film[k];
        keptK += b.crust[k];
      }
    }
  }
  return { energy: totalE - keptE, film: totalF - keptF, crust: totalK - keptK };
}

/** Das Rechteck [x0, y0, x1, y1] ohne den Kasten [cx0, cy0, cx1, cy1]: bis zu vier Rechtecke (links, rechts, darunter, darüber). */
function cut(r: RectLocal, cx0: number, cy0: number, cx1: number, cy1: number): RectLocal[] | null {
  const [x0, y0, x1, y1] = r;
  if (cx1 <= x0 || cx0 >= x1 || cy1 <= y0 || cy0 >= y1) return null;
  const out: RectLocal[] = [];
  const mx0 = Math.max(x0, cx0);
  const mx1 = Math.min(x1, cx1);
  if (cx0 > x0) out.push([x0, y0, cx0, y1]);
  if (cx1 < x1) out.push([cx1, y0, x1, y1]);
  if (cy0 > y0) out.push([mx0, y0, mx1, cy0]);
  if (cy1 < y1) out.push([mx0, cy1, mx1, y1]);
  return out;
}

/** Zusammenhängende Gruppen von Rechtecken (verbunden, wenn sie sich an einer Seite mit einem Stück berühren). */
function groups(rects: readonly RectLocal[], tol: number): number[][] {
  const n = rects.length;
  const id = new Int32Array(n).fill(-1);
  const out: number[][] = [];
  for (let s = 0; s < n; s += 1) {
    if (id[s] >= 0) continue;
    const g: number[] = [s];
    id[s] = out.length;
    for (let q = 0; q < g.length; q += 1) {
      const [ax0, ay0, ax1, ay1] = rects[g[q]];
      for (let o = 0; o < n; o += 1) {
        if (id[o] >= 0) continue;
        const [bx0, by0, bx1, by1] = rects[o];
        const touchX = (Math.abs(ax1 - bx0) <= tol || Math.abs(bx1 - ax0) <= tol) && Math.min(ay1, by1) - Math.max(ay0, by0) > tol;
        const touchY = (Math.abs(ay1 - by0) <= tol || Math.abs(by1 - ay0) <= tol) && Math.min(ax1, bx1) - Math.max(ax0, bx0) > tol;
        const overlap = Math.min(ax1, bx1) - Math.max(ax0, bx0) > tol && Math.min(ay1, by1) - Math.max(ay0, by0) > tol;
        if (touchX || touchY || overlap) { id[o] = out.length; g.push(o); }
      }
    }
    out.push(g);
  }
  return out;
}

/**
 * Den Teil der Körper entfernen, den eine Fläche bedeckt (Radieren, ein neuer
 * Bau darüber): je Rechteck der umschliessende Kasten der Fläche im Rahmen des
 * Körpers. Gebucht als Eingriff; zerfällt ein Körper, werden die weiteren
 * Stücke eigene Körper. Liefert, ob ein Körper sich änderte.
 */
export function carveBodies(bodies: Bodies, region: Region, ledger: { energy: number; water: number; salt: number }): boolean {
  const list = bodies.list;
  const count = list.length;
  const l = new Float64Array(2);
  let any = false;
  for (let q = 0; q < count; q += 1) {
    const b = list[q];
    if (b.gone) continue;
    /* Der Kasten der Fläche im Rahmen des Körpers: ein Kreis um seine Mitte, sonst die gedrehten Ecken der Umgrenzung. */
    let cx0 = Infinity, cy0 = Infinity, cx1 = -Infinity, cy1 = -Infinity;
    if ('circle' in region) {
      const [x, y, r] = region.circle;
      Body2D.toLocal(b.x, b.y, b.a, x, y, l);
      cx0 = l[0] - r; cx1 = l[0] + r; cy0 = l[1] - r; cy1 = l[1] + r;
    } else {
      const [x0, y0, x1, y1] = bounds(region);
      for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) {
        Body2D.toLocal(b.x, b.y, b.a, x, y, l);
        cx0 = Math.min(cx0, l[0]); cx1 = Math.max(cx1, l[0]); cy0 = Math.min(cy0, l[1]); cy1 = Math.max(cy1, l[1]);
      }
    }
    const rects: RectLocal[] = [];
    let changed = false;
    for (let r = 0; r < b.nr; r += 1) {
      const rect = b.bounds(r);
      const pieces = cut(rect, cx0, cy0, cx1, cy1);
      if (pieces === null) { rects.push(rect); continue; }
      changed = true;
      for (const p of pieces) rects.push(p);
    }
    if (!changed) continue;
    any = true;
    bodies.cover.release(b);
    /* Was in keinem Stück liegt, ist weg (gebucht): die Stücke zählen nach b's alter Energie; Eis ist Wasser. */
    const ice = meltsAt(b.mat) > 0;
    const before = { E: b.energy(), F: b.filmMass(), K: b.crustMass(), M: ice ? b.m : 0 };
    const pieces = separate(bodies, b, rects.filter((r) => r[2] - r[0] > SLIVER * b.dx && r[3] - r[1] > SLIVER * b.dx));
    let piecesE = 0;
    let piecesF = 0;
    let piecesK = 0;
    let piecesM = 0;
    for (const pc of pieces) { piecesE += pc.energy(); piecesF += pc.filmMass(); piecesK += pc.crustMass(); piecesM += ice ? pc.m : 0; }
    ledger.energy -= before.E - b.energy() - piecesE;
    ledger.water -= before.F - b.filmMass() - piecesF + (ice ? before.M - b.m - piecesM : 0);
    ledger.salt -= before.K - b.crustMass() - piecesK;
    if (b.gone || b.ncell === 0) { b.gone = true; b.ncell = 0; }
    else { bodies.cover.weigh(b); bodies.cover.addCells(b); }
  }
  if (any) bodies.changed();
  return any;
}

/**
 * Die Rechtecke rects (im Rahmen von b) übernehmen; zerfallen sie in getrennte
 * Gruppen (Radieren, Schmelzen), wird jede weitere ein eigener Körper —
 * gleicher Rahmen, gleiche Lage und Bewegung, Energie, Film und Kruste nach
 * Fläche aus b's Zellen; b behält die erste. Liefert die neuen Körper (schon
 * in der Liste und im Gitter vorgemerkt). always = false: hängt alles
 * zusammen, bleibt b unberührt (Schmelzen fragt nur nach).
 */
export function separate(bodies: Bodies, b: Body2D, rects: readonly RectLocal[], always = true): Body2D[] {
  const list = bodies.list;
  const parts = groups(rects, 1e-6 * b.dx);
  const out: Body2D[] = [];
  if (!always && parts.length <= 1) return out;
  for (let p = 1; p < parts.length; p += 1) {
    const piece = new Body2D(list.length, b.key, b.dx, b.depth);
    piece.mat = b.mat;
    piece.heater = b.heater;
    /* Gleicher Rahmen wie b, die Energie aus b's inneren Zellen (reshape überträgt sie aus den alten). */
    piece.xs = b.xs.map((a) => a.slice());
    piece.ys = b.ys.map((a) => a.slice());
    piece.nr = b.nr;
    piece.ni = b.ni.slice();
    piece.nj = b.nj.slice();
    piece.off = b.off.slice();
    piece.ncell = b.ncell;
    piece.E = b.E.slice();
    piece.film = b.film.slice();
    piece.crust = b.crust.slice();
    piece.x = b.x;
    piece.y = b.y;
    piece.a = b.a;
    piece.m = b.m;
    reshape(piece, parts[p].map((k) => rects[k]));
    piece.rx = piece.x;
    piece.ry = piece.y;
    piece.ra = piece.a;
    piece.pinned = b.pinned;
    piece.asleep = b.asleep;
    piece.vx = b.vx;
    piece.vy = b.vy;
    piece.w = b.w;
    list.push(piece);
    bodies.grow();
    bodies.cover.weigh(piece);
    bodies.cover.addCells(piece);
    out.push(piece);
  }
  reshape(b, parts.length > 0 ? parts[0].map((k) => rects[k]) : []);
  b.rx = b.x;
  b.ry = b.y;
  b.ra = b.a;
  return out;
}

/** Werkzeug „Przesuń“, erster Teil: jeder Körper, dessen Rechteck die Fläche trifft, wird aus dem Gitter gehoben (liefert sie). */
export function liftBodies(bodies: Bodies, region: Region, pick?: (b: Body2D) => boolean): Body2D[] {
  const [x0, y0, x1, y1] = bounds(region);
  const out: Body2D[] = [];
  const box = new Float64Array(4);
  for (const b of bodies.list) {
    if (b.gone || (pick !== undefined && !pick(b))) continue;
    b.worldBox(b.x, b.y, b.a, box);
    /* Nur, was wirklich in der Fläche liegt (eine Platte, auf der die Zlewka steht, berührt deren Fläche nur). */
    const tol = 1e-3 * b.dx;
    if (box[0] >= x1 - tol || box[2] <= x0 + tol || box[1] >= y1 - tol || box[3] <= y0 + tol) continue;
    bodies.cover.release(b);
    out.push(b);
  }
  return out;
}

/** Einen Körper ganz wegnehmen (Handgriff „remove“): seine Energie, sein Film, seine Kruste und Eis als Wasser gehen hinaus (gebucht). */
export function removeBody(bodies: Bodies, b: Body2D, ledger: { energy: number; water: number; salt: number }): void {
  if (b.gone) return;
  bodies.cover.release(b);
  ledger.energy -= b.energy();
  ledger.water -= b.filmMass() + (meltsAt(b.mat) > 0 ? b.m : 0);
  ledger.salt -= b.crustMass();
  b.gone = true;
  b.ncell = 0;
  bodies.changed();
}

/** Zweiter Teil: um (dx, dy) Meter versetzt wieder hinein (die Teilchen hat der Aufrufer mit verschoben); was dann in einem Rechteck liegt, hinaus. */
export function placeBodies(bodies: Bodies, lifted: readonly Body2D[], dx: number, dy: number): void {
  for (const b of lifted) {
    b.x += dx;
    b.y += dy;
    b.rx = b.x;
    b.ry = b.y;
    b.ra = b.a;
    bodies.cover.weigh(b);
    bodies.cover.addCells(b);
  }
  if (lifted.length > 0) bodies.changed();
}
