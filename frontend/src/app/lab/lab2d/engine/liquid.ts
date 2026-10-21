/**
 * LABOR 2D (v2) — DIE FLÜSSIGKEIT (ARCHITECTURE.md §7): APIC-Teilchen auf dem
 * MAC-Gitter.
 *
 * - Übertragung mit quadratischen B-Splines (Jiang et al. 2015, „The Affine
 *   Particle-In-Cell Method“): Impuls m_p (u_p + C_p (x_i − x_p)) zu den
 *   Flächen, zurück u_p = Σ w u_i und C_p = (4/Δx²) Σ w u_i (x_i − x_p)
 *   (D = Δx²/4 für quadratische B-Splines). Ausgangspunkt: Ten Minute Physics,
 *   Folge 18 (FLIP, MIT-Lizenz) und Bridson (2015), Kap. 7.
 * - Volumenanteil φ = Σ w m_p/ρ(T_p)/V_Zelle (+ φ_s für die Wände, die keine
 *   Teilchen haben) + α_b der Blasen; eine Zelle ist flüssig bei φ + α_b ≥ ½.
 * - Schwerkraft g·ρ(T)/ρ_ref auf den Flächen, Projektion mit konstanter Dichte
 *   ρ_ref (nie zusammen mit einer Projektion veränderlicher Dichte): der Druck
 *   ist der wahre hydrostatische, warmes Wasser steigt, das Dichtemaximum bei
 *   4 °C bleibt.
 * - Quelle der Divergenz S_l: die Volumenänderung jedes Teilchens im letzten
 *   Schritt (Wärmeausdehnung, Verdampfen, Kondensieren) und der Blasen, dazu
 *   der Driftausgleich k_d (φ + α_b − 1)/Δt (Kompression überall, im Inneren
 *   beide Vorzeichen) — er wirkt auf das Volumen, nicht auf die Teilchenzahl.
 * - Projektion mit freier Oberfläche (Gaszellen: Dirichlet, der Druck ihres
 *   Gasgebiets), undurchlässige Wände; PCG mit Mehrgitter auf dem
 *   umschliessenden Rechteck der Flüssigkeit.
 * - Transport: RK2 im Gitterfeld; wer in einem Feststoff landet, wird längs
 *   des Abstandsfelds hinausgeschoben (die Normalgeschwindigkeit fällt weg);
 *   wer eine offene Seite verlässt, ist „entwichen“.
 */

import type { Grid } from './grid';
import type { Particles } from './particles';
import { LIQUIDS, muLiq, rhoLiq, WATER } from './materials';
import { GridSolver, type SolveResult } from './solver';
import { GAS, LIQUID, SOLID } from './units';

/** Driftausgleich: Anteil des Volumenfehlers, der je Schritt behoben wird (Modellparameter). */
export const DRIFT_GAIN = 0.1;
/** Unterhalb dieser Masse (Anteil der Nennmasse) zählt eine Fläche als leer. */
const EMPTY = 1e-9;

/** Gewichte des quadratischen B-Splines für eine Koordinate s (in Zellen, Knoten bei ganzen Zahlen): Basis i0 und drei Gewichte. */
function bspline(s: number, w: Float64Array, o: number): number {
  const i0 = Math.floor(s - 0.5);
  const f = s - i0;
  const a = 1.5 - f;
  const c = f - 0.5;
  w[o] = 0.5 * a * a;
  w[o + 1] = 0.75 - (f - 1) * (f - 1);
  w[o + 2] = 0.5 * c * c;
  return i0;
}

export interface LiquidStats {
  solve: SolveResult;
  cells: number;
  uMax: number;
  /** Entwichen durch offene Seiten in diesem Schritt: Wasser (kg), andere Flüssigkeiten (kg), Energie (J). */
  escapedMass: number;
  escapedOther: number;
  escapedEnergy: number;
  /** Iterationen der beiden Zähigkeitslösungen (u, v); 0 ohne zähe Flüssigkeit. */
  viscIterations: number;
}

export class Liquid {
  private readonly g: Grid;
  private readonly P: Particles;
  private readonly solver: GridSolver;
  /* Flächen: Masse, Impuls, Dichteverhältnis (v), bekannt? */
  private readonly mu: Float64Array;
  private readonly pu: Float64Array;
  private readonly mv: Float64Array;
  private readonly pv: Float64Array;
  private readonly rv: Float64Array;
  readonly knownU: Uint8Array;
  readonly knownV: Uint8Array;
  private readonly tmpU: Float32Array;
  private readonly tmpV: Float32Array;
  private readonly markU: Uint8Array;
  private readonly markV: Uint8Array;
  /** Je Teilchen: linke untere Zelle (i, j) der 3 × 3-Umgebung der Zellmitten (kann −1 sein) und die rohen Gewichte. */
  readonly bi: Int16Array;
  readonly bj: Int16Array;
  readonly wr: Float32Array;
  /** Dieselben Gewichte, nur über flüssigen Zellen und auf Summe 1 gebracht (Wärme, Verdampfen): gleiche Gewichte hin und zurück. */
  readonly wt: Float32Array;
  /** Volumenänderung jedes Teilchens seit dem letzten Flüssigkeitsschritt (m³) — Quelle der Divergenz. */
  readonly dVp: Float64Array;
  /** Volumenquellen der Blasen und Platzen je Zelle (m³/s), aus den Stufen danach. */
  readonly volSrc: Float64Array;
  /** Kraft der Blasen auf die Flüssigkeit je Fläche (N). */
  readonly fU: Float64Array;
  readonly fV: Float64Array;
  /** Druck des Gasgebiets jeder Gaszelle über p_ref (Pa) — Dirichlet-Werte der Oberfläche. */
  readonly pGas: Float32Array;
  private readonly w = new Float64Array(12);
  /** Mittlere Dichte der Flüssigkeit (kg/m³) — die konstante Dichte der Projektion. */
  rhoRef = 998;
  weightsDirty = true;
  readonly last: LiquidStats = { solve: { iterations: 0, residual: 0, capped: false }, cells: 0, uMax: 0, escapedMass: 0, escapedOther: 0, escapedEnergy: 0, viscIterations: 0 };
  private escM = 0;
  private escO = 0;
  private escE = 0;
  /** Gibt es in diesem Schritt eine andere Flüssigkeit als Wasser (dann Zähigkeit, M2a)? */
  private viscous = false;
  /** Zähigkeit je Fläche (massengewichtet aus den Teilchen, Pa·s) und der Löser der Zähigkeit (bei Bedarf angelegt). */
  private etaU: Float64Array | null = null;
  private etaV: Float64Array | null = null;
  private vsolver: GridSolver | null = null;

