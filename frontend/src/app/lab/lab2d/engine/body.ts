/**
 * LABOR 2D (v2) — EIN KÖRPER (M3a, SANDBOX.md §6): ein Ding als Ganzes — eine
 * Zlewka, eine Heizplatte, ein Holzklotz, ein Eiswürfel. Er besteht aus Voxeln
 * in seinem eigenen Rahmen, mit der Kante Δx des Gitters; jedes Voxel trägt
 * Werkstoff, Energie (J, samt Film und Kruste), Heizgruppe, Wasserfilm und
 * Salzkruste (kg). Dazu kommen Lage (Schwerpunkt, Winkel), Geschwindigkeit,
 * Masse, Trägheitsmoment, die Kanten seines Umrisses (für die Kräfte der
 * Flüssigkeit) und konvexe Teile (für die Berührungen).
 *
 * Der eigene Rahmen ist das Gitter, in dem der Körper entstand: Voxel (i, j)
 * hat dort die Mitte ((i + ½)Δx, (j + ½)Δx), (cx, cy) ist der Schwerpunkt.
 * In der Welt liegt ein Punkt L des Rahmens bei (x, y) + R(a)·(L − (cx, cy)).
 * Ändert sich die Masse (ein Teil wird ausradiert), rückt der Schwerpunkt; die
 * Lage wird so nachgeführt, dass kein Voxel springt.
 *
 * Angeheftet oder schlafend steht ein Körper als feste Zellen im Gitter wie
 * jeder Bau — dann sind die Zellen sein Zustand. Wach wird er in jedem Schritt
 * neu ins Gitter geschrieben (bodyRaster.ts), und seine Voxel sind der Zustand.
 * Alles hier sind Zahlen und typisierte Felder: ein Schlüsselbild (clip/
 * snapshot.ts) nimmt einen Körper so auf, wie er ist.
 */

import { hull, type Pt } from '../../physics/physShapes';
import type { Grid } from './grid';
import { SOLIDS } from './materials';

/** Gestalt für die Berührungen: allgemein (Rechtecke aus den Voxeln) oder eine Scheibe (ein Kreis um den Schwerpunkt). */
export const SHAPE_VOXELS = 0;
export const SHAPE_DISC = 1;

