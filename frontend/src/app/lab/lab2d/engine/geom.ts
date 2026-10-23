/**
 * LABOR 2D (v2) — GEOMETRIE DER RECHTECKE (für bodyCover.ts und bodyMelt.ts):
 * wie viel eines gedrehten Rechtecks in einer Gitterzelle liegt, wie viel
 * einer Seitenfläche es bedeckt, ob es eine Zelle in zwei Teile schneidet, wo
 * eine Strecke in es eintritt (genau, Schnitt konvexer Vielecke, ohne Speicher
 * anzulegen); dazu das Neuzusammensetzen der Rechtecke eines Körpers, wenn
 * Scheiben an seinen Seiten schmelzen oder anfrieren.
 */

/* Arbeitsspeicher des Abschneidens (ein Rechteck gegen ein Quadrat hat höchstens acht Ecken). */
const ax = new Float64Array(16);
const ay = new Float64Array(16);
const bx = new Float64Array(16);
const by = new Float64Array(16);

/** Ein Vieleck (n Ecken in ax/ay) an der Halbebene s·(x oder y) ≤ s·v abschneiden (axis 0: x, 1: y; s = ±1) — Ergebnis in bx/by, Anzahl zurück. */
function clipAxis(n: number, axis: number, v: number, s: number, px: Float64Array, py: Float64Array, qx: Float64Array, qy: Float64Array): number {
  let m = 0;
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    const ci = s * ((axis === 0 ? px[i] : py[i]) - v);
    const cj = s * ((axis === 0 ? px[j] : py[j]) - v);
    if (ci <= 0) { qx[m] = px[i]; qy[m] = py[i]; m += 1; }
    if ((ci < 0 && cj > 0) || (ci > 0 && cj < 0)) {
      const t = ci / (ci - cj);
      qx[m] = px[i] + t * (px[j] - px[i]);
      qy[m] = py[i] + t * (py[j] - py[i]);
      m += 1;
    }
  }
  return m;
}

/**
 * Fläche des Vierecks (Ecken (x0, y0) … (x3, y3), gegen den Uhrzeigersinn)
 * innerhalb des achsparallelen Kastens [cx0, cx1] × [cy0, cy1] (m²).
 */
export function quadInBox(qx0: number, qy0: number, qx1: number, qy1: number, qx2: number, qy2: number, qx3: number, qy3: number,
  cx0: number, cy0: number, cx1: number, cy1: number): number {
  ax[0] = qx0; ay[0] = qy0; ax[1] = qx1; ay[1] = qy1; ax[2] = qx2; ay[2] = qy2; ax[3] = qx3; ay[3] = qy3;
  let n = clipAxis(4, 0, cx0, -1, ax, ay, bx, by);
  if (n === 0) return 0;
  n = clipAxis(n, 0, cx1, 1, bx, by, ax, ay);
  if (n === 0) return 0;
  n = clipAxis(n, 1, cy0, -1, ax, ay, bx, by);
  if (n === 0) return 0;
  n = clipAxis(n, 1, cy1, 1, bx, by, ax, ay);
  if (n < 3) return 0;
  let a = 0;
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    a += ax[i] * ay[j] - ax[j] * ay[i];
  }
  return Math.abs(0.5 * a);
}

/**
 * Der Teil [t0, t1] ⊂ [0, 1] der Strecke p + t·(q − p), der im achsparallelen
 * Rechteck [x0, x1] × [y0, y1] liegt (Liang–Barsky); out[0] = t0, out[1] = t1,
 * leer: t0 > t1. Liefert t1 − t0 (≥ 0).
 */
export function clipSegment(px: number, py: number, qx: number, qy: number, x0: number, y0: number, x1: number, y1: number, out: Float64Array): number {
  const dx = qx - px;
  const dy = qy - py;
  lb[0] = 0;
  lb[1] = 1;
  if (!edge(-dx, px - x0) || !edge(dx, x1 - px) || !edge(-dy, py - y0) || !edge(dy, y1 - py)) { out[0] = 1; out[1] = 0; return 0; }
  out[0] = lb[0];
  out[1] = lb[1];
  return Math.max(0, lb[1] - lb[0]);
}

/* Liang–Barsky: das laufende Intervall [t0, t1] in lb, eine Kante p·t ≤ q. */
const lb = new Float64Array(2);
function edge(p: number, q: number): boolean {
  if (p === 0) return q >= 0;
  const r = q / p;
  if (p < 0) { if (r > lb[1]) return false; if (r > lb[0]) lb[0] = r; }
  else { if (r < lb[0]) return false; if (r < lb[1]) lb[1] = r; }
  return true;
}

const seg = new Float64Array(2);
const arcs = new Float64Array(16);

/**
 * Schneidet das gedrehte Rechteck (im eigenen Rahmen [rx0, rx1] × [ry0, ry1],
 * Welt = (x, y) + R(a)·L) die Zelle [cx0, cx1] × [cy0, cy1] in getrennte
 * Teile? Ja, wenn es den Rand der Zelle in zwei oder mehr getrennten Bögen
 * berührt (ein konvexes Stück in einem konvexen Kasten: so viele Teile bleiben
 * übrig, wie es Bögen auf dem Rand gibt).
 */
