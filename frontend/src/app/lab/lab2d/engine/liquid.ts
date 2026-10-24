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
 *   Gasgebiets, an der Stelle zwischen den Zellmitten, wo φ ½ kreuzt — „ghost
 *   fluid“, Gibou et al. 2002, J. Comput. Phys. 176, 205; so steht der Druck in
 *   der Tiefe d genau bei ρ g d, auch wenn die Oberfläche zwischen zwei
 *   Zellmitten liegt: ein Körper schwimmt richtig tief, M3a), undurchlässige
 *   und bewegte Wände; PCG mit Mehrgitter auf dem umschliessenden Rechteck der
 *   Flüssigkeit.
 * - Transport: RK2 im Gitterfeld; wer in einem Feststoff landet, wird längs
 *   des Abstandsfelds hinausgeschoben (die Normalgeschwindigkeit fällt weg);
 *   wer eine offene Seite verlässt, ist „entwichen“. Tropfen fern der
 *   Flüssigkeit fliegen ballistisch und bleiben liegen, wo sie landen (M2b,
 *   extend.ts).
 */

import type { Grid } from './grid';
import type { Particles } from './particles';
import { extendVelocities, gridVelocityAt, markStranded } from './extend';
import { DropletDrift, solveViscosity } from './liquidMix';
import { moveParticles, type BodyHit, type Escaped } from './liquidMove';
import { muLiq } from './materials';
import { GridSolver, type SolveResult } from './solver';
import { GAS, LIQUID, SOLID } from './units';

/** Driftausgleich: Anteil des Volumenfehlers, der je Schritt behoben wird (Modellparameter). */
export const DRIFT_GAIN = 0.1;
/**
 * …aber nie schneller als über DRIFT_DT (s): sonst wächst die Korrektur mit 1/Δt, die Geschwindigkeit mit ihr, der
 * nächste Schritt wird kürzer — auf der heissen Platte lief das in 15 Schritten auf 5000 m/s (extremes.ts).
 */
export const DRIFT_DT = 5e-4;
/** Unterhalb dieser Masse (Anteil der Nennmasse) zählt eine Fläche als leer. */
const EMPTY = 1e-9;
/** Die Oberfläche rückt höchstens so nah an die Mitte einer Flüssigkeitszelle (Anteil des Abstands der Mitten) — sonst würde das System steif und das Rauschen von φ verstärkt. */
export const THETA_MIN = 0.1;