export class Body2D {
  /** Werkstoff je Voxel (Index in SOLIDS), Energie (J), Heizgruppe (−1: keine), Film und Kruste (kg). */
  nv = 0;
  vi: Int32Array = new Int32Array(0);
  vj: Int32Array = new Int32Array(0);
  mat: Uint8Array = new Uint8Array(0);
  E: Float64Array = new Float64Array(0);
  heater: Int16Array = new Int16Array(0);
  film: Float64Array = new Float64Array(0);
  crust: Float64Array = new Float64Array(0);
  /** Belegung des umschliessenden Rechtecks im eigenen Rahmen: Voxel + 1 (0: leer). */
  bi0 = 0;
  bj0 = 0;
  bw = 0;
  bh = 0;
  occ: Int32Array = new Int32Array(0);
  /** Schwerpunkt im eigenen Rahmen (m); Lage in der Welt: Schwerpunkt und Winkel (rad, gegen den Uhrzeigersinn). */
  cx = 0;
  cy = 0;
  x = 0;
  y = 0;
  a = 0;
  vx = 0;
  vy = 0;
  w = 0;
  /** Die Geschwindigkeit, mit der die Flüssigkeit den Körper in diesem Schritt sah (Randwert der Projektionen). */
  ux = 0;
  uy = 0;
  uw = 0;
  /** Masse (kg) und Trägheitsmoment um den Schwerpunkt (kg·m²) — nur die Voxel. */
  m = 0;
  I = 0;
  /** Mitbewegte Masse und Trägheit der Flüssigkeit (Schätzung für den ersten Schritt nach dem Aufwachen, bodyForces.ts). */
  ma = 0;
  Ia = 0;
  /** Die mitbewegte Masse, wie die Projektion sie sieht (bodies.ts): symmetrische 3 × 3-Matrix (x, y, Drehung) als m00, m01, m02, m11, m12, m22; gilt, wenn maOk. */
  ma6: Float64Array = new Float64Array(6);
  maOk = false;
  /** Angeheftet (unendlich schwer, bewegt sich nie), schlafend (steht als Bau im Gitter, bis ihn etwas weckt), nicht mehr da. */
  pinned = true;
  asleep = true;
  gone = false;
  /** Wie lange er schon ruht (s) — ab einer halben Sekunde schläft er ein. */
  rest = 0;
  /** Lage beim letzten Schreiben ins Gitter (für das Hinausschieben der Teilchen). */
  rx = 0;
  ry = 0;
  ra = 0;
  /** Kanten des Umrisses: Mitte relativ zum Schwerpunkt im eigenen Rahmen und Richtung (0 −x, 1 +x, 2 −y, 3 +y). */
  ne = 0;
  ex: Float64Array = new Float64Array(0);
  ey: Float64Array = new Float64Array(0);
  ed: Uint8Array = new Uint8Array(0);
  /** Konvexe Teile für die Berührungen: Rechtecke (x0, y0, x1, y1) relativ zum Schwerpunkt; bei einer Scheibe ein Kreis. */
  np = 0;
  parts: Float64Array = new Float64Array(0);
  shape = SHAPE_VOXELS;
  radius = 0;
  /** Konvexe Hülle: Fläche (m²) und Flächenträgheitsmoment um den Schwerpunkt (m⁴) — für die mitbewegte Masse. */
  hullA = 0;
  hullJ = 0;
  /** Weiteste Ecke vom Schwerpunkt (m). */
  rmax = 0;
  /** Im Gitter: eigene Zellen, ihre Werte nach dem Schreiben (Energie, Film, Kruste), Gewichte Voxel → Zelle, gesetzte Flächen. */
  nc = 0;
  cells: Int32Array = new Int32Array(0);
  E0: Float64Array = new Float64Array(0);
  F0: Float64Array = new Float64Array(0);
  K0: Float64Array = new Float64Array(0);
  nw = 0;
  wv: Int32Array = new Int32Array(0);
  wc: Int32Array = new Int32Array(0);
  ww: Float64Array = new Float64Array(0);
  nf = 0;
  faces: Int32Array = new Int32Array(0);

  constructor(readonly index: number, public key: number, readonly dx: number, readonly depth: number) {}

  get free(): boolean { return !this.pinned && !this.gone; }
  get awake(): boolean { return !this.pinned && !this.asleep && !this.gone; }

  /** Die Voxel setzen (Felder werden übernommen, nicht kopiert) und alles Abgeleitete neu. */
  setVoxels(n: number, vi: Int32Array, vj: Int32Array, mat: Uint8Array, E: Float64Array, heater: Int16Array, film: Float64Array, crust: Float64Array): void {
    this.nv = n;
    this.vi = vi;
    this.vj = vj;
    this.mat = mat;
    this.E = E;
    this.heater = heater;
    this.film = film;
    this.crust = crust;
    this.derive();
  }