export function splitsCell(x: number, y: number, a: number, rx0: number, ry0: number, rx1: number, ry1: number,
  cx0: number, cy0: number, cx1: number, cy1: number): boolean {
  const c = Math.cos(a);
  const s = Math.sin(a);
  /* Der Umfang der Zelle gegen den Uhrzeigersinn: unten, rechts, oben, links — je Seite das Stück im Rechteck. */
  let n = 0;
  for (let e = 0; e < 4; e += 1) {
    const sx = e === 0 ? cx0 : e === 1 ? cx1 : e === 2 ? cx1 : cx0;
    const sy = e === 0 ? cy0 : e === 1 ? cy0 : e === 2 ? cy1 : cy1;
    const ex = e === 0 ? cx1 : e === 1 ? cx1 : e === 2 ? cx0 : cx0;
    const ey = e === 0 ? cy0 : e === 1 ? cy1 : e === 2 ? cy1 : cy0;
    /* In den Rahmen des Rechtecks. */
    const lsx = c * (sx - x) + s * (sy - y);
    const lsy = -s * (sx - x) + c * (sy - y);
    const lex = c * (ex - x) + s * (ey - y);
    const ley = -s * (ex - x) + c * (ey - y);
    if (clipSegment(lsx, lsy, lex, ley, rx0, ry0, rx1, ry1, seg) <= 0) continue;
    arcs[2 * n] = e + seg[0];
    arcs[2 * n + 1] = e + seg[1];
    n += 1;
  }
  if (n < 2) return false;
  /* Aneinanderstossende Stücke (über eine Ecke, auch von der letzten Seite zur ersten) zu Bögen zusammenfassen. */
  const eps = 1e-9;
  let count = n;
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    const end = arcs[2 * i + 1];
    const start = arcs[2 * j] + (j === 0 ? 4 : 0);
    if (Math.abs(start - end) <= eps) count -= 1;
  }
  return count >= 2;
}

/** Ein achsparalleles Rechteck x0, y0, x1, y1 (m). */
export type Rect4 = readonly [number, number, number, number];

/** Eine Scheibe an einer Seite: das Rechteck und der Zug (Index), zu dem sie gehört. */
export interface Slab { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number; readonly move: number }

/** Neu zusammengesetzt: die Rechtecke und die Zellen des Koordinatengitters, die genommen oder dazugekommen sind (je fünf Zahlen: x0, y0, x1, y1, Zug). */
export interface Recomposed { rects: [number, number, number, number][]; taken: number[]; added: number[] }

/**
 * Die alten Rechtecke ohne die Schmelzscheiben, dazu die Wachsscheiben — als
 * waagrechte Streifen (je Zeile des Gitters aus allen Koordinaten die Läufe;
 * gleiche Läufe untereinander zu einem Rechteck). So bleibt die Zahl der
 * Rechtecke so klein, wie die Form es erlaubt, und eine Zerlegung ist immer
 * dieselbe für dieselbe Form. Eine Zelle des Koordinatengitters gehört zur
 * ersten Scheibe, in der ihre Mitte liegt.
 */
export function recompose(old: readonly Rect4[], melts: readonly Slab[], grows: readonly Slab[]): Recomposed {
  const xv: number[] = [];
  const yv: number[] = [];
  for (const r of old) xv.push(r[0], r[2]), yv.push(r[1], r[3]);
  for (const t of melts) xv.push(t.x0, t.x1), yv.push(t.y0, t.y1);
  for (const t of grows) xv.push(t.x0, t.x1), yv.push(t.y0, t.y1);
  const X = unique(xv);
  const Y = unique(yv);
  const nx = X.length - 1;
  const ny = Y.length - 1;
  const inNew = new Uint8Array(Math.max(0, nx * ny));
  const taken: number[] = [];
  const added: number[] = [];
  const inside = (x: number, y: number, x0: number, y0: number, x1: number, y1: number): boolean => x > x0 && x < x1 && y > y0 && y < y1;
  for (let j = 0; j < ny; j += 1) {
    const cy = 0.5 * (Y[j] + Y[j + 1]);
    for (let i = 0; i < nx; i += 1) {
      const cx = 0.5 * (X[i] + X[i + 1]);
      let was = false;
      for (const r of old) if (inside(cx, cy, r[0], r[1], r[2], r[3])) { was = true; break; }
      let by = -1;
      if (was) {
        for (const t of melts) if (inside(cx, cy, t.x0, t.y0, t.x1, t.y1)) { by = t.move; break; }
        if (by >= 0) taken.push(X[i], Y[j], X[i + 1], Y[j + 1], by);
        else inNew[i + j * nx] = 1;
      } else {
        for (const t of grows) if (inside(cx, cy, t.x0, t.y0, t.x1, t.y1)) { by = t.move; break; }
        if (by >= 0) { added.push(X[i], Y[j], X[i + 1], Y[j + 1], by); inNew[i + j * nx] = 1; }
      }
    }
  }
  const rects: [number, number, number, number][] = [];
  let open: { i0: number; i1: number; y0: number }[] = [];
  for (let j = 0; j <= ny; j += 1) {
    const next: { i0: number; i1: number; y0: number }[] = [];
    if (j < ny) {
      for (let i = 0; i < nx;) {
        if (inNew[i + j * nx] === 0) { i += 1; continue; }
        let k = i;
        while (k < nx && inNew[k + j * nx] !== 0) k += 1;
        const same = open.find((o) => o.i0 === i && o.i1 === k);
        next.push(same ?? { i0: i, i1: k, y0: Y[j] });
        i = k;
      }
    }
    for (const o of open) if (!next.includes(o)) rects.push([X[o.i0], o.y0, X[o.i1], Y[j]]);
    open = next;
  }
  return { rects, taken, added };
}

/** Aufsteigend sortiert, ohne gleiche Werte. */
function unique(v: number[]): number[] {
  v.sort((a, b) => a - b);
  const out: number[] = [];
  for (const x of v) if (out.length === 0 || x !== out[out.length - 1]) out.push(x);
  return out;
}
