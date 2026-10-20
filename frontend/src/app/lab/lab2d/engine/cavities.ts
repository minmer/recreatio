/**
 * LABOR 2D (v2) — DIE KAVITÄTEN (ARCHITECTURE.md §8.2): jede feste Fläche, die
 * an ein Fluid grenzt, trägt bis zu acht Kavitäten. Ihre Mündungsradien folgen
 * einer abgeschnittenen Potenzverteilung, deren Schwanz für Stahl die aktive
 * Keimstellendichte von Lemmert & Chawla (1977), N = (210 ΔT_w)^1,805 m⁻²,
 * wiedergibt (ΔT_act ∝ 1/r_c, kalibriert bei 1 atm: r_ref = 210·r_1K);
 * Glas und Siedesteine skalieren sie (materials.json: cavScale, cavRmax).
 * Gezogen einmal je Fläche aus einem Hash des Samens und der Fläche — unabhängig
 * von der Reihenfolge der Wände. Aktiv ist eine Kavität, wenn
 * T_f − T_sat(p_l) ≥ ΔT_act = T_sat(p_l + 2σ/r_c) − T_sat(p_l).
 */

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

/** Die Tafel der Kavitäten: je Kavität Wandzelle, Fluidzelle davor, Seite (0 links, 1 rechts, 2 unten, 3 oben), Mündungsradius, Lage längs der Seite und in der Tiefe (0–1), hängende Blase (Nummer, 0: keine). */
export class Cavities {
  count = 0;
  cell: Int32Array = new Int32Array(0);
  fluid: Int32Array = new Int32Array(0);
  dir: Uint8Array = new Uint8Array(0);
  r: Float32Array = new Float32Array(0);
  s: Float32Array = new Float32Array(0);
  z: Float32Array = new Float32Array(0);
  bubble: Uint32Array = new Uint32Array(0);
  private readonly pos = new Float64Array(2);

  /** Neu auslegen (nach jeder Änderung der Feststoffe). */
  rebuild(g: Grid, seed: number): void {
    const { nx, ny } = g;
    /* Radius, bei dem ΔT_act bei 1 atm genau 1 K ist: 2σ/r = p_sat(T_sat + 1 K) − p. */
    const Ts = tSat(P_ATM);
    const r1 = (2 * sigma(Ts)) / (pSatFast(Ts + 1) - P_ATM);
    const rRef = LC_A * r1;
    const area = g.dx * g.depth;
    const cell: number[] = [];
    const fluid: number[] = [];
    const dir: number[] = [];
    const rad: number[] = [];
    const pos: number[] = [];
    const dep: number[] = [];
    const rng = new Rng(1);
    for (let c = 0; c < g.n; c += 1) {
      if (g.solid[c] === 0) continue;
      const mat = SOLIDS[g.solid[c] - 1];
      const i = c % nx;
      const j = (c - i) / nx;
      for (let k = 0; k < 4; k += 1) {
        const ii = k === 0 ? i - 1 : k === 1 ? i + 1 : i;
        const jj = k === 2 ? j - 1 : k === 3 ? j + 1 : j;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
        const nb = ii + jj * nx;
        if (g.solid[nb] !== 0) continue;
        rng.state = hash3(seed, c, k) || 1;
        const base = Math.pow(rRef / mat.cavRmax, LC_N);
        let S = 0;
        for (let q = 0; q < SITES_PER_FACE; q += 1) {
          S += rng.exp();
          const r = rRef * Math.pow(S / (area * mat.cavScale) + base, -1 / LC_N);
          if (r < R_MIN) break;
          cell.push(c);
          fluid.push(nb);
          dir.push(k);
          rad.push(r);
          pos.push(rng.next());
          dep.push(rng.next());
        }
      }
    }
    this.count = cell.length;
    this.cell = Int32Array.from(cell);
    this.fluid = Int32Array.from(fluid);
    this.dir = Uint8Array.from(dir);
    this.r = Float32Array.from(rad);
    this.s = Float32Array.from(pos);
    this.z = Float32Array.from(dep);
    this.bubble = new Uint32Array(cell.length);
  }

  /** Grösster Mündungsradius einer Kavität aus Werkstoff `id` (m). */
  largest(g: Grid, id: string): number {
    let best = 0;
    for (let q = 0; q < this.count; q += 1) if (SOLIDS[g.solid[this.cell[q]] - 1].id === id && this.r[q] > best) best = this.r[q];
    return best;
  }

  /** Mitte einer Blase des Radius r an der Kavität q: auf der Fläche, um r ins Fluid gerückt (ein wiederverwendeter Puffer). */
  position(g: Grid, q: number, r: number): Float64Array {
    const c = this.cell[q];
    const i = c % g.nx;
    const j = (c - i) / g.nx;
    const t = this.s[q];
    const k = this.dir[q];
    const dx = g.dx;
    if (k === 0) { this.pos[0] = i * dx - r; this.pos[1] = (j + t) * dx; }
    else if (k === 1) { this.pos[0] = (i + 1) * dx + r; this.pos[1] = (j + t) * dx; }
    else if (k === 2) { this.pos[0] = (i + t) * dx; this.pos[1] = j * dx - r; }
    else { this.pos[0] = (i + t) * dx; this.pos[1] = (j + 1) * dx + r; }
    return this.pos;
  }
}
