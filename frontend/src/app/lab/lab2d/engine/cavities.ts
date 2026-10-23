/**
 * LABOR 2D (v2) — DIE KAVITÄTEN (ARCHITECTURE.md §8.2): jede feste Fläche, die
 * an ein Fluid grenzt, trägt bis zu acht Kavitäten je Zellkante. Ihre
 * Mündungsradien folgen einer abgeschnittenen Potenzverteilung, deren Schwanz
 * für Stahl die aktive Keimstellendichte von Lemmert & Chawla (1977),
 * N = (210 ΔT_w)^1,805 m⁻², wiedergibt (ΔT_act ∝ 1/r_c, kalibriert bei 1 atm:
 * r_ref = 210·r_1K); Glas und Siedesteine skalieren sie (materials.json:
 * cavScale, cavRmax). Gezogen einmal je Fläche aus einem Hash des Samens und
 * der Fläche — unabhängig von der Reihenfolge der Wände. Aktiv ist eine
 * Kavität, wenn T_f − T_sat(p_l) ≥ ΔT_act = T_sat(p_l + 2σ/r_c) − T_sat(p_l).
 *
 * Zwei Arten von Flächen: Seiten von Zellen eines festen Baus (fest im Gitter)
 * und die freien Seiten der Körper (seit 2026-10-23 genaue Rechtecke): je
 * Stück einer Seite von etwa Δx Länge dieselbe Ziehung; die Kavitäten sitzen
 * im Rahmen des Körpers und wandern mit ihm (refresh). Für jede Kavität gilt:
 * Mündung (x, y) und Aussennormale in der Welt, die Zelle der Wand (der feste
 * Teil dort, auch ein Körperstück neben Fluid) und die Fluidzelle davor.
 */

import type { Body2D } from './body';
import type { Grid } from './grid';
import { pSatFast, tSat } from './if97';
import { sigma, SOLIDS } from './materials';
import { hash3, Rng } from './rng';
import { P_ATM } from './units';

/** Kavitäten je Fläche höchstens (SIMPLIFICATIONS.md #10). */
const SITES_PER_FACE = 8;
/** Lemmert & Chawla: N = (210 ΔT)^1,805 m⁻². */
const LC_A = 210;
const LC_N = 1.805;
/** Kleinste Kavität, die gezogen wird (m): darunter brauchte es über 100 K Überhitzung. */
const R_MIN = 0.3e-6;

/** ΔT_act einer Kavität des Radius r beim Druck p (K). */
export function activation(r: number, p: number): number {
  const Ts = tSat(p);
  return tSat(p + (2 * sigma(Ts)) / r) - Ts;
}

/**
 * Die Tafel der Kavitäten: je Kavität Wandzelle, Fluidzelle davor, Seite (0
 * links, 1 rechts, 2 unten, 3 oben; bei Körpern die Richtung, die der Normalen
 * am nächsten kommt), Mündungsradius, Lage längs der Seite und in der Tiefe
 * (0–1), hängende Blase (Nummer, 0: keine); dazu Werkstoff, Mündung und
 * Normale in der Welt, Körper (−1: Bau), Seitenstück und Lage darauf.
 */
export class Cavities {
  count = 0;
  /** Davon an Zellen eines festen Baus (die ersten); der Rest an Körpern. */
  fixed = 0;
  cell: Int32Array = new Int32Array(0);
  fluid: Int32Array = new Int32Array(0);
  dir: Uint8Array = new Uint8Array(0);
  r: Float32Array = new Float32Array(0);
  s: Float32Array = new Float32Array(0);
  z: Float32Array = new Float32Array(0);
  bubble: Uint32Array = new Uint32Array(0);
  mat: Uint8Array = new Uint8Array(0);
  px: Float64Array = new Float64Array(0);
  py: Float64Array = new Float64Array(0);
  nx: Float32Array = new Float32Array(0);
  ny: Float32Array = new Float32Array(0);
  body: Int16Array = new Int16Array(0);
  seg: Int32Array = new Int32Array(0);
  t: Float32Array = new Float32Array(0);
  private readonly pos = new Float64Array(2);
  private readonly sg = new Float64Array(6);