  /** Masse, Schwerpunkt, Trägheit, Belegung, Kanten, Teile und Hülle aus den Voxeln; die Lage folgt einem gerückten Schwerpunkt. */
  derive(): void {
    const { dx, depth, nv, vi, vj, mat } = this;
    let i0 = Infinity, j0 = Infinity, i1 = -Infinity, j1 = -Infinity;
    let m = 0, mx = 0, my = 0;
    const v = dx * dx * depth;
    for (let k = 0; k < nv; k += 1) {
      const mk = SOLIDS[mat[k]].rho * v;
      m += mk;
      mx += mk * (vi[k] + 0.5) * dx;
      my += mk * (vj[k] + 0.5) * dx;
      if (vi[k] < i0) i0 = vi[k];
      if (vi[k] > i1) i1 = vi[k];
      if (vj[k] < j0) j0 = vj[k];
      if (vj[k] > j1) j1 = vj[k];
    }
    if (nv === 0) { this.m = 0; this.I = 0; this.bw = 0; this.bh = 0; this.ne = 0; this.np = 0; this.rmax = 0; this.gone = true; return; }
    const cx = mx / m;
    const cy = my / m;
    /* Rückt der Schwerpunkt, rückt die Lage mit (die Voxel bleiben, wo sie in der Welt sind). */
    if (this.m > 0) {
      const c = Math.cos(this.a);
      const s = Math.sin(this.a);
      const ddx = cx - this.cx;
      const ddy = cy - this.cy;
      this.x += c * ddx - s * ddy;
      this.y += s * ddx + c * ddy;
      this.rx += c * ddx - s * ddy;
      this.ry += s * ddx + c * ddy;
    }
    this.cx = cx;
    this.cy = cy;
    this.m = m;
    let I = 0;
    for (let k = 0; k < nv; k += 1) {
      const lx = (vi[k] + 0.5) * dx - cx;
      const ly = (vj[k] + 0.5) * dx - cy;
      I += SOLIDS[mat[k]].rho * v * (lx * lx + ly * ly + (dx * dx) / 6);
    }
    this.I = I;
    /* Belegung. */
    this.bi0 = i0;
    this.bj0 = j0;
    this.bw = i1 - i0 + 1;
    this.bh = j1 - j0 + 1;
    this.occ = new Int32Array(this.bw * this.bh);
    for (let k = 0; k < nv; k += 1) this.occ[vi[k] - i0 + (vj[k] - j0) * this.bw] = k + 1;
    this.edges();
    this.buildParts();
    this.buildHull();
  }

  /** Voxel an (i, j) des eigenen Rahmens (−1: leer). */
  voxel(i: number, j: number): number {
    const a = i - this.bi0;
    const b = j - this.bj0;
    if (a < 0 || b < 0 || a >= this.bw || b >= this.bh) return -1;
    return this.occ[a + b * this.bw] - 1;
  }

  /** Voxel an einem Punkt relativ zum Schwerpunkt im eigenen Rahmen (−1: keins). */
  voxelAtLocal(lx: number, ly: number): number {
    return this.voxel(Math.floor((lx + this.cx) / this.dx), Math.floor((ly + this.cy) / this.dx));
  }

  /** Welt → eigener Rahmen (relativ zum Schwerpunkt), bei der Lage (x, y, a). */
  static toLocal(x: number, y: number, a: number, wx: number, wy: number, out: Float64Array): void {
    const c = Math.cos(a);
    const s = Math.sin(a);
    const dx = wx - x;
    const dy = wy - y;
    out[0] = c * dx + s * dy;
    out[1] = -s * dx + c * dy;
  }

  /** Eigener Rahmen (relativ zum Schwerpunkt) → Welt, bei der Lage (x, y, a). */
  static toWorld(x: number, y: number, a: number, lx: number, ly: number, out: Float64Array): void {
    const c = Math.cos(a);
    const s = Math.sin(a);
    out[0] = x + c * lx - s * ly;
    out[1] = y + s * lx + c * ly;
  }

  /** Um einen Punkt der Welt drehen (Winkel θ, rad) — für Körper, die schräg entstehen. */
  rotateAbout(px: number, py: number, theta: number): void {
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    const dx = this.x - px;
    const dy = this.y - py;
    this.x = px + c * dx - s * dy;
    this.y = py + s * dx + c * dy;
    this.a += theta;
  }

  /** Höchste Geschwindigkeit eines Punkts des Körpers (m/s). */
  speed(): number {
    return Math.hypot(this.vx, this.vy) + Math.abs(this.w) * this.rmax;
  }

  /** Bewegungsenergie (J). */
  kinetic(): number {
    return 0.5 * this.m * (this.vx * this.vx + this.vy * this.vy) + 0.5 * this.I * this.w * this.w;
  }