  constructor(grid: Grid, particles: Particles, solver: GridSolver) {
    this.g = grid;
    this.P = particles;
    this.solver = solver;
    this.mu = new Float64Array(grid.nu);
    this.pu = new Float64Array(grid.nu);
    this.mv = new Float64Array(grid.nv);
    this.pv = new Float64Array(grid.nv);
    this.rv = new Float64Array(grid.nv);
    this.knownU = new Uint8Array(grid.nu);
    this.knownV = new Uint8Array(grid.nv);
    this.tmpU = new Float32Array(grid.nu);
    this.tmpV = new Float32Array(grid.nv);
    this.markU = new Uint8Array(grid.nu);
    this.markV = new Uint8Array(grid.nv);
    const cap = particles.cap;
    this.bi = new Int16Array(cap);
    this.bj = new Int16Array(cap);
    this.wr = new Float32Array(9 * cap);
    this.wt = new Float32Array(9 * cap);
    this.dVp = new Float64Array(cap);
    this.volSrc = new Float64Array(grid.n);
    this.fU = new Float64Array(grid.nu);
    this.fV = new Float64Array(grid.nv);
    this.pGas = new Float32Array(grid.n);
  }

  /* -- Gewichte der Zellmitten ------------------------------------------------------------------ */

  /** Rohe Zellgewichte jedes Teilchens (nach dem Transport und nach jedem Werkzeug). */
  computeWeights(): void {
    const { P, g, w, bi, bj, wr } = this;
    const inv = 1 / g.dx;
    for (let p = 0; p < P.count; p += 1) {
      bi[p] = bspline(P.x[p] * inv - 0.5, w, 0);
      bj[p] = bspline(P.y[p] * inv - 0.5, w, 3);
      const o = 9 * p;
      for (let b = 0; b < 3; b += 1) for (let a = 0; a < 3; a += 1) wr[o + a + 3 * b] = w[a] * w[3 + b];
    }
    this.weightsDirty = false;
  }

  /** Index der Zelle k (0–8) der Umgebung von p, oder −1 ausserhalb. */
  cellOf(p: number, k: number): number {
    const g = this.g;
    const i = this.bi[p] + (k % 3);
    const j = this.bj[p] + ((k / 3) | 0);
    return i < 0 || j < 0 || i >= g.nx || j >= g.ny ? -1 : i + j * g.nx;
  }

  /** Ein Teilchen entfernen — mit allem, was dieses Modul je Teilchen weiss (das letzte rückt nach). */
  removeParticle(p: number): void {
    const q = this.P.count - 1;
    if (p !== q) {
      this.bi[p] = this.bi[q];
      this.bj[p] = this.bj[q];
      this.dVp[p] = this.dVp[q];
      for (let k = 0; k < 9; k += 1) { this.wr[9 * p + k] = this.wr[9 * q + k]; this.wt[9 * p + k] = this.wt[9 * q + k]; }
    }
    this.P.remove(p);
  }

  /** Die Wärmegewichte: rohe Gewichte nur über flüssigen Zellen, auf Summe 1; sonst die eigene Zelle. */
  computeHeatWeights(): void {
    const { P, g, bi, bj, wr, wt } = this;
    const { nx, ny, kind } = g;
    for (let p = 0; p < P.count; p += 1) {
      const o = 9 * p;
      const i0 = bi[p];
      const j0 = bj[p];
      let sum = 0;
      for (let k = 0; k < 9; k += 1) {
        const i = i0 + (k % 3);
        const j = j0 + ((k / 3) | 0);
        const ok = i >= 0 && j >= 0 && i < nx && j < ny && kind[i + j * nx] === LIQUID;
        const v = ok ? wr[o + k] : 0;
        wt[o + k] = v;
        sum += v;
      }
      if (sum > 0) {
        const s = 1 / sum;
        for (let k = 0; k < 9; k += 1) wt[o + k] *= s;
      } else {
        /* Kein flüssiger Nachbar (ein einzelner Tropfen): alles in die eigene Zelle — die Mitte der Umgebung. */
        for (let k = 0; k < 9; k += 1) wt[o + k] = 0;
        wt[o + 4] = 1;
      }
    }
  }

  /**
   * Ein mitten im Schritt angelegtes Teilchen (Kondensat, Wandfilm): seine
   * rohen Gewichte und Wärmegewichte sofort, und keine Volumenänderung aus dem
   * Platz, den es erbt — sonst läsen die folgenden Stufen die Werte des
   * Teilchens, das zuletzt an dieser Stelle stand.
   */
  placeParticle(p: number): void {
    const { P, g, w, bi, bj, wr, wt } = this;
    const { nx, ny, kind } = g;
    const inv = 1 / g.dx;
    bi[p] = bspline(P.x[p] * inv - 0.5, w, 0);
    bj[p] = bspline(P.y[p] * inv - 0.5, w, 3);
    const o = 9 * p;
    let sum = 0;
    for (let b = 0; b < 3; b += 1) {
      for (let a = 0; a < 3; a += 1) {
        const k = a + 3 * b;
        const v = w[a] * w[3 + b];
        wr[o + k] = v;
        const i = bi[p] + a;
        const j = bj[p] + b;
        const ok = i >= 0 && j >= 0 && i < nx && j < ny && kind[i + j * nx] === LIQUID;
        wt[o + k] = ok ? v : 0;
        if (ok) sum += v;
      }
    }
    if (sum > 0) { for (let k = 0; k < 9; k += 1) wt[o + k] /= sum; }
    else { for (let k = 0; k < 9; k += 1) wt[o + k] = 0; wt[o + 4] = 1; }
    this.dVp[p] = 0;
  }

  /* -- Teilchen → Gitter ---------------------------------------------------------------------- */