/** Volumenfluss einer Fläche (je Δx·D): eine feste ihr Randwert; offen zum Anteil a mit dem Wasser, der von einem Körper bedeckte Rest mit ihm. */
function flux(u: Float32Array, us: Float32Array, f: number, a: number, known: Uint8Array): number {
  if (known[f] === 2 || a >= 1) return u[f];
  return a * u[f] + (1 - a) * us[f];
}

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
  /** Entwichen durch offene Seiten in diesem Schritt: Wasser (kg, ohne sein Salz), andere Flüssigkeiten (kg), gelöstes Salz (kg), Energie (J). */
  escapedMass: number;
  escapedOther: number;
  escapedSalt: number;
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
  readonly last: LiquidStats = { solve: { iterations: 0, residual: 0, capped: false }, cells: 0, uMax: 0, escapedMass: 0, escapedOther: 0, escapedSalt: 0, escapedEnergy: 0, viscIterations: 0 };
  private escM = 0;
  private escO = 0;
  private escS = 0;
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
    g.updateThin();
    for (let p = 0; p < P.count; p += 1) {
      bi[p] = bspline(P.x[p] * inv - 0.5, w, 0);
      bj[p] = bspline(P.y[p] * inv - 0.5, w, 3);
      const o = 9 * p;
      for (let b = 0; b < 3; b += 1) for (let a = 0; a < 3; a += 1) wr[o + a + 3 * b] = w[a] * w[3 + b];
      /* Nichts hinter eine dünne Wand (die Mitte der Umgebung ist die Zelle des Teilchens). */
      if (g.thinAny) g.cutWeights(bi[p] + 1, bj[p] + 1, wr, o);
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
    for (let b = 0; b < 3; b += 1) for (let a = 0; a < 3; a += 1) wr[o + a + 3 * b] = w[a] * w[3 + b];
    if (g.thinAny) g.cutWeights(bi[p] + 1, bj[p] + 1, wr, o);
    let sum = 0;
    for (let k = 0; k < 9; k += 1) {
      const i = bi[p] + (k % 3);
      const j = bj[p] + ((k / 3) | 0);
      const ok = i >= 0 && j >= 0 && i < nx && j < ny && kind[i + j * nx] === LIQUID;
      wt[o + k] = ok ? wr[o + k] : 0;
      if (ok) sum += wr[o + k];
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
        const gasNear = (i > 0 ? prev[c - 1] === GAS && g.faceOpen(c, 0) > 0 : g.openL) || (i < nx - 1 ? prev[c + 1] === GAS && g.faceOpen(c, 1) > 0 : g.openR)
          || (j > 0 ? prev[c - nx] === GAS && g.faceOpen(c, 2) > 0 : g.openB) || (j < ny - 1 ? prev[c + nx] === GAS && g.faceOpen(c, 3) > 0 : g.openT);
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
        /* Fest: die Wand der Kiste ruht, ein Körper gibt seine Geschwindigkeit an der Fläche (grid.usol) — auch eine Fläche, die er ganz bedeckt, zwischen zwei Zellen mit Fluid. */
        if (wallL || wallR || l === SOLID || r === SOLID || g.au[f] <= 0) { ul[f] = wallL || wallR ? 0 : g.usol[f]; knownU[f] = 2; continue; }
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
        if (wallB || wallT || b === SOLID || t === SOLID || g.av[f] <= 0) { vl[f] = wallB || wallT ? 0 : g.vsol[f]; knownV[f] = 2; continue; }
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
          /* Fluss je Fläche: der offene Teil mit dem Wasser, der von einem Körper bedeckte mit dem Körper (Batty et al. 2007). */
          const aR = knownU[fl + 1] === 2 ? 0 : g.au[fl + 1];
          const aL = knownU[fl] === 2 ? 0 : g.au[fl];
          const aT = knownV[fb + nx] === 2 ? 0 : g.av[fb + nx];
          const aB = knownV[fb] === 2 ? 0 : g.av[fb];
          const div = flux(ul, g.usol, fl + 1, aR, knownU) - flux(ul, g.usol, fl, aL, knownU)
            + flux(vl, g.vsol, fb + nx, aT, knownV) - flux(vl, g.vsol, fb, aB, knownV);
          /* Quelle: Volumenänderungen (m³/s je Zelle) plus Driftausgleich. */
          const phiTot = g.phi[c] + g.phiS[c] + g.alpha[c];
          let src = (this.volSrc[c] * invV);
          const surface = this.gasAt(i - 1, j) || this.gasAt(i + 1, j) || this.gasAt(i, j - 1) || this.gasAt(i, j + 1);
          const err = phiTot - 1;
          if (err > 0 || !surface) src += (DRIFT_GAIN * err) / Math.max(dt, DRIFT_DT);
          let b = src * dx * dx - dx * div;
          /* Rechts (mit dem offenen Anteil der Fläche: was ein Körper bedeckt, koppelt nicht). */
          if (i + 1 < nx) {
            const k = kind[c + 1];
            if (k === LIQUID) { if (i + 1 <= i1 && aR > 0) sys.ax[s] = aR < 1 ? a * aR : a; }
            else if (k === GAS && aR > 0) { const q = (aR < 1 ? a * aR : a) / this.theta(c, c + 1); sys.dDx[s] += q; b += q * pGas[c + 1]; }
          } else if (g.openR && aR > 0) { sys.dDx[s] += aR < 1 ? 2 * a * aR : 2 * a; }
          /* Links (die Kopplung zu einer flüssigen Nachbarzelle steht bei ihr). */
          if (i > 0) {
            const k = kind[c - 1];
            if (k === GAS && aL > 0) { const q = (aL < 1 ? a * aL : a) / this.theta(c, c - 1); sys.dDx[s] += q; b += q * pGas[c - 1]; }
          } else if (g.openL && aL > 0) { sys.dDx[s] += aL < 1 ? 2 * a * aL : 2 * a; }
          /* Oben. */
          if (j + 1 < ny) {
            const k = kind[c + nx];
            if (k === LIQUID) { if (j + 1 <= j1 && aT > 0) sys.ay[s] = aT < 1 ? a * aT : a; }
            else if (k === GAS && aT > 0) { const q = (aT < 1 ? a * aT : a) / this.theta(c, c + nx); sys.dDy[s] += q; b += q * pGas[c + nx]; }
          } else if (g.openT && aT > 0) { sys.dDy[s] += aT < 1 ? 2 * a * aT : 2 * a; }
          /* Unten. */
          if (j > 0) {
            const k = kind[c - nx];
            if (k === GAS && aB > 0) { const q = (aB < 1 ? a * aB : a) / this.theta(c, c - nx); sys.dDy[s] += q; b += q * pGas[c - nx]; }
          } else if (g.openB && aB > 0) { sys.dDy[s] += aB < 1 ? 2 * a * aB : 2 * a; }
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
          ul[f] -= (a / dx) * this.across(i - 1 + j * nx, i + j * nx);
        }
      }
      for (let j = 0; j <= ny; j += 1) {
        for (let i = 0; i < nx; i += 1) {
          const f = i + j * nx;
          if (knownV[f] !== 1) continue;
          if (j === 0) { vl[f] -= (a / dx) * 2 * (pl[i] - 0); continue; }
          if (j === ny) { vl[f] -= (a / dx) * 2 * (0 - pl[i + (ny - 1) * nx]); continue; }
          vl[f] -= (a / dx) * this.across(i + (j - 1) * nx, i + j * nx);
        }
      }
      /* Wache Körper (M3a): ihre mitbewegte Masse mit derselben Matrix (bodies.ts). */
      if (this.afterSolve !== null) this.afterSolve(S, i0, j0, dt);
    }
    this.extrapolate();

    /* Gitter → Teilchen (APIC), dann der Transport; Tropfen fern der Flüssigkeit fliegen für sich (markStranded). */
    const flying = this.markStranded();
    const uMax = this.g2p(flying ? dt : 0, gy);
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
    L.escapedSalt = this.escS;
    L.escapedEnergy = this.escE;
    return L;
  }

  /**
   * Wo zwischen der Mitte der Flüssigkeitszelle c und ihrer Gasnachbarzelle n
   * die Oberfläche liegt — als Anteil θ des Abstands der Mitten, dort, wo φ
   * linear zwischen den Mitten ½ kreuzt (so misst auch die Prüfung den
   * Wasserspiegel). φ an Wänden ohne den Anteil der fehlenden Spiegelteilchen
   * (φ/(1 − φ_s)), Blasen zählen zur Flüssigkeit. Nie näher als THETA_MIN.
   */
  private theta(c: number, n: number): number {
    const g = this.g;
    const fc = g.phi[c] / (1 - Math.min(0.9, g.phiS[c])) + g.alpha[c];
    const fn = g.phi[n] / (1 - Math.min(0.9, g.phiS[n])) + g.alpha[n];
    if (!(fc > 0.5) || !(fc > fn)) return THETA_MIN;
    return Math.max(THETA_MIN, Math.min(1, (fc - 0.5) / (fc - fn)));
  }

  /** Der Druckunterschied über die Fläche von Zelle l nach r (r − l); zwischen Flüssigkeit und Gas über den Abstand θ zur Oberfläche. */
  private across(l: number, r: number): number {
    const { pl, kind } = this.g;
    const d = pl[r] - pl[l];
    if (kind[l] === GAS && kind[r] === LIQUID) return d / this.theta(r, l);
    if (kind[r] === GAS && kind[l] === LIQUID) return d / this.theta(l, r);
    return d;
  }

  /** Zähigkeit (M2a): der implizite Schritt je Komponente (liquidMix.ts). */
  private viscosity(dt: number): void {
    const g = this.g;
    if (this.vsolver === null) this.vsolver = new GridSolver(g.nx + 1, g.ny + 1);
    const empty = EMPTY * this.rhoRef * g.vCell * 0.25;
    this.last.viscIterations = solveViscosity(g, this.vsolver, this.etaU as Float64Array, this.etaV as Float64Array, this.mu, this.mv, this.knownU, this.knownV, this.rhoRef, empty, dt);
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

  /** Unbekannte Flächen aus bekannten Nachbarn füllen (extend.ts). */
  private extrapolate(): void {
    extendVelocities(this.g, this.knownU, this.knownV, this.markU, this.markV, this.tmpU, this.tmpV);
  }

  /** APIC zurück: Geschwindigkeit und affine Matrix jedes Teilchens; liefert die grösste Geschwindigkeit. */
  private g2p(dtFly: number, gy: number): number {
    const { P, g, w, stranded } = this;
    const { nx, ny, dx } = g;
    const inv = 1 / dx;
    const nxu = nx + 1;
    const ul = g.ul;
    const vl = g.vl;
    const k4 = 4 / (dx * dx);
    let vmax2 = 0;
    for (let p = 0; p < P.count; p += 1) {
      if (dtFly > 0 && stranded[p] !== 0) {
        /* Ein Tropfen in der Luft: seine eigene Geschwindigkeit, dazu die Schwerkraft; keine Drehung (C = 0). */
        P.vy[p] -= gy * dtFly;
        P.c00[p] = 0; P.c01[p] = 0; P.c10[p] = 0; P.c11[p] = 0;
        const s2 = P.vx[p] * P.vx[p] + P.vy[p] * P.vy[p];
        if (s2 > vmax2) vmax2 = s2;
        continue;
      }
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

  /** Je Teilchen: fliegt es für sich? (1: keine Flüssigkeitszelle in zwei Zellen Umkreis.) */
  private stranded = new Uint8Array(0);

  /** Tropfen fern der Flüssigkeit fliegen für sich (extend.ts); liefert, ob es solche gibt. */
  private markStranded(): boolean {
    if (this.stranded.length < this.P.cap) this.stranded = new Uint8Array(this.P.cap);
    return markStranded(this.P, this.g, this.stranded);
  }

  /** Geschwindigkeit des Gitters an einem Punkt (bilinear je Komponente; extend.ts). */
  velocityAt(x: number, y: number, out: Float64Array): void {
    gridVelocityAt(this.g, x, y, out);
  }

  private readonly vel = new Float64Array(2);

  /** Die Drift unaufgelöster Tröpfchen (liquidMix.ts). */
  private readonly drifts = new DropletDrift();
  private droplets(dt: number, gy: number, drift: Float64Array): boolean {
    return this.drifts.compute(this.P, this.g, dt, gy, drift);
  }

  private dropletDrift: Float64Array | null = null;

  /** RK2 im Gitterfeld, Stoss an Feststoffen und wachen Körpern, Entweichen durch offene Seiten (liquidMove.ts); mit mehreren Flüssigkeiten die Drift der Tröpfchen. */
  private advect(dt: number, gy: number): void {
    const P = this.P;
    let drift: Float64Array | null = null;
    if (this.viscous) {
      if (this.dropletDrift === null || this.dropletDrift.length < P.cap) this.dropletDrift = new Float64Array(P.cap);
      if (this.droplets(dt, gy, this.dropletDrift)) drift = this.dropletDrift;
    }
    const out = this.escaped;
    moveParticles(P, this.g, dt, this.stranded, drift, this.velocityAtFn, this.removeFn, this.bodyHit, this.vel, this.hit, out);
    this.escM = out.m;
    this.escO = out.o;
    this.escS = out.s;
    this.escE = out.e;
  }

  /** Wache Körper (M3a, von der Engine gesetzt): was sie zum Weg eines Teilchens sagen (liquidMove.ts). */
  bodyHit: BodyHit | null = null;
  /** Nach der Projektion, mit ihrer Matrix noch im Löser (M3a: die mitbewegte Masse der Körper). */
  afterSolve: ((S: GridSolver, i0: number, j0: number, dt: number) => void) | null = null;
  private readonly hit = new Float64Array(6);
  private readonly escaped: Escaped = { m: 0, o: 0, s: 0, e: 0 };
  private readonly velocityAtFn = (x: number, y: number, out: Float64Array): void => { gridVelocityAt(this.g, x, y, out); };
  private readonly removeFn = (p: number): void => { this.removeParticle(p); };
}