  /** Die Voxel in zusammenhängende Stücke (über Seiten verbunden): je Voxel die Nummer seines Stücks; liefert die Anzahl. */
  components(out: Int32Array): number {
    const { nv, vi, vj } = this;
    out.fill(-1, 0, nv);
    const stack = new Int32Array(nv);
    let count = 0;
    for (let s = 0; s < nv; s += 1) {
      if (out[s] >= 0) continue;
      let top = 0;
      stack[top++] = s;
      out[s] = count;
      while (top > 0) {
        const k = stack[--top];
        for (let d = 0; d < 4; d += 1) {
          const nb = this.voxel(vi[k] + (d === 0 ? -1 : d === 1 ? 1 : 0), vj[k] + (d === 2 ? -1 : d === 3 ? 1 : 0));
          if (nb >= 0 && out[nb] < 0) { out[nb] = count; stack[top++] = nb; }
        }
      }
      count += 1;
    }
    return count;
  }

  /** Nur die Voxel behalten, für die keep(k) gilt (die Felder schrumpfen; Abgeleitetes neu). */
  keepVoxels(keep: (k: number) => boolean): void {
    const idx: number[] = [];
    for (let k = 0; k < this.nv; k += 1) if (keep(k)) idx.push(k);
    const pick = <T extends Int32Array | Uint8Array | Int16Array | Float64Array>(a: T, make: (n: number) => T): T => {
      const b = make(idx.length);
      idx.forEach((k, q) => { b[q] = a[k]; });
      return b;
    };
    this.setVoxels(idx.length,
      pick(this.vi, (n) => new Int32Array(n)), pick(this.vj, (n) => new Int32Array(n)), pick(this.mat, (n) => new Uint8Array(n)),
      pick(this.E, (n) => new Float64Array(n)), pick(this.heater, (n) => new Int16Array(n)),
      pick(this.film, (n) => new Float64Array(n)), pick(this.crust, (n) => new Float64Array(n)));
  }

  /* -- Abgeleitetes ------------------------------------------------------------------------------- */

  /** Die Kanten zwischen einem Voxel und einem leeren Platz. */
  private edges(): void {
    const { nv, vi, vj, dx, cx, cy } = this;
    let ne = 0;
    for (let k = 0; k < nv; k += 1) {
      for (let d = 0; d < 4; d += 1) if (this.voxel(vi[k] + (d === 0 ? -1 : d === 1 ? 1 : 0), vj[k] + (d === 2 ? -1 : d === 3 ? 1 : 0)) < 0) ne += 1;
    }
    this.ne = ne;
    this.ex = new Float64Array(ne);
    this.ey = new Float64Array(ne);
    this.ed = new Uint8Array(ne);
    let e = 0;
    let rmax = 0;
    for (let k = 0; k < nv; k += 1) {
      const mx = (vi[k] + 0.5) * dx - cx;
      const my = (vj[k] + 0.5) * dx - cy;
      for (let d = 0; d < 4; d += 1) {
        if (this.voxel(vi[k] + (d === 0 ? -1 : d === 1 ? 1 : 0), vj[k] + (d === 2 ? -1 : d === 3 ? 1 : 0)) >= 0) continue;
        this.ex[e] = mx + (d === 0 ? -0.5 : d === 1 ? 0.5 : 0) * dx;
        this.ey[e] = my + (d === 2 ? -0.5 : d === 3 ? 0.5 : 0) * dx;
        this.ed[e] = d;
        e += 1;
      }
      rmax = Math.max(rmax, Math.hypot(Math.abs(mx) + 0.5 * dx, Math.abs(my) + 0.5 * dx));
    }
    this.rmax = rmax;
  }