  /** Volumenanteil φ (nur Teilchen) je Zelle und ρ_ref. */
  splatVolume(): void {
    const { P, g, bi, bj, wr } = this;
    const { nx, ny, phi } = g;
    phi.fill(0);
    const invV = 1 / g.vCell;
    let mass = 0;
    let vol = 0;
    for (let p = 0; p < P.count; p += 1) {
      const vp = P.mass[p] / P.rho[p];
      mass += P.mass[p];
      vol += vp;
      const o = 9 * p;
      const i0 = bi[p];
      const j0 = bj[p];
      for (let k = 0; k < 9; k += 1) {
        const i = i0 + (k % 3);
        const j = j0 + ((k / 3) | 0);
        if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
        phi[i + j * nx] += wr[o + k] * vp * invV;
      }
    }
    if (vol > 0) this.rhoRef = mass / vol;
  }

  /**
   * Arten der Zellen aus φ + φ_s + α_b. Gas kommt nur aus Gas: eine Zelle wird
   * erst Gas, wenn sie es schon war oder an Gas (oder eine offene Seite)
   * grenzt — eine Lücke mitten im Wasser (eine eben kollabierte Blase) bleibt
   * flüssig, und der Driftausgleich füllt sie wieder. Sonst entstünde eine
   * Gaszelle ohne Gas (Dichte null).
   */
  classify(prev: Uint8Array | null = null): number {
    const g = this.g;
    const { nx, ny } = g;
    let liquid = 0;
    for (let c = 0; c < g.n; c += 1) {
      if (g.solid[c] !== 0) { g.kind[c] = SOLID; continue; }
      const f = g.phi[c];
      let isLiquid = f > 0 && f + g.phiS[c] + g.alpha[c] >= 0.5;
      if (!isLiquid && prev !== null && prev[c] !== GAS && prev[c] !== SOLID) {
        const i = c % nx;
        const j = (c - i) / nx;
        const gasNear = (i > 0 ? prev[c - 1] === GAS : g.openL) || (i < nx - 1 ? prev[c + 1] === GAS : g.openR)
          || (j > 0 ? prev[c - nx] === GAS : g.openB) || (j < ny - 1 ? prev[c + nx] === GAS : g.openT);
        if (!gasNear) isLiquid = true;
      }
      g.kind[c] = isLiquid ? LIQUID : GAS;
      if (isLiquid) liquid += 1;
    }
    return liquid;
  }

  /** APIC: Masse und Impuls zu den Flächen; dazu das massengewichtete Dichteverhältnis auf den v-Flächen. */
  private p2g(): void {
    const { P, g, w, mu, pu, mv, pv, rv } = this;
    const { nx, ny, dx } = g;
    const inv = 1 / dx;
    const nxu = nx + 1;
    mu.fill(0); pu.fill(0); mv.fill(0); pv.fill(0); rv.fill(0);
    const rr = 1 / this.rhoRef;
    /* Mit einer zähen Flüssigkeit: Σ w m η je Fläche (die Zähigkeit der Fläche ist das massengewichtete Mittel). */
    const viscous = this.viscous;
    if (viscous && (this.etaU === null || this.etaV === null)) { this.etaU = new Float64Array(g.nu); this.etaV = new Float64Array(g.nv); }
    const etaU = this.etaU as Float64Array;
    const etaV = this.etaV as Float64Array;
    if (viscous) { etaU.fill(0); etaV.fill(0); }
    for (let p = 0; p < P.count; p += 1) {
      const x = P.x[p];
      const y = P.y[p];
      const m = P.mass[p];
      const eta = viscous ? muLiq(P.mat[p], P.T[p]) : 0;
      const ux = P.vx[p];
      const uy = P.vy[p];
      const c00 = P.c00[p], c01 = P.c01[p], c10 = P.c10[p], c11 = P.c11[p];
      const sx = x * inv;
      const sy = y * inv;
      /* u-Flächen: Knoten bei (i, j + ½); Knoten ausserhalb fallen gespiegelt auf innere (mirrorU). */
      let i0 = bspline(sx, w, 0);
      let j0 = bspline(sy - 0.5, w, 3);
      for (let b = 0; b < 3; b += 1) {
        const j = j0 + b;
        const dyn = (j + 0.5) * dx - y;
        for (let a = 0; a < 3; a += 1) {
          const i = i0 + a;
          const wm = w[a] * w[3 + b] * m;
          const mom = wm * (ux + c00 * (i * dx - x) + c01 * dyn);
          if (i >= 0 && i <= nx && j >= 0 && j < ny) {
            const f = i + j * nxu;
            mu[f] += wm;
            pu[f] += mom;
            if (viscous) etaU[f] += wm * eta;
          } else {
            this.mirrorU(i, j);
            mu[this.mf] += wm;
            pu[this.mf] += this.ms * mom;
            if (viscous) etaU[this.mf] += wm * eta;
          }
        }
      }
      /* v-Flächen: Knoten bei (i + ½, j). */
      i0 = bspline(sx - 0.5, w, 0);
      j0 = bspline(sy, w, 3);
      const ratio = P.rho[p] * rr;
      for (let b = 0; b < 3; b += 1) {
        const j = j0 + b;
        const dyn = j * dx - y;
        for (let a = 0; a < 3; a += 1) {
          const i = i0 + a;
          const wm = w[a] * w[3 + b] * m;
          const mom = wm * (uy + c10 * ((i + 0.5) * dx - x) + c11 * dyn);
          let f: number;
          let sign = 1;
          if (i >= 0 && i < nx && j >= 0 && j <= ny) f = i + j * nx;
          else { this.mirrorV(i, j); f = this.mf; sign = this.ms; }
          mv[f] += wm;
          pv[f] += sign * mom;
          rv[f] += wm * ratio;
          if (viscous) etaV[f] += wm * eta;
        }
      }
    }
  }

  /* Gespiegelte Knoten (Ergebnis in mf, ms: Index des inneren Knotens und Vorzeichen). */
  private mf = 0;
  private ms = 1;

