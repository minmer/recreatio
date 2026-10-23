/**
 * LABOR 2D (v2) — KÖRPER INS GITTER (M3a, SANDBOX.md §6): ein wacher Körper
 * wird in jedem Schritt an seiner Lage ins Gitter geschrieben.
 *
 * - <b>Welche Zellen</b>: jede, deren Mitte in einem seiner Voxel liegt. Eine
 *   Wand von einer Zelle Dicke bleibt so auch schräg dicht: in jeder Zeile
 *   (bis 45°) oder Spalte (darüber) liegt eine Zellmitte in ihr, und Zellen,
 *   die sich nur an einer Ecke berühren, lassen im versetzten Gitter nichts
 *   durch (Flüsse gehen nur über Seitenflächen). Zellen eines festen Baus oder
 *   eines anderen Körpers bleiben, wem sie gehören.
 * - <b>Energie mit denselben Gewichten hin und zurück</b>: jede Zelle liest
 *   das Voxel unter ihrer Mitte; ein Voxel, das k Zellen lesen, gibt jeder 1/k
 *   seiner Energie, Wärmekapazität, seines Films und seiner Kruste; ein Voxel,
 *   das keine liest (schräg zwischen zwei Mitten), geht ganz in die nächste
 *   eigene Zelle. Am Ende des Schritts geht die Änderung jeder Zelle (Wärme,
 *   Film, Kruste) nach denselben Gewichten an die Voxel zurück — die Energie
 *   nach Wärmekapazität, Film und Kruste nach Anteil. Nichts geht verloren.
 * - <b>Zellen, die fest werden</b>, geben ihr Gas an die Fluidnachbarn ab;
 *   <b>Zellen, die frei werden</b>, sind Flüssigkeit, wenn kein Gas angrenzt,
 *   sonst Gas, das sie von den Gasnachbarn holen — genau erhalten (wie
 *   gas.transitions für Flüssigkeit und Gas).
 * - <b>Bewegte Wände</b>: jede Seitenfläche einer Körperzelle bekommt die
 *   Geschwindigkeit des Körpers an ihrer Mitte (grid.usol, vsol) — beide
 *   Projektionen sehen eine bewegte Wand.
 * - <b>Teilchen hinaus</b>: ein Teilchen, das jetzt in einem Voxel liegt, geht
 *   im Rahmen des Körpers auf seinem Weg zurück bis vor die Seite, durch die es
 *   kam (auch eine Wand von einer Zelle Dicke lässt so nichts durch); seine
 *   Geschwindigkeit in die Wand hinein fällt weg.
 */

import { Body2D } from './body';
import type { Bubbles } from './bubbles';
import type { Gas } from './gas';
import type { Grid } from './grid';
import type { Heat } from './heat';
import { SOLIDS } from './materials';
import type { Particles } from './particles';
import { GAS, LIQUID, SOLID } from './units';

/** Wie weit ein hinausgeschobener Punkt vor der Seite liegt (in Voxelkanten). */
const EPS = 0.01;

export interface RasterWorld {
  readonly grid: Grid;
  readonly gas: Gas;
  readonly heat: Heat;
  readonly particles: Particles;
  readonly bubbles: Bubbles;
}

export class BodyRaster {
  private readonly w: RasterWorld;
  /* Arbeitsspeicher (je Aufruf neu geschrieben). */
  private readonly mark: Int32Array;
  private readonly pos: Int32Array;
  private stamp = 0;
  private cells = new Int32Array(64);
  private cellVoxel = new Int32Array(64);
  private count = new Int32Array(64);
  private readonly l0 = new Float64Array(2);
  private readonly l1 = new Float64Array(2);
  private readonly wp = new Float64Array(2);

  private readonly seen: Int32Array;
  private readonly queue: Int32Array;

  constructor(w: RasterWorld) {
    this.w = w;
    this.mark = new Int32Array(w.grid.n);
    this.pos = new Int32Array(w.grid.n);
    this.seen = new Int32Array(w.grid.n);
    this.queue = new Int32Array(w.grid.n);
  }

  /* -- Schreiben ---------------------------------------------------------------------------------- */