  /** Radius, bei dem ΔT_act bei 1 atm genau 1 K ist — die Länge der Verteilung (r_ref = 210 r_1K). */
  private static rRef(): number {
    if (Cavities.ref > 0) return Cavities.ref;
    const Ts = tSat(P_ATM);
    const r1 = (2 * sigma(Ts)) / (pSatFast(Ts + 1) - P_ATM);
    Cavities.ref = LC_A * r1;
    return Cavities.ref;
  }

  private static ref = 0;
  private static readonly rng = new Rng(1);

  /** Die Kavitäten einer Fläche der Grösse `area` aus Werkstoff `mat` (Ziehung aus dem Hash h): Radien, Lagen längs und in der Tiefe. */
  private static draw(h: number, area: number, mat: number, out: { r: number[]; s: number[]; z: number[] }): void {
    const m = SOLIDS[mat];
    const rRef = Cavities.rRef();
    const rng = Cavities.rng;
    rng.state = h || 1;
    const base = Math.pow(rRef / m.cavRmax, LC_N);
    let S = 0;
    for (let q = 0; q < SITES_PER_FACE; q += 1) {
      S += rng.exp();
      const r = rRef * Math.pow(S / (area * m.cavScale) + base, -1 / LC_N);
      if (r < R_MIN) break;
      out.r.push(r);
      out.s.push(rng.next());
      out.z.push(rng.next());
    }
  }

  /**
   * Neu auslegen (nach jeder Änderung der Feststoffe): die Seiten der Zellen
   * eines festen Baus, die an Fluid grenzen, dann die freien Seiten der Körper.
   */
  rebuild(g: Grid, seed: number, bodies: readonly Body2D[] = []): void {
    const { nx, ny } = g;
    const area = g.dx * g.depth;
    const cell: number[] = [];
    const fluid: number[] = [];
    const dir: number[] = [];
    const rad: number[] = [];
    const pos: number[] = [];
    const dep: number[] = [];
    const mats: number[] = [];
    const tmp = { r: [] as number[], s: [] as number[], z: [] as number[] };
    for (let c = 0; c < g.n; c += 1) {
      if (g.solid[c] === 0 || g.owner[c] !== 0) continue;
      const i = c % nx;
      const j = (c - i) / nx;
      for (let k = 0; k < 4; k += 1) {
        const ii = k === 0 ? i - 1 : k === 1 ? i + 1 : i;
        const jj = k === 2 ? j - 1 : k === 3 ? j + 1 : j;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
        const nb = ii + jj * nx;
        if (g.solid[nb] !== 0) continue;
        tmp.r.length = 0; tmp.s.length = 0; tmp.z.length = 0;
        Cavities.draw(hash3(seed, c, k), area, g.solid[c] - 1, tmp);
        for (let q = 0; q < tmp.r.length; q += 1) {
          cell.push(c);
          fluid.push(nb);
          dir.push(k);
          rad.push(tmp.r[q]);
          pos.push(tmp.s[q]);
          dep.push(tmp.z[q]);
          mats.push(g.solid[c] - 1);
        }
      }
    }
    const fixed = cell.length;
    /* Körper: je Seitenstück von etwa Δx Länge eine Fläche; die Lage längs des Stücks als t (0–1) auf dem ganzen Seitenstück. */
    const bodyOf: number[] = [];
    const segOf: number[] = [];
    const tOf: number[] = [];
    for (const b of bodies) {
      if (b.gone) continue;
      for (let e = 0; e < b.nseg; e += 1) {
        b.segment(e, this.sg);
        const len = Math.hypot(this.sg[2] - this.sg[0], this.sg[3] - this.sg[1]);
        const pieces = Math.max(1, Math.round(len / g.dx));
        for (let p = 0; p < pieces; p += 1) {
          tmp.r.length = 0; tmp.s.length = 0; tmp.z.length = 0;
          Cavities.draw(hash3(seed, 100000 + 1000 * b.key + e, p), (len / pieces) * g.depth, b.mat, tmp);
          for (let q = 0; q < tmp.r.length; q += 1) {
            cell.push(-1);
            fluid.push(-1);
            dir.push(b.segS[e]);
            rad.push(tmp.r[q]);
            pos.push(tmp.s[q]);
            dep.push(tmp.z[q]);
            mats.push(b.mat);
            bodyOf.push(b.index);
            segOf.push(e);
            tOf.push((p + tmp.s[q]) / pieces);
          }
        }
      }
    }
    const n = cell.length;
    this.count = n;
    this.fixed = fixed;
    this.cell = Int32Array.from(cell);
    this.fluid = Int32Array.from(fluid);
    this.dir = Uint8Array.from(dir);
    this.r = Float32Array.from(rad);
    this.s = Float32Array.from(pos);
    this.z = Float32Array.from(dep);
    this.bubble = new Uint32Array(n);
    this.mat = Uint8Array.from(mats);
    this.px = new Float64Array(n);
    this.py = new Float64Array(n);
    this.nx = new Float32Array(n);
    this.ny = new Float32Array(n);
    this.body = new Int16Array(n).fill(-1);
    this.seg = new Int32Array(n);
    this.t = new Float32Array(n);
    for (let q = 0; q < fixed; q += 1) {
      const c = this.cell[q];
      const i = c % nx;
      const j = (c - i) / nx;
      const s = this.s[q];
      const k = this.dir[q];
      const dx = g.dx;
      this.px[q] = k === 0 ? i * dx : k === 1 ? (i + 1) * dx : (i + s) * dx;
      this.py[q] = k === 2 ? j * dx : k === 3 ? (j + 1) * dx : (j + s) * dx;
      this.nx[q] = k === 0 ? -1 : k === 1 ? 1 : 0;
      this.ny[q] = k === 2 ? -1 : k === 3 ? 1 : 0;
    }
    for (let q = fixed; q < n; q += 1) {
      this.body[q] = bodyOf[q - fixed];
      this.seg[q] = segOf[q - fixed];
      this.t[q] = tOf[q - fixed];
    }
    this.refresh(g, bodies, false);
  }