  /**
   * Ein u-Knoten ausserhalb der Kiste: an einer Wandseite das Spiegelbild —
   * die Normalkomponente (u an linker/rechter Wand) mit umgekehrtem
   * Vorzeichen, die Tangentialkomponente (u an Boden/Decke) gleich (freies
   * Gleiten); an einer offenen Seite der Randknoten selbst. Ohne das fehlten
   * Knoten, das Moment Σ w (x_i − x_p)² wäre nicht Δx²/4, und APIC bekäme an
   * den Wänden eine falsche affine Matrix (ein Teilchen klettert die Wand
   * hinauf). Teilchen → Gitter und zurück benutzen dieselbe Abbildung.
   */
  private mirrorU(iIn: number, jIn: number): void {
    const g = this.g;
    const { nx, ny } = g;
    let i = iIn;
    let j = jIn;
    let s = 1;
    if (i < 0) { if (g.openL) i = 0; else { i = -i; s = -s; } }
    else if (i > nx) { if (g.openR) i = nx; else { i = 2 * nx - i; s = -s; } }
    if (j < 0) j = g.openB ? 0 : -1 - j;
    else if (j >= ny) j = g.openT ? ny - 1 : 2 * ny - 1 - j;
    i = Math.min(nx, Math.max(0, i));
    j = Math.min(ny - 1, Math.max(0, j));
    this.mf = i + j * (nx + 1);
    this.ms = s;
  }

  /** Dasselbe für v-Knoten: tangential an linker/rechter Wand, normal an Boden und Decke. */
  private mirrorV(iIn: number, jIn: number): void {
    const g = this.g;
    const { nx, ny } = g;
    let i = iIn;
    let j = jIn;
    let s = 1;
    if (i < 0) i = g.openL ? 0 : -1 - i;
    else if (i >= nx) i = g.openR ? nx - 1 : 2 * nx - 1 - i;
    if (j < 0) { if (g.openB) j = 0; else { j = -j; s = -s; } }
    else if (j > ny) { if (g.openT) j = ny; else { j = 2 * ny - j; s = -s; } }
    i = Math.min(nx - 1, Math.max(0, i));
    j = Math.min(ny, Math.max(0, j));
    this.mf = i + j * nx;
    this.ms = s;
  }

  /* -- Ein Schritt ------------------------------------------------------------------------------- */

  /**
   * Der Flüssigkeitsschritt ab „Teilchen → Gitter“ (φ und Arten sind schon
   * bestimmt). `gy`: Fallbeschleunigung (Betrag), `pRef`: Bezugsdruck,
   * `tol`: relatives Residuum der Projektion.
   */
  step(dt: number, gy: number, tol: number, maxIter: number): LiquidStats {
    const { g, P } = this;
    const { nx, ny, dx, kind } = g;
    const nxu = nx + 1;
    /* Zähigkeit nur mit einer anderen Flüssigkeit als Wasser: Wasser ist auf Zellgrösse reibungsfrei (wie in M1, ohne Kosten). */
    this.viscous = P.hasOther();
    this.p2g();
    const { mu, pu, mv, pv, rv, knownU, knownV } = this;
    const ul = g.ul;
    const vl = g.vl;
    const nominal = this.rhoRef * g.vCell * 0.25;
    const empty = EMPTY * nominal;

    /*
     * Geschwindigkeiten der Flächen, Schwerkraft g·ρ(T)/ρ_ref, Kräfte der
     * Blasen. Mit Zähigkeit kommen die Kräfte erst nach ihr: sie wirkt auf die
     * bewegte Flüssigkeit, nicht auf den Schub der Schwerkraft, den die
     * Projektion gleich wieder aufhebt (an haftenden Wänden dämpfte sie ihn
     * ungleich, und ruhende Schichten kreisten mit Zentimetern je Sekunde).
     */
    const visc = this.viscous;
    for (let f = 0; f < g.nu; f += 1) {
      ul[f] = mu[f] > empty ? pu[f] / mu[f] + (visc ? 0 : (dt * this.fU[f]) / (this.rhoRef * g.vCell)) : 0;
    }
    for (let f = 0; f < g.nv; f += 1) {
      vl[f] = mv[f] > empty ? pv[f] / mv[f] + (visc ? 0 : -dt * gy * (rv[f] / mv[f]) + (dt * this.fV[f]) / (this.rhoRef * g.vCell)) : 0;
    }

    /* Welche Flächen gehören zur Flüssigkeit, welche sind fest? */
    for (let j = 0; j < ny; j += 1) {
      for (let i = 0; i <= nx; i += 1) {
        const f = i + j * nxu;
        const l = i > 0 ? kind[i - 1 + j * nx] : -1;
        const r = i < nx ? kind[i + j * nx] : -1;
        const wallL = i === 0 && !g.openL;
        const wallR = i === nx && !g.openR;
        if (wallL || wallR || l === SOLID || r === SOLID) { ul[f] = 0; knownU[f] = 2; continue; }
        knownU[f] = l === LIQUID || r === LIQUID ? 1 : 0;
      }
    }
    for (let j = 0; j <= ny; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        const f = i + j * nx;
        const b = j > 0 ? kind[i + (j - 1) * nx] : -1;
        const t = j < ny ? kind[i + j * nx] : -1;
        const wallB = j === 0 && !g.openB;
        const wallT = j === ny && !g.openT;
        if (wallB || wallT || b === SOLID || t === SOLID) { vl[f] = 0; knownV[f] = 2; continue; }
        knownV[f] = b === LIQUID || t === LIQUID ? 1 : 0;
      }
    }

    /* Zähigkeit implizit, dann die Kräfte (vor der Projektion, die danach die Divergenz entfernt). */
    this.last.viscIterations = 0;
    if (visc) {
      this.viscosity(dt);
      const a = dt / (this.rhoRef * g.vCell);
      for (let f = 0; f < g.nu; f += 1) if (knownU[f] !== 2 && mu[f] > empty) ul[f] += a * this.fU[f];
      for (let f = 0; f < g.nv; f += 1) if (knownV[f] !== 2 && mv[f] > empty) vl[f] += -dt * gy * (rv[f] / mv[f]) + a * this.fV[f];
    }