  /**
   * Den Körper an seiner jetzigen Lage ins Gitter schreiben. Liefert die Zahl
   * der Zellen, die ihre Art gewechselt haben (fest ↔ frei). `avoid`: Zellen,
   * die er nicht nehmen darf (die Fläche eines Werkzeugs, das eben radiert).
   */
  rasterise(b: Body2D, avoid?: (c: number) => boolean): number {
    const g = this.w.grid;
    const { nx, ny, dx } = g;
    const id = b.index + 1;
    const stamp = ++this.stamp;
    const mark = this.mark;
    const pos = this.pos;
    const r = b.rmax + dx;
    const i0 = Math.max(0, Math.floor((b.x - r) / dx));
    const i1 = Math.min(nx - 1, Math.floor((b.x + r) / dx));
    const j0 = Math.max(0, Math.floor((b.y - r) / dx));
    const j1 = Math.min(ny - 1, Math.floor((b.y + r) / dx));
    const cs = Math.cos(b.a);
    const sn = Math.sin(b.a);
    const need = (i1 - i0 + 1) * (j1 - j0 + 1) + 1;
    if (this.cells.length < need) { this.cells = new Int32Array(2 * need); this.cellVoxel = new Int32Array(2 * need); }
    const cells = this.cells;
    const cellVoxel = this.cellVoxel;
    let n = 0;
    for (let j = j0; j <= j1; j += 1) {
      const wy = (j + 0.5) * dx - b.y;
      for (let i = i0; i <= i1; i += 1) {
        const c = i + j * nx;
        if (g.solid[c] !== 0 && g.owner[c] !== id) continue;
        if (avoid !== undefined && avoid(c)) continue;
        const wx = (i + 0.5) * dx - b.x;
        const k = b.voxelAtLocal(cs * wx + sn * wy, -sn * wx + cs * wy);
        if (k < 0) continue;
        cells[n] = c;
        cellVoxel[n] = k;
        mark[c] = stamp;
        pos[c] = n;
        n += 1;
      }
    }
    /* Kein Zellmittelpunkt im Körper (ein winziger, schräger Körper): die Zelle unter dem Schwerpunkt, mit dem nächsten Voxel. */
    if (n === 0) {
      const c = g.cellAt(b.x, b.y);
      if (c < 0 || (g.solid[c] !== 0 && g.owner[c] !== id)) return 0;
      cells[0] = c;
      cellVoxel[0] = this.nearestVoxel(b, 0, 0);
      mark[c] = stamp;
      pos[c] = 0;
      n = 1;
    }
    let flips = 0;
    /* Erst fest werden (ihr Gas zu Nachbarn, die frei bleiben), dann frei werden (die Nachbarn sind dann, was sie sind). */
    for (let q = 0; q < n; q += 1) {
      const c = cells[q];
      if (g.owner[c] === id) continue;
      flips += 1;
      this.gasOut(c, stamp);
      g.kind[c] = SOLID;
      g.owner[c] = id;
      g.solid[c] = b.mat[cellVoxel[q]] + 1;
    }
    for (let q = 0; q < b.nc; q += 1) {
      const c = b.cells[q];
      if (mark[c] === stamp || g.owner[c] !== id) continue;
      flips += 1;
      this.vacate(c);
    }
    /* Gewichte: Zelle q liest Voxel cellVoxel[q]; ungelesene Voxel in die nächste eigene Zelle. */
    if (this.count.length < b.nv) this.count = new Int32Array(2 * b.nv);
    const cnt = this.count;
    cnt.fill(0, 0, b.nv);
    for (let q = 0; q < n; q += 1) cnt[cellVoxel[q]] += 1;
    let nw = n;
    for (let k = 0; k < b.nv; k += 1) if (cnt[k] === 0) nw += 1;
    if (b.wv.length < nw) { b.wv = new Int32Array(nw); b.wc = new Int32Array(nw); b.ww = new Float64Array(nw); }
    let e = 0;
    for (let q = 0; q < n; q += 1) {
      b.wv[e] = cellVoxel[q];
      b.wc[e] = q;
      b.ww[e] = 1 / cnt[cellVoxel[q]];
      e += 1;
    }
    for (let k = 0; k < b.nv; k += 1) {
      if (cnt[k] !== 0) continue;
      b.wv[e] = k;
      b.wc[e] = this.hostOf(b, k, n, stamp);
      b.ww[e] = 1;
      e += 1;
    }
    b.nw = e;
    /* Die Zellen füllen. */
    if (b.cells.length < n) { b.cells = new Int32Array(n); b.E0 = new Float64Array(n); b.F0 = new Float64Array(n); b.K0 = new Float64Array(n); }
    for (let q = 0; q < n; q += 1) {
      const c = cells[q];
      b.cells[q] = c;
      g.Es[c] = 0;
      g.capB[c] = 0;
      g.film[c] = 0;
      g.crust[c] = 0;
    }
    b.nc = n;
    const vCell = g.vCell;
    for (let k = 0; k < e; k += 1) {
      const v = b.wv[k];
      const c = b.cells[b.wc[k]];
      const wgt = b.ww[k];
      const s = SOLIDS[b.mat[v]];
      g.Es[c] += wgt * b.E[v];
      g.capB[c] += wgt * s.rho * s.cp * vCell;
      g.film[c] += wgt * b.film[v];
      g.crust[c] += wgt * b.crust[v];
    }
    const heat = this.w.heat;
    for (let q = 0; q < n; q += 1) {
      const c = b.cells[q];
      const v = cellVoxel[q];
      g.solid[c] = b.mat[v] + 1;
      g.heater[c] = b.heater[v];
      g.role[c] = b.heater[v] >= 0 ? 1 : 0;
      g.owner[c] = id;
      g.kind[c] = SOLID;
      heat.deriveSolid(c);
      b.E0[q] = g.Es[c];
      b.F0[q] = g.film[c];
      b.K0[q] = g.crust[c];
    }
    this.faces(b, stamp);
    b.ux = b.vx;
    b.uy = b.vy;
    b.uw = b.w;
    b.rx = b.x;
    b.ry = b.y;
    b.ra = b.a;
    return flips;
  }