  /**
   * Die Kavitäten der Körper an deren jetzige Lage: Mündung, Normale, Zelle der
   * Wand (knapp innen) und Fluidzelle davor (knapp aussen; −1, wenn dort kein
   * Fluid ist). Nur wache Körper, ausser `all`.
   */
  refresh(g: Grid, bodies: readonly Body2D[], onlyAwake = true): void {
    const eps = 0.05 * g.dx;
    for (let q = this.fixed; q < this.count; q += 1) {
      const b = bodies[this.body[q]];
      if (b === undefined || b.gone) { this.cell[q] = -1; this.fluid[q] = -1; continue; }
      if (onlyAwake && !b.awake) continue;
      b.segment(this.seg[q], this.sg);
      const t = this.t[q];
      const lx = this.sg[0] + t * (this.sg[2] - this.sg[0]);
      const ly = this.sg[1] + t * (this.sg[3] - this.sg[1]);
      const c = Math.cos(b.a);
      const s = Math.sin(b.a);
      const wx = b.x + c * lx - s * ly;
      const wy = b.y + s * lx + c * ly;
      const nwx = c * this.sg[4] - s * this.sg[5];
      const nwy = s * this.sg[4] + c * this.sg[5];
      this.px[q] = wx;
      this.py[q] = wy;
      this.nx[q] = nwx;
      this.ny[q] = nwy;
      this.dir[q] = Math.abs(nwx) >= Math.abs(nwy) ? (nwx < 0 ? 0 : 1) : (nwy < 0 ? 2 : 3);
      const wall = g.cellAt(wx - eps * nwx, wy - eps * nwy);
      const fl = g.cellAt(wx + eps * nwx, wy + eps * nwy);
      this.cell[q] = wall;
      this.fluid[q] = fl >= 0 && g.solid[fl] === 0 ? fl : -1;
    }
  }

  /** Grösster Mündungsradius einer Kavität aus Werkstoff `id` (m). */
  largest(_g: Grid, id: string): number {
    let best = 0;
    for (let q = 0; q < this.count; q += 1) if (SOLIDS[this.mat[q]].id === id && this.r[q] > best) best = this.r[q];
    return best;
  }

  /** Mitte einer Blase des Radius r an der Kavität q: auf der Mündung, um r ins Fluid gerückt (ein wiederverwendeter Puffer). */
  position(_g: Grid, q: number, r: number): Float64Array {
    this.pos[0] = this.px[q] + r * this.nx[q];
    this.pos[1] = this.py[q] + r * this.ny[q];
    return this.pos;
  }
}