    /* Projektion auf dem umschliessenden Rechteck der Flüssigkeit. */
    let i0 = nx, i1 = -1, j0 = ny, j1 = -1, cells = 0;
    for (let j = 0; j < ny; j += 1) for (let i = 0; i < nx; i += 1) {
      if (kind[i + j * nx] !== LIQUID) continue;
      cells += 1;
      if (i < i0) i0 = i;
      if (i > i1) i1 = i;
      if (j < j0) j0 = j;
      if (j > j1) j1 = j;
    }
    const st = this.last.solve;
    st.iterations = 0; st.residual = 0; st.capped = false;
    if (cells > 0) {
      const sx = i1 - i0 + 1;
      const sy = j1 - j0 + 1;
      const S = this.solver;
      const sys = S.begin(sx, sy);
      const a = dt / this.rhoRef;
      const invV = 1 / g.vCell;
      const pGas = this.pGas;
      for (let j = j0; j <= j1; j += 1) {
        for (let i = i0; i <= i1; i += 1) {
          const c = i + j * nx;
          if (kind[c] !== LIQUID) continue;
          const s = S.at(i - i0, j - j0);
          sys.act[s] = 1;
          sys.x[s] = g.pl[c];
          const fl = i + j * nxu;
          const fb = i + j * nx;
          const div = ul[fl + 1] - ul[fl] + vl[fb + nx] - vl[fb];
          /* Quelle: Volumenänderungen (m³/s je Zelle) plus Driftausgleich. */
          const phiTot = g.phi[c] + g.phiS[c] + g.alpha[c];
          let src = (this.volSrc[c] * invV);
          const surface = this.gasAt(i - 1, j) || this.gasAt(i + 1, j) || this.gasAt(i, j - 1) || this.gasAt(i, j + 1);
          const err = phiTot - 1;
          if (err > 0 || !surface) src += (DRIFT_GAIN * err) / dt;
          let b = src * dx * dx - dx * div;
          /* Rechts. */
          if (i + 1 < nx) {
            const k = kind[c + 1];
            if (k === LIQUID) { if (i + 1 <= i1) sys.ax[s] = a; }
            else if (k === GAS) { sys.dDx[s] += a; b += a * pGas[c + 1]; }
          } else if (g.openR) { sys.dDx[s] += 2 * a; }
          /* Links (die Kopplung zu einer flüssigen Nachbarzelle steht bei ihr). */
          if (i > 0) {
            const k = kind[c - 1];
            if (k === GAS) { sys.dDx[s] += a; b += a * pGas[c - 1]; }
          } else if (g.openL) { sys.dDx[s] += 2 * a; }
          /* Oben. */
          if (j + 1 < ny) {
            const k = kind[c + nx];
            if (k === LIQUID) { if (j + 1 <= j1) sys.ay[s] = a; }
            else if (k === GAS) { sys.dDy[s] += a; b += a * pGas[c + nx]; }
          } else if (g.openT) { sys.dDy[s] += 2 * a; }
          /* Unten. */
          if (j > 0) {
            const k = kind[c - nx];
            if (k === GAS) { sys.dDy[s] += a; b += a * pGas[c - nx]; }
          } else if (g.openB) { sys.dDy[s] += 2 * a; }
          sys.b[s] = b;
        }
      }
      const res = S.solve(tol, maxIter, true);
      st.iterations = res.iterations; st.residual = res.residual; st.capped = res.capped;
      /* Druck zurück und die Flächen korrigieren. */
      const pl = g.pl;
      for (let c = 0; c < g.n; c += 1) pl[c] = kind[c] === GAS ? pGas[c] : 0;
      for (let j = j0; j <= j1; j += 1) for (let i = i0; i <= i1; i += 1) {
        const c = i + j * nx;
        if (kind[c] === LIQUID) pl[c] = sys.x[S.at(i - i0, j - j0)];
      }
      for (let j = 0; j < ny; j += 1) {
        for (let i = 0; i <= nx; i += 1) {
          const f = i + j * nxu;
          if (knownU[f] !== 1) continue;
          if (i === 0) { ul[f] -= (a / dx) * 2 * (pl[j * nx] - 0); continue; }
          if (i === nx) { ul[f] -= (a / dx) * 2 * (0 - pl[nx - 1 + j * nx]); continue; }
          ul[f] -= (a / dx) * (pl[i + j * nx] - pl[i - 1 + j * nx]);
        }
      }
      for (let j = 0; j <= ny; j += 1) {
        for (let i = 0; i < nx; i += 1) {
          const f = i + j * nx;
          if (knownV[f] !== 1) continue;
          if (j === 0) { vl[f] -= (a / dx) * 2 * (pl[i] - 0); continue; }
          if (j === ny) { vl[f] -= (a / dx) * 2 * (0 - pl[i + (ny - 1) * nx]); continue; }
          vl[f] -= (a / dx) * (pl[i + j * nx] - pl[i + (j - 1) * nx]);
        }
      }
    }
    this.extrapolate();