  /** Die Änderungen der eigenen Zellen seit dem Schreiben (Wärme, Film, Kruste) an die Voxel — mit denselben Gewichten. */
  collect(b: Body2D): void {
    const g = this.w.grid;
    if (b.nc === 0) return;
    /* Je Zelle: Σ Gewicht · C der Voxel (Energie nach Wärmekapazität), Σ Gewicht (Film und Kruste nach Anteil). */
    const vCell = g.vCell;
    const sumC = this.scratchSum(b.nc);
    const sumW = this.scratchSum2(b.nc);
    for (let k = 0; k < b.nw; k += 1) {
      const s = SOLIDS[b.mat[b.wv[k]]];
      sumC[b.wc[k]] += b.ww[k] * s.rho * s.cp * vCell;
      sumW[b.wc[k]] += b.ww[k];
    }
    for (let k = 0; k < b.nw; k += 1) {
      const v = b.wv[k];
      const q = b.wc[k];
      const c = b.cells[q];
      const s = SOLIDS[b.mat[v]];
      const dE = g.Es[c] - b.E0[q];
      if (dE !== 0 && sumC[q] > 0) b.E[v] += (dE * b.ww[k] * s.rho * s.cp * vCell) / sumC[q];
      const dF = g.film[c] - b.F0[q];
      /* Was abnimmt, nimmt jedem nach dem, was er gab (nichts wird negativ); was dazukommt, nach dem Gewicht. */
      if (dF > 0) b.film[v] += (dF * b.ww[k]) / sumW[q];
      else if (dF < 0 && b.F0[q] > 0) b.film[v] += (dF * b.ww[k] * b.film[v]) / b.F0[q];
      const dK = g.crust[c] - b.K0[q];
      if (dK > 0) b.crust[v] += (dK * b.ww[k]) / sumW[q];
      else if (dK < 0 && b.K0[q] > 0) b.crust[v] += (dK * b.ww[k] * b.crust[v]) / b.K0[q];
    }
    for (let q = 0; q < b.nc; q += 1) {
      const c = b.cells[q];
      b.E0[q] = g.Es[c];
      b.F0[q] = g.film[c];
      b.K0[q] = g.crust[c];
    }
  }

  /** Alle eigenen Zellen freigeben (vorher collect): sie werden Flüssigkeit oder Gas wie beim Bewegen. */
  release(b: Body2D): void {
    const g = this.w.grid;
    for (let f = 0; f < b.nf; f += 1) this.clearFace(b.faces[f]);
    b.nf = 0;
    for (let q = 0; q < b.nc; q += 1) if (g.owner[b.cells[q]] === b.index + 1) this.vacate(b.cells[q]);
    b.nc = 0;
    b.nw = 0;
  }

  /** Die Flächen eines einschlafenden (oder angehefteten) Körpers stehen still. */
  stopFaces(b: Body2D): void {
    for (let f = 0; f < b.nf; f += 1) this.clearFace(b.faces[f]);
    b.nf = 0;
  }

