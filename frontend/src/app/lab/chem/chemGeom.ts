/**
 * 2026-10-18 — DIE GESTALT DES GLASES (Chemia): das Innere eines Gefässes als
 * Vieleck, was unter einem Punkt steht (für den Finger), wo die Lippe beim
 * Ausgiessen ist, der Weg eines Schlauchs, und die Flüssigkeit im geneigten
 * Glas (der Spiegel bleibt waagrecht: gleiche Fläche, neu beschnitten).
 */

import type { Burner, Lab, Link } from './chemBench';
import type { Vessel } from './chemVessel';

/* -- Geometrie (auch für das Treffen mit dem Finger) ---------------------------------------------- */

export type Pt = readonly [number, number];

/** Das Innere eines Gefässes (lokal: Mitte des Bodens = 0). */
export function interior(v: Vessel): Pt[] {
  const s = v.shape;
  const N = v.kind === 'beaker' || v.kind === 'cylinder' ? 6 : 28;
  const pts: Pt[] = [];
  for (let i = N; i >= 0; i -= 1) { const h = (i / N) * s.H; pts.push([-s.halfWidth(h), h]); }
  for (let i = 0; i <= N; i += 1) { const h = (i / N) * s.H; pts.push([s.halfWidth(h), h]); }
  return pts;
}

/** Welches Gefäss unter einem Punkt (cm) steht — das oberste zuerst. */
export function vesselAt(lab: Lab, x: number, y: number, slop = 0.6): Vessel | null {
  for (let i = lab.vessels.length - 1; i >= 0; i -= 1) {
    const v = lab.vessels[i];
    if (v.kind === 'syringe') {
      const g = syringeGeom(v);
      if (x > g.x0 - 1.5 - slop && x < g.x0 + g.L + 3 && Math.abs(y - g.y) < g.R + 1 + slop) return v;
      continue;
    }
    const lx = x - v.x;
    const ly = y - v.y;
    if (ly < -1.2 - slop || ly > v.shape.H + 1.4 + slop) continue;
    if (Math.abs(lx) <= Math.max(1.1, v.shape.halfWidth(Math.max(0, Math.min(v.shape.H, ly)))) + 0.4 + slop) return v;
  }
  return null;
}

export function burnerAt(lab: Lab, x: number, y: number): Burner | null {
  return lab.burners.find((b) => Math.abs(x - b.x) < 3.6 && y > -0.5 && y < 15.5) ?? null;
}

/** Die Gasspritze liegt waagrecht: Zylinder von x0 über L, Mitte auf Höhe y. */
export function syringeGeom(v: Vessel): { x0: number; L: number; R: number; y: number } {
  const L = v.shape.H;
  return { x0: v.x - L / 2, L, R: v.shape.R, y: v.y + 4 + v.shape.R };
}

/** Der Weg eines Schlauchs (Welt-cm). */
export function linkPath(lab: Lab, k: Link): Pt[] | null {
  const a = lab.vessel(k.from);
  const b = lab.vessel(k.to);
  if (a === undefined || b === undefined) return null;
  const aTop = a.y + a.shape.H + 0.7;
  if (b.kind === 'syringe') {
    const g = syringeGeom(b);
    const top = Math.max(aTop + 3, g.y + 3);
    return [[a.x, aTop - 1.2], [a.x, top], [g.x0 - 3, top], [g.x0 - 3, g.y], [g.x0 - 0.8, g.y]];
  }
  const bTop = b.y + b.shape.H;
  const top = Math.max(aTop, bTop) + 4;
  const end = b.wet() ? b.y + 0.6 : b.y + b.shape.H * 0.6;
  const bx = b.x + Math.min(0.5, b.shape.halfWidth(b.shape.H) * 0.4);
  return [[a.x, aTop - 1.2], [a.x, top], [bx, top], [bx, end]];
}

/* -- Polygone ------------------------------------------------------------------------------------- */

function clipBelow(poly: readonly Pt[], nx: number, ny: number, c: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i += 1) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const dp = nx * p[0] + ny * p[1] - c;
    const dq = nx * q[0] + ny * q[1] - c;
    if (dp <= 0) out.push(p);
    if ((dp < 0 && dq > 0) || (dp > 0 && dq < 0)) {
      const t = dp / (dp - dq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}

const area = (poly: readonly Pt[]): number => {
  let s = 0;
  for (let i = 0; i < poly.length; i += 1) { const p = poly[i]; const q = poly[(i + 1) % poly.length]; s += p[0] * q[1] - q[0] * p[1]; }
  return Math.abs(s) / 2;
};

/** Die Flüssigkeit im (vielleicht geneigten) Gefäss — der Spiegel bleibt waagrecht in der Welt. */
export function liquidPoly(v: Vessel, inner: readonly Pt[], level: number): { poly: Pt[]; nx: number; ny: number; c: number } {
  if (Math.abs(v.angle) < 1e-3) return { poly: clipBelow(inner, 0, 1, level), nx: 0, ny: 1, c: level };
  const a0 = area(clipBelow(inner, 0, 1, level));
  const nx = Math.sin(v.angle);
  const ny = Math.cos(v.angle);
  let lo = Math.min(...inner.map((p) => nx * p[0] + ny * p[1]));
  let hi = Math.max(...inner.map((p) => nx * p[0] + ny * p[1]));
  for (let i = 0; i < 26; i += 1) {
    const mid = (lo + hi) / 2;
    if (area(clipBelow(inner, nx, ny, mid)) < a0) lo = mid; else hi = mid;
  }
  const c = (lo + hi) / 2;
  return { poly: clipBelow(inner, nx, ny, c), nx, ny, c };
}

export const path = (ctx: CanvasRenderingContext2D, pts: readonly Pt[], close = true) => {
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])));
  if (close) ctx.closePath();
};

/** Wo die Lippe beim Ausgiessen ist (lokal) — um sie dreht sich das Gefäss. */
export const pivotOf = (v: Vessel): Pt => [(v.angle < 0 ? 1 : -1) * v.shape.halfWidth(v.shape.H), v.shape.H];

/** Ein Punkt des Gefässes (lokal) in der Welt — mit Neigung. */
export function toWorld(v: Vessel, lx: number, ly: number): Pt {
  if (v.angle === 0) return [v.x + lx, v.y + ly];
  const [px, py] = pivotOf(v);
  const c = Math.cos(v.angle);
  const s = Math.sin(v.angle);
  const dx = lx - px;
  const dy = ly - py;
  return [v.x + px + dx * c - dy * s, v.y + py + dx * s + dy * c];
}