    /* Gitter → Teilchen (APIC), dann der Transport. */
    const uMax = this.g2p();
    this.advect(dt, gy);
    this.dVp.fill(0, 0, P.count);
    this.volSrc.fill(0);
    this.fU.fill(0);
    this.fV.fill(0);
    this.computeWeights();
    const L = this.last;
    L.cells = cells;
    L.uMax = uMax;
    L.escapedMass = this.escM;
    L.escapedOther = this.escO;
    L.escapedEnergy = this.escE;
    return L;
  }

  /**
   * Zähigkeit (M2a), implizit je Komponente mit der konstanten Dichte der
   * Projektion:
   *
   *   ρ_ref Δx²/Δt (u* − u) = Σ_Nachbarn η_f (u_nb − u*)
   *
   * (je Flächen-Kontrollvolumen Δx × Δx der Tiefe D, geteilt durch D). η_f
   * zwischen zwei Flächen: harmonisches Mittel ihrer massengewichteten
   * Zähigkeit. Ränder: an Wänden und Feststoffen haftet die Flüssigkeit
   * (u = 0; quer zur Wand im halben Abstand: 2η), an der freien Oberfläche
   * und zu leeren Flächen keine Spannung. Die vereinfachte Form ∇·(η∇u)
   * ohne die Glieder ∇·(η (∇u)ᵀ) (SIMPLIFICATIONS.md). SPD, CG mit Jacobi.
   */
  private viscosity(dt: number): void {
    const g = this.g;
    const { nx, ny, dx, kind } = g;
    if (this.vsolver === null) this.vsolver = new GridSolver(nx + 1, ny + 1);
    const S = this.vsolver;
    const etaU = this.etaU as Float64Array;
    const etaV = this.etaV as Float64Array;
    const { mu, mv, knownU, knownV } = this;
    const empty = EMPTY * this.rhoRef * g.vCell * 0.25;
    for (let f = 0; f < g.nu; f += 1) etaU[f] = mu[f] > empty ? etaU[f] / mu[f] : 0;
    for (let f = 0; f < g.nv; f += 1) etaV[f] = mv[f] > empty ? etaV[f] / mv[f] : 0;
    const dH = (this.rhoRef * dx * dx) / dt;
    const hm = (a: number, b: number): number => (a + b > 0 ? (2 * a * b) / (a + b) : 0);
    void kind;
    let its = 0;
    /* u-Flächen: Gitter (nx + 1) × ny. */
    {
      const nxu = nx + 1;
      const sys = S.begin(nxu, ny);
      const ul = g.ul;
      for (let j = 0; j < ny; j += 1) {
        for (let i = 0; i <= nx; i += 1) {
          const f = i + j * nxu;
          if (knownU[f] !== 1) continue;
          const s = S.at(i, j);
          const e = etaU[f];
          sys.act[s] = 1;
          sys.dH[s] = dH;
          sys.x[s] = ul[f];
          sys.b[s] = dH * ul[f];
          /* Rechts (die Kopplung nach links steht beim linken Nachbarn); eine Wandfläche dort: u = 0 im Abstand Δx. */
          if (i + 1 <= nx) {
            const k = knownU[f + 1];
            if (k === 1) sys.ax[s] = hm(e, etaU[f + 1]);
            else if (k === 2) sys.dDx[s] += e;
          }
          if (i > 0 && knownU[f - 1] === 2) sys.dDx[s] += e;
          /* Oben und unten: Nachbarfläche, Feststoff (Wand im halben Abstand) oder Kistenrand. */
          if (j + 1 < ny) {
            const k = knownU[f + nxu];
            if (k === 1) sys.ay[s] = hm(e, etaU[f + nxu]);
            else if (k === 2) sys.dDy[s] += 2 * e;
          } else if (!g.openT) sys.dDy[s] += 2 * e;
          if (j > 0) { if (knownU[f - nxu] === 2) sys.dDy[s] += 2 * e; }
          else if (!g.openB) sys.dDy[s] += 2 * e;
        }
      }
      const res = S.solve(1e-6, 200, false);
      its += res.iterations;
      for (let j = 0; j < ny; j += 1) for (let i = 0; i <= nx; i += 1) {
        const f = i + j * nxu;
        if (knownU[f] === 1) ul[f] = sys.x[S.at(i, j)];
      }
    }
    /* v-Flächen: Gitter nx × (ny + 1). */
    {
      const sys = S.begin(nx, ny + 1);
      const vl = g.vl;
      for (let j = 0; j <= ny; j += 1) {
        for (let i = 0; i < nx; i += 1) {
          const f = i + j * nx;
          if (knownV[f] !== 1) continue;
          const s = S.at(i, j);
          const e = etaV[f];
          sys.act[s] = 1;
          sys.dH[s] = dH;
          sys.x[s] = vl[f];
          sys.b[s] = dH * vl[f];
          if (j + 1 <= ny) {
            const k = knownV[f + nx];
            if (k === 1) sys.ay[s] = hm(e, etaV[f + nx]);
            else if (k === 2) sys.dDy[s] += e;
          }
          if (j > 0 && knownV[f - nx] === 2) sys.dDy[s] += e;
          if (i + 1 < nx) {
            const k = knownV[f + 1];
            if (k === 1) sys.ax[s] = hm(e, etaV[f + 1]);
            else if (k === 2) sys.dDx[s] += 2 * e;
          } else if (!g.openR) sys.dDx[s] += 2 * e;
          if (i > 0) { if (knownV[f - 1] === 2) sys.dDx[s] += 2 * e; }
          else if (!g.openL) sys.dDx[s] += 2 * e;
        }
      }
      const res = S.solve(1e-6, 200, false);
      its += res.iterations;
      for (let j = 0; j <= ny; j += 1) for (let i = 0; i < nx; i += 1) {
        const f = i + j * nx;
        if (knownV[f] === 1) vl[f] = sys.x[S.at(i, j)];
      }
    }
    this.last.viscIterations = its;
  }

  /** Grenzt (i, j) an Gas — eine Gaszelle oder eine offene Seite? */
  private gasAt(i: number, j: number): boolean {
    const g = this.g;
    if (i < 0) return g.openL;
    if (i >= g.nx) return g.openR;
    if (j < 0) return g.openB;
    if (j >= g.ny) return g.openT;
    return g.kind[i + j * g.nx] === GAS;
  }

  /** Divergenzquelle aus den Volumenänderungen der Teilchen (vor dem Schritt aufgerufen, mit den alten Gewichten). */
  splatVolumeChange(dt: number): void {
    const { P, g, bi, bj, wr, dVp, volSrc } = this;
    const { nx, ny } = g;
    const inv = 1 / dt;
    for (let p = 0; p < P.count; p += 1) {
      const dv = dVp[p];
      if (dv === 0) continue;
      const o = 9 * p;
      const i0 = bi[p];
      const j0 = bj[p];
      for (let k = 0; k < 9; k += 1) {
        const i = i0 + (k % 3);
        const j = j0 + ((k / 3) | 0);
        if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
        volSrc[i + j * nx] += wr[o + k] * dv * inv;
      }
    }
  }

  /** Unbekannte Flächen aus bekannten Nachbarn derselben Komponente füllen (zwei Lagen). */
  private extrapolate(): void {
    const { g, knownU, knownV, tmpU, tmpV, markU, markV } = this;
    const { nx, ny } = g;
    const nxu = nx + 1;
    const ul = g.ul;
    const vl = g.vl;
    for (let f = 0; f < g.nu; f += 1) markU[f] = knownU[f] !== 0 ? 1 : 0;
    for (let f = 0; f < g.nv; f += 1) markV[f] = knownV[f] !== 0 ? 1 : 0;
    for (let layer = 0; layer < 2; layer += 1) {
      tmpU.set(ul);
      tmpV.set(vl);
      for (let j = 0; j < ny; j += 1) for (let i = 0; i <= nx; i += 1) {
        const f = i + j * nxu;
        if (markU[f] !== 0) continue;
        let s = 0, n = 0;
        if (i > 0 && markU[f - 1] === 1) { s += ul[f - 1]; n += 1; }
        if (i < nx && markU[f + 1] === 1) { s += ul[f + 1]; n += 1; }
        if (j > 0 && markU[f - nxu] === 1) { s += ul[f - nxu]; n += 1; }
        if (j < ny - 1 && markU[f + nxu] === 1) { s += ul[f + nxu]; n += 1; }
        if (n > 0) { tmpU[f] = s / n; markU[f] = 3; }
      }
      for (let j = 0; j <= ny; j += 1) for (let i = 0; i < nx; i += 1) {
        const f = i + j * nx;
        if (markV[f] !== 0) continue;
        let s = 0, n = 0;
        if (i > 0 && markV[f - 1] === 1) { s += vl[f - 1]; n += 1; }
        if (i < nx - 1 && markV[f + 1] === 1) { s += vl[f + 1]; n += 1; }
        if (j > 0 && markV[f - nx] === 1) { s += vl[f - nx]; n += 1; }
        if (j < ny && markV[f + nx] === 1) { s += vl[f + nx]; n += 1; }
        if (n > 0) { tmpV[f] = s / n; markV[f] = 3; }
      }
      ul.set(tmpU);
      vl.set(tmpV);
      for (let f = 0; f < g.nu; f += 1) if (markU[f] === 3) markU[f] = 1;
      for (let f = 0; f < g.nv; f += 1) if (markV[f] === 3) markV[f] = 1;
    }
    /* Weiter draussen: null (dort sind keine Teilchen). */
    for (let f = 0; f < g.nu; f += 1) if (markU[f] === 0) ul[f] = 0;
    for (let f = 0; f < g.nv; f += 1) if (markV[f] === 0) vl[f] = 0;
  }

  /** APIC zurück: Geschwindigkeit und affine Matrix jedes Teilchens; liefert die grösste Geschwindigkeit. */
  private g2p(): number {
    const { P, g, w } = this;
    const { nx, ny, dx } = g;
    const inv = 1 / dx;
    const nxu = nx + 1;
    const ul = g.ul;
    const vl = g.vl;
    const k4 = 4 / (dx * dx);
    let vmax2 = 0;
    for (let p = 0; p < P.count; p += 1) {
      const x = P.x[p];
      const y = P.y[p];
      const sx = x * inv;
      const sy = y * inv;
      let i0 = bspline(sx, w, 0);
      let j0 = bspline(sy - 0.5, w, 3);
      let u = 0, cu0 = 0, cu1 = 0;
      for (let b = 0; b < 3; b += 1) {
        const j = j0 + b;
        const dyn = (j + 0.5) * dx - y;
        for (let a = 0; a < 3; a += 1) {
          const i = i0 + a;
          const ww = w[a] * w[3 + b];
          let val: number;
          if (i >= 0 && i <= nx && j >= 0 && j < ny) val = ul[i + j * nxu];
          else { this.mirrorU(i, j); val = this.ms * ul[this.mf]; }
          u += ww * val;
          cu0 += ww * val * (i * dx - x);
          cu1 += ww * val * dyn;
        }
      }
      i0 = bspline(sx - 0.5, w, 0);
      j0 = bspline(sy, w, 3);
      let v = 0, cv0 = 0, cv1 = 0;
      for (let b = 0; b < 3; b += 1) {
        const j = j0 + b;
        const dyn = j * dx - y;
        for (let a = 0; a < 3; a += 1) {
          const i = i0 + a;
          const ww = w[a] * w[3 + b];
          let val: number;
          if (i >= 0 && i < nx && j >= 0 && j <= ny) val = vl[i + j * nx];
          else { this.mirrorV(i, j); val = this.ms * vl[this.mf]; }
          v += ww * val;
          cv0 += ww * val * ((i + 0.5) * dx - x);
          cv1 += ww * val * dyn;
        }
      }
      P.vx[p] = u;
      P.vy[p] = v;
      P.c00[p] = k4 * cu0;
      P.c01[p] = k4 * cu1;
      P.c10[p] = k4 * cv0;
      P.c11[p] = k4 * cv1;
      const s2 = u * u + v * v;
      if (s2 > vmax2) vmax2 = s2;
    }
    return Math.sqrt(vmax2);
  }

  /** Geschwindigkeit des Gitters an einem Punkt (bilinear je Komponente). */
  velocityAt(x: number, y: number, out: Float64Array): void {
    const g = this.g;
    const { nx, ny, dx } = g;
    const nxu = nx + 1;
    const inv = 1 / dx;
    /* u: Knoten bei (i, j + ½). */
    let fx = Math.min(nx - 1e-6, Math.max(0, x * inv));
    let fy = Math.min(ny - 1.000001, Math.max(0, y * inv - 0.5));
    let i = Math.floor(fx), j = Math.floor(fy);
    let tx = fx - i, ty = fy - j;
    const ul = g.ul;
    out[0] = (1 - ty) * ((1 - tx) * ul[i + j * nxu] + tx * ul[i + 1 + j * nxu]) + ty * ((1 - tx) * ul[i + (j + 1) * nxu] + tx * ul[i + 1 + (j + 1) * nxu]);
    fx = Math.min(nx - 1.000001, Math.max(0, x * inv - 0.5));
    fy = Math.min(ny - 1e-6, Math.max(0, y * inv));
    i = Math.floor(fx); j = Math.floor(fy);
    tx = fx - i; ty = fy - j;
    const vl = g.vl;
    out[1] = (1 - ty) * ((1 - tx) * vl[i + j * nx] + tx * vl[i + 1 + j * nx]) + ty * ((1 - tx) * vl[i + (j + 1) * nx] + tx * vl[i + 1 + (j + 1) * nx]);
  }

  private readonly vel = new Float64Array(2);

  /** Je Zelle die Masse jeder Flüssigkeit (für die Tröpfchen; bei Bedarf angelegt) und die vorherrschende. */
  private cellMat: Float64Array | null = null;
  private cellHost: Uint8Array | null = null;

  /**
   * Unaufgelöste Tröpfchen (M2a): ein Teilchen, dessen Flüssigkeit in seiner
   * Zelle in der Minderheit ist, ist ein Tropfen seines eigenen Volumens in der
   * vorherrschenden Flüssigkeit. Er bewegt sich gegen die Strömung mit seiner
   * Endgeschwindigkeit: |Δρ| g V = ½ ρ_c C_D A U² mit C_D = 24/Re · K (1 +
   * 0,15 Re^0,687) (Schiller & Naumann 1933) und dem Faktor K = (2μ_c +
   * 3μ_d)/(3μ_c + 3μ_d) für flüssige Tropfen (Hadamard–Rybczynski 1911).
   * Nur der Ort wandert, nicht der Impuls (die Mischung behält ihren);
   * höchstens eine Viertelzelle je Schritt. Ohne diese Drift trennten sich
   * zwei unmischbare Flüssigkeiten nicht unter der Zellgrösse: eine Zelle aus
   * zwei Wasser- und zwei Ölteilchen hat die mittlere Dichte und keinen
   * Auftrieb (SIMPLIFICATIONS.md).
   * Liefert die Drift je Teilchen in drift (m in y), 0 für die anderen.
   */
  private droplets(dt: number, gy: number, drift: Float64Array): boolean {
    const { P, g } = this;
    const { nx, ny, n } = g;
    const NL = LIQUIDS.length;
    if (this.cellMat === null || this.cellHost === null) { this.cellMat = new Float64Array(n * NL); this.cellHost = new Uint8Array(n); }
    const cm = this.cellMat;
    const host = this.cellHost;
    cm.fill(0);
    for (let p = 0; p < P.count; p += 1) {
      const i = Math.min(nx - 1, Math.max(0, Math.floor(P.x[p] / g.dx)));
      const j = Math.min(ny - 1, Math.max(0, Math.floor(P.y[p] / g.dx)));
      cm[(i + j * nx) * NL + P.mat[p]] += P.mass[p];
    }
    for (let c = 0; c < n; c += 1) {
      let best = 0;
      for (let l = 1; l < NL; l += 1) if (cm[c * NL + l] > cm[c * NL + best]) best = l;
      host[c] = best;
    }
    let any = false;
    const cap = 0.25 * g.dx;
    for (let p = 0; p < P.count; p += 1) {
      drift[p] = 0;
      const i = Math.min(nx - 1, Math.max(0, Math.floor(P.x[p] / g.dx)));
      const j = Math.min(ny - 1, Math.max(0, Math.floor(P.y[p] / g.dx)));
      const hc = host[i + j * nx];
      const md = P.mat[p];
      if (md === hc) continue;
      const T = P.T[p];
      const rc = rhoLiq(hc, T);
      const rd = P.rho[p];
      const muc = muLiq(hc, T);
      const mud = muLiq(md, T);
      const V = P.mass[p] / rd;
      const d = Math.cbrt((6 * V) / Math.PI);
      const dr = Math.abs(rc - rd);
      if (dr <= 0 || gy <= 0) continue;
      const K = (2 * muc + 3 * mud) / (3 * muc + 3 * mud);
      /* Endgeschwindigkeit: von Stokes (mit K) aus, dann einige Festpunktschritte mit dem Widerstand nach Schiller–Naumann. */
      let U = (dr * gy * d * d) / (18 * muc * K);
      for (let it = 0; it < 8; it += 1) {
        const Re = Math.max(1e-9, (rc * U * d) / muc);
        const CD = (24 / Re) * K * (1 + 0.15 * Math.pow(Re, 0.687));
        U = Math.sqrt((4 * dr * gy * d) / (3 * rc * CD));
      }
      const s = rd < rc ? 1 : -1;
      drift[p] = s * Math.min(cap, U * dt);
      any = true;
    }
    return any;
  }

  private dropletDrift: Float64Array | null = null;

  /** RK2 im Gitterfeld, Stoss an Feststoffen, Entweichen durch offene Seiten (Masse und Energie des Entwichenen in escM, escE); mit mehreren Flüssigkeiten die Drift der Tröpfchen. */
  private advect(dt: number, gy: number): void {
    const { P, g, vel } = this;
    const W = g.w;
    const H = g.h;
    const dx = g.dx;
    let escM = 0;
    let escO = 0;
    let escE = 0;
    let drift: Float64Array | null = null;
    if (this.viscous) {
      if (this.dropletDrift === null || this.dropletDrift.length < P.cap) this.dropletDrift = new Float64Array(P.cap);
      if (this.droplets(dt, gy, this.dropletDrift)) drift = this.dropletDrift;
    }
    for (let p = 0; p < P.count; p += 1) {
      const x0 = P.x[p];
      const y0 = P.y[p];
      this.velocityAt(x0, y0, vel);
      const xm = x0 + 0.5 * dt * vel[0];
      const ym = y0 + 0.5 * dt * vel[1];
      this.velocityAt(xm, ym, vel);
      let x = x0 + dt * vel[0];
      let y = y0 + dt * vel[1] + (drift !== null ? drift[p] : 0);
      /* Offene Seiten: hinaus ist hinaus. */
      if ((x < 0 && g.openL) || (x > W && g.openR) || (y < 0 && g.openB) || (y > H && g.openT)) {
        if (P.mat[p] === WATER) escM += P.mass[p]; else escO += P.mass[p];
        escE += P.mass[p] * P.h[p];
        /* Das letzte Teilchen rückt an p: seine Drift mit. */
        if (drift !== null) drift[p] = drift[P.count - 1];
        this.removeParticle(p);
        p -= 1;
        continue;
      }
      const m = 1e-4 * dx;
      x = Math.min(W - m, Math.max(m, x));
      y = Math.min(H - m, Math.max(m, y));
      /* Feststoffe: längs des Abstandsfelds hinaus, die Normalgeschwindigkeit fällt weg. */
      let d = g.sdfAt(x, y);
      if (d < 0.05 * dx) {
        for (let it = 0; it < 3 && d < 0.05 * dx; it += 1) {
          const e = 0.25 * dx;
          let nxv = g.sdfAt(x + e, y) - g.sdfAt(x - e, y);
          let nyv = g.sdfAt(x, y + e) - g.sdfAt(x, y - e);
          const len = Math.hypot(nxv, nyv);
          if (len < 1e-12) break;
          nxv /= len;
          nyv /= len;
          const push = 0.05 * dx - d;
          x += push * nxv;
          y += push * nyv;
          const vn = P.vx[p] * nxv + P.vy[p] * nyv;
          if (vn < 0) { P.vx[p] -= vn * nxv; P.vy[p] -= vn * nyv; }
          x = Math.min(W - m, Math.max(m, x));
          y = Math.min(H - m, Math.max(m, y));
          d = g.sdfAt(x, y);
        }
      }
      P.x[p] = x;
      P.y[p] = y;
    }
    this.escM = escM;
    this.escO = escO;
    this.escE = escE;
  }
}