  /**
   * Konvexe Teile: eine Scheibe bleibt ein Kreis um den Schwerpunkt (solange
   * er in ihrer Mitte liegt), sonst Rechtecke — Läufe je Zeile, gleiche Läufe
   * übereinander verschmolzen (eine Zlewka wird so zu drei Kästen).
   */
  private buildParts(): void {
    if (this.shape === SHAPE_DISC && this.radius > 0) {
      this.np = 1;
      this.parts = new Float64Array([-this.radius, -this.radius, this.radius, this.radius]);
      return;
    }
    const { bw, bh, bi0, bj0, dx, cx, cy } = this;
    const out: number[] = [];
    /* Offene Rechtecke: Lauf [a, b] der vorigen Zeile → Anfangszeile. */
    let open = new Map<number, number>();
    const close = (key: number, jStart: number, jEnd: number): void => {
      const a = key >> 16;
      const b = key & 0xffff;
      out.push((bi0 + a) * dx - cx, (bj0 + jStart) * dx - cy, (bi0 + b + 1) * dx - cx, (bj0 + jEnd + 1) * dx - cy);
    };
    for (let j = 0; j <= bh; j += 1) {
      const next = new Map<number, number>();
      if (j < bh) {
        let i = 0;
        while (i < bw) {
          if (this.occ[i + j * bw] === 0) { i += 1; continue; }
          let e = i;
          while (e + 1 < bw && this.occ[e + 1 + j * bw] !== 0) e += 1;
          const key = (i << 16) | e;
          next.set(key, open.has(key) ? (open.get(key) as number) : j);
          i = e + 1;
        }
      }
      for (const [key, start] of open) if (!next.has(key) || next.get(key) !== start) close(key, start, j - 1);
      open = next;
    }
    this.np = out.length / 4;
    this.parts = Float64Array.from(out);
  }

  /** Konvexe Hülle der Voxelecken: Fläche und Flächenträgheitsmoment um den Schwerpunkt. */
  private buildHull(): void {
    const pts: Pt[] = [];
    for (let e = 0; e < this.ne; e += 1) {
      const d = this.ed[e];
      const h = 0.5 * this.dx;
      const x = this.ex[e];
      const y = this.ey[e];
      if (d < 2) { pts.push([x, y - h], [x, y + h]); } else { pts.push([x - h, y], [x + h, y]); }
    }
    const H = hull(pts);
    let area = 0;
    let J = 0;
    for (let i = 0; i < H.length; i += 1) {
      const [x1, y1] = H[i];
      const [x2, y2] = H[(i + 1) % H.length];
      const c = x1 * y2 - x2 * y1;
      area += c / 2;
      J += (c * (x1 * x1 + x1 * x2 + x2 * x2 + y1 * y1 + y1 * y2 + y2 * y2)) / 12;
    }
    this.hullA = Math.abs(area);
    this.hullJ = Math.abs(J);
  }

  /* -- Entstehen ---------------------------------------------------------------------------------- */

  /** Ein Körper aus festen Zellen des Gitters (so, wie ein Handgriff sie eben gemalt hat): ein Voxel je Zelle, Lage ungedreht. */
  static fromCells(index: number, key: number, g: Grid, cells: readonly number[]): Body2D {
    const b = new Body2D(index, key, g.dx, g.depth);
    const n = cells.length;
    const vi = new Int32Array(n);
    const vj = new Int32Array(n);
    const mat = new Uint8Array(n);
    const E = new Float64Array(n);
    const heater = new Int16Array(n);
    const film = new Float64Array(n);
    const crust = new Float64Array(n);
    cells.forEach((c, k) => {
      vi[k] = c % g.nx;
      vj[k] = Math.floor(c / g.nx);
      mat[k] = g.solid[c] - 1;
      E[k] = g.Es[c];
      heater[k] = g.heater[c];
      film[k] = g.film[c];
      crust[k] = g.crust[c];
    });
    b.setVoxels(n, vi, vj, mat, E, heater, film, crust);
    /* Ungedreht im Gitter, in dem er entstand: der Schwerpunkt liegt in der Welt, wo er im eigenen Rahmen liegt. */
    b.x = b.cx;
    b.y = b.cy;
    b.rx = b.x;
    b.ry = b.y;
    return b;
  }
}