  /* -- Teilchen und Blasen hinaus ----------------------------------------------------------------- */

  /**
   * Nach einer Bewegung des Körpers von (x0, y0, a0) zur jetzigen Lage: jedes
   * Teilchen und jede Blase, die jetzt in einem Voxel liegen, auf ihrem Weg im
   * Rahmen des Körpers zurück vor die Seite, durch die sie kamen.
   */
  pushOut(b: Body2D, x0: number, y0: number, a0: number): void {
    const P = this.w.particles;
    const B = this.w.bubbles;
    const r = b.rmax + this.w.grid.dx;
    for (let p = 0; p < P.count; p += 1) {
      const px = P.x[p];
      const py = P.y[p];
      if (Math.abs(px - b.x) > r || Math.abs(py - b.y) > r) continue;
      if (this.moveOut(b, px, py, px, py, x0, y0, a0)) {
        P.x[p] = this.wp[0];
        P.y[p] = this.wp[1];
        this.stopInto(b, P.vx, P.vy, p);
      }
    }
    for (let k = 0; k < B.count; k += 1) {
      const px = B.x[k];
      const py = B.y[k];
      if (Math.abs(px - b.x) > r || Math.abs(py - b.y) > r) continue;
      if (this.moveOut(b, px, py, px, py, x0, y0, a0)) {
        B.x[k] = this.wp[0];
        B.y[k] = this.wp[1];
        B.site[k] = -1;
        this.stopInto(b, B.vx, B.vy, k);
      }
    }
  }

  /**
   * Ein Teilchen, das sich selbst bewegt hat (von (x0, y0) nach (x, y)), bei
   * stehendem Körper: liegt es nun in einem Voxel, zurück vor die Seite.
   * Liefert true, wenn es verschoben wurde (neuer Ort in out).
   */
  collidePoint(b: Body2D, x0: number, y0: number, x: number, y: number, out: Float64Array): boolean {
    if (!this.moveOut(b, x, y, x0, y0, b.x, b.y, b.a)) return false;
    out[0] = this.wp[0];
    out[1] = this.wp[1];
    out[2] = this.nx;
    out[3] = this.ny;
    return true;
  }

  /** Die Normale der zuletzt durchstossenen Seite (Welt). */
  nx = 0;
  ny = 0;

  /**
   * Liegt (x, y) jetzt im Körper? Dann von dort, wo der Punkt (ox, oy) unter
   * der alten Lage (x0, y0, a0) im Rahmen lag, den Weg entlang bis zum ersten
   * Voxel und knapp davor. Ergebnis in this.wp (Welt), Normale in nx, ny.
   */
  private moveOut(b: Body2D, x: number, y: number, ox: number, oy: number, x0: number, y0: number, a0: number): boolean {
    const l1 = this.l1;
    Body2D.toLocal(b.x, b.y, b.a, x, y, l1);
    if (b.voxelAtLocal(l1[0], l1[1]) < 0) return false;
    const l0 = this.l0;
    Body2D.toLocal(x0, y0, a0, ox, oy, l0);
    const dx = b.dx;
    const q0x = (l0[0] + b.cx) / dx;
    const q0y = (l0[1] + b.cy) / dx;
    const q1x = (l1[0] + b.cx) / dx;
    const q1y = (l1[1] + b.cy) / dx;
    let side = -1;
    let qx = q1x;
    let qy = q1y;
    if (b.voxel(Math.floor(q0x), Math.floor(q0y)) < 0) {
      /* Den Weg entlang, Zelle für Zelle des eigenen Gitters (Amanatides & Woo). */
      const ddx = q1x - q0x;
      const ddy = q1y - q0y;
      let ix = Math.floor(q0x);
      let iy = Math.floor(q0y);
      const sx = ddx > 0 ? 1 : -1;
      const sy = ddy > 0 ? 1 : -1;
      let tx = ddx !== 0 ? (ix + (sx > 0 ? 1 : 0) - q0x) / ddx : Infinity;
      let ty = ddy !== 0 ? (iy + (sy > 0 ? 1 : 0) - q0y) / ddy : Infinity;
      const stepX = ddx !== 0 ? Math.abs(1 / ddx) : Infinity;
      const stepY = ddy !== 0 ? Math.abs(1 / ddy) : Infinity;
      for (let guard = 0; guard < 4096; guard += 1) {
        let t: number;
        let s: number;
        if (tx < ty) { ix += sx; t = tx; tx += stepX; s = sx > 0 ? 0 : 1; }
        else { iy += sy; t = ty; ty += stepY; s = sy > 0 ? 2 : 3; }
        if (t > 1 + 1e-9) break;
        if (b.voxel(ix, iy) >= 0) {
          side = s;
          qx = q0x + t * ddx + (s === 0 ? -EPS : s === 1 ? EPS : 0);
          qy = q0y + t * ddy + (s === 2 ? -EPS : s === 3 ? EPS : 0);
          break;
        }
      }
    }
    if (side < 0) {
      /* Schon vorher drin (oder der Weg fand nichts): zum nächsten freien Platz im Umkreis. */
      const fx = Math.floor(q1x);
      const fy = Math.floor(q1y);
      let best = Infinity;
      for (let rad = 1; rad <= 4 && best === Infinity; rad += 1) {
        for (let jy = fy - rad; jy <= fy + rad; jy += 1) {
          for (let jx = fx - rad; jx <= fx + rad; jx += 1) {
            if (b.voxel(jx, jy) >= 0) continue;
            const cxp = Math.min(jx + 1 - EPS, Math.max(jx + EPS, q1x));
            const cyp = Math.min(jy + 1 - EPS, Math.max(jy + EPS, q1y));
            const d = (cxp - q1x) ** 2 + (cyp - q1y) ** 2;
            if (d < best) {
              best = d;
              qx = cxp;
              qy = cyp;
              side = Math.abs(cxp - q1x) > Math.abs(cyp - q1y) ? (cxp < q1x ? 0 : 1) : (cyp < q1y ? 2 : 3);
            }
          }
        }
      }
      if (side < 0) return false;
    }
    const cs = Math.cos(b.a);
    const sn = Math.sin(b.a);
    const lx = qx * dx - b.cx;
    const ly = qy * dx - b.cy;
    const g = this.w.grid;
    const m = 1e-4 * dx;
    this.wp[0] = Math.min(g.w - m, Math.max(m, b.x + cs * lx - sn * ly));
    this.wp[1] = Math.min(g.h - m, Math.max(m, b.y + sn * lx + cs * ly));
    const nlx = side === 0 ? -1 : side === 1 ? 1 : 0;
    const nly = side === 2 ? -1 : side === 3 ? 1 : 0;
    this.nx = cs * nlx - sn * nly;
    this.ny = sn * nlx + cs * nly;
    return true;
  }

  /** Die Geschwindigkeit eines verschobenen Punkts: was relativ zum Körper in ihn hinein zeigt, fällt weg. */
  private stopInto(b: Body2D, vx: Float32Array, vy: Float32Array, k: number): void {
    const rx = this.wp[0] - b.x;
    const ry = this.wp[1] - b.y;
    const bx = b.vx - b.w * ry;
    const by = b.vy + b.w * rx;
    const vn = (vx[k] - bx) * this.nx + (vy[k] - by) * this.ny;
    if (vn < 0) { vx[k] -= vn * this.nx; vy[k] -= vn * this.ny; }
  }

  /* -- Hilfen ------------------------------------------------------------------------------------- */

  /** Das Voxel, dessen Mitte (lx, ly) (relativ zum Schwerpunkt) am nächsten liegt. */
  private nearestVoxel(b: Body2D, lx: number, ly: number): number {
    let best = 0;
    let bd = Infinity;
    for (let k = 0; k < b.nv; k += 1) {
      const d = ((b.vi[k] + 0.5) * b.dx - b.cx - lx) ** 2 + ((b.vj[k] + 0.5) * b.dx - b.cy - ly) ** 2;
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }

  /** Die eigene Zelle (Index q in der Liste), in die ein ungelesenes Voxel k geht: die unter seiner Mitte, sonst die nächste. */
  private hostOf(b: Body2D, k: number, n: number, stamp: number): number {
    const g = this.w.grid;
    const lx = (b.vi[k] + 0.5) * b.dx - b.cx;
    const ly = (b.vj[k] + 0.5) * b.dx - b.cy;
    const wp = this.wp;
    Body2D.toWorld(b.x, b.y, b.a, lx, ly, wp);
    const i = Math.floor(wp[0] / g.dx);
    const j = Math.floor(wp[1] / g.dx);
    let best = -1;
    let bd = Infinity;
    for (let b2 = -1; b2 <= 1; b2 += 1) {
      for (let a = -1; a <= 1; a += 1) {
        const ii = i + a;
        const jj = j + b2;
        if (ii < 0 || jj < 0 || ii >= g.nx || jj >= g.ny) continue;
        const c = ii + jj * g.nx;
        if (this.mark[c] !== stamp) continue;
        const d = ((ii + 0.5) * g.dx - wp[0]) ** 2 + ((jj + 0.5) * g.dx - wp[1]) ** 2;
        if (d < bd) { bd = d; best = this.pos[c]; }
      }
    }
    if (best >= 0) return best;
    for (let q = 0; q < n; q += 1) {
      const c = this.cells[q];
      const d = ((c % g.nx + 0.5) * g.dx - wp[0]) ** 2 + ((Math.floor(c / g.nx) + 0.5) * g.dx - wp[1]) ** 2;
      if (d < bd) { bd = d; best = q; }
    }
    return Math.max(0, best);
  }

  /** Die Seitenflächen der eigenen Zellen, die an Fremdes grenzen, bekommen die Geschwindigkeit des Körpers an ihrer Mitte. */
  private faces(b: Body2D, stamp: number): void {
    const g = this.w.grid;
    const { nx, ny, dx, nu } = g;
    for (let f = 0; f < b.nf; f += 1) this.clearFace(b.faces[f]);
    if (b.faces.length < 4 * b.nc) b.faces = new Int32Array(4 * b.nc + 16);
    let nf = 0;
    const set = (face: number, value: number): void => {
      if (face < nu) g.usol[face] = value; else g.vsol[face - nu] = value;
      b.faces[nf++] = face;
    };
    for (let q = 0; q < b.nc; q += 1) {
      const c = b.cells[q];
      const i = c % nx;
      const j = (c - i) / nx;
      const xc = (i + 0.5) * dx;
      const yc = (j + 0.5) * dx;
      /* Die Seiten der Kiste bleiben, was sie sind (Wand: ruhend; offen: der Rand). */
      if (i > 0 && this.mark[c - 1] !== stamp) set(i + j * (nx + 1), b.vx - b.w * (yc - b.y));
      if (i < nx - 1 && this.mark[c + 1] !== stamp) set(i + 1 + j * (nx + 1), b.vx - b.w * (yc - b.y));
      if (j > 0 && this.mark[c - nx] !== stamp) set(nu + i + j * nx, b.vy + b.w * (xc - b.x));
      if (j < ny - 1 && this.mark[c + nx] !== stamp) set(nu + i + (j + 1) * nx, b.vy + b.w * (xc - b.x));
    }
    b.nf = nf;
  }

  private clearFace(face: number): void {
    const g = this.w.grid;
    if (face < g.nu) g.usol[face] = 0; else g.vsol[face - g.nu] = 0;
  }

  /** Eine Zelle, die eben fest wird: ihr Gas (Arten, Nebel, Enthalpie) zu Fluidzellen in der Nähe, die frei bleiben — nach deren Gasvolumen. */
  private gasOut(c: number, stamp: number): void {
    const g = this.w.grid;
    const gas = this.w.gas;
    if (gas.massOf(c) <= 0 && g.Hg[c] === 0) return;
    const { nx, ny } = g;
    const i = c % nx;
    const j = (c - i) / nx;
    for (let rad = 1; rad <= 3; rad += 1) {
      let wsum = 0;
      let cnt = 0;
      for (let jj = j - rad; jj <= j + rad; jj += 1) {
        for (let ii = i - rad; ii <= i + rad; ii += 1) {
          if (Math.max(Math.abs(ii - i), Math.abs(jj - j)) !== rad || ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
          const nb = ii + jj * nx;
          if (g.solid[nb] !== 0 || this.mark[nb] === stamp) continue;
          wsum += gas.vgas[nb] > 0 ? gas.vgas[nb] : g.vCell;
          cnt += 1;
        }
      }
      if (cnt === 0) continue;
      /* Anteile nacheinander: jeder Nachbar bekommt seinen Teil des noch Vorhandenen, der letzte den Rest (die Zelle ist dann genau leer). */
      let left = wsum;
      for (let jj = j - rad; jj <= j + rad; jj += 1) {
        for (let ii = i - rad; ii <= i + rad; ii += 1) {
          if (Math.max(Math.abs(ii - i), Math.abs(jj - j)) !== rad || ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
          const nb = ii + jj * nx;
          if (g.solid[nb] !== 0 || this.mark[nb] === stamp) continue;
          const wgt = gas.vgas[nb] > 0 ? gas.vgas[nb] : g.vCell;
          cnt -= 1;
          gas.move(c, nb, cnt === 0 ? 1 : Math.min(1, wgt / left));
          left -= wgt;
        }
      }
      return;
    }
    /* Eingeschlossen (ein Klotz landet flach auf einem anderen): durch alles hindurch zur nächsten freien Fluidzelle. */
    const seen = this.seen;
    const queue = this.queue;
    const tag = ++this.seenStamp;
    let head = 0;
    let tail = 0;
    queue[tail++] = c;
    seen[c] = tag;
    while (head < tail) {
      const q = queue[head++];
      if (q !== c && g.solid[q] === 0 && this.mark[q] !== stamp) { gas.move(c, q, 1); return; }
      const qi = q % nx;
      const qj = (q - qi) / nx;
      for (let d = 0; d < 4; d += 1) {
        const ii = qi + (d === 0 ? -1 : d === 1 ? 1 : 0);
        const jj = qj + (d === 2 ? -1 : d === 3 ? 1 : 0);
        if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
        const nb = ii + jj * nx;
        if (seen[nb] === tag) continue;
        seen[nb] = tag;
        queue[tail++] = nb;
      }
    }
  }

  private seenStamp = 0;

  /** Eine Zelle wird frei: ohne Gas daneben Flüssigkeit, sonst Gas — so viel, wie bei der Dichte der Gasnachbarn in sie passt, von ihnen geholt (je höchstens ein Viertel). */
  private vacate(c: number): void {
    const g = this.w.grid;
    const gas = this.w.gas;
    const { nx, ny } = g;
    g.solid[c] = 0;
    g.role[c] = 0;
    g.heater[c] = -1;
    g.Es[c] = 0;
    g.film[c] = 0;
    g.crust[c] = 0;
    g.owner[c] = 0;
    g.capB[c] = 0;
    const i = c % nx;
    const j = (c - i) / nx;
    let wsum = 0;
    let rho = 0;
    let T = 0;
    let liquidNear = false;
    for (let k = 0; k < 4; k += 1) {
      const ii = i + (k === 0 ? -1 : k === 1 ? 1 : 0);
      const jj = j + (k === 2 ? -1 : k === 3 ? 1 : 0);
      if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
      const nb = ii + jj * nx;
      if (g.kind[nb] === LIQUID) liquidNear = true;
      if (g.kind[nb] !== GAS || gas.massOf(nb) <= 0) continue;
      const wgt = gas.vgas[nb] > 0 ? gas.vgas[nb] : g.vCell;
      wsum += wgt;
      rho += wgt * gas.rho[nb];
      T += wgt * g.T[nb];
    }
    if (wsum <= 0) {
      g.kind[c] = liquidNear ? LIQUID : GAS;
      gas.deriveCell(c);
      return;
    }
    g.kind[c] = GAS;
    g.T[c] = T / wsum;
    const want = (rho / wsum) * Math.max(1e-3, 1 - g.phi[c] - g.alpha[c]) * g.vCell;
    for (let k = 0; k < 4; k += 1) {
      const ii = i + (k === 0 ? -1 : k === 1 ? 1 : 0);
      const jj = j + (k === 2 ? -1 : k === 3 ? 1 : 0);
      if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
      const nb = ii + jj * nx;
      if (g.kind[nb] !== GAS) continue;
      const mnb = gas.massOf(nb);
      if (mnb <= 0) continue;
      const wgt = (gas.vgas[nb] > 0 ? gas.vgas[nb] : g.vCell) / wsum;
      gas.move(nb, c, Math.min(0.25, (want * wgt) / mnb));
    }
    gas.deriveCell(c);
  }

  private sumA = new Float64Array(64);
  private sumB = new Float64Array(64);
  private scratchSum(n: number): Float64Array {
    if (this.sumA.length < n) this.sumA = new Float64Array(2 * n);
    this.sumA.fill(0, 0, n);
    return this.sumA;
  }
  private scratchSum2(n: number): Float64Array {
    if (this.sumB.length < n) this.sumB = new Float64Array(2 * n);
    this.sumB.fill(0, 0, n);
    return this.sumB;
  }
}
