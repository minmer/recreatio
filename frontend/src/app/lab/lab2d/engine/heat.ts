/**
 * LABOR 2D (v2) — DIE WÄRME (ARCHITECTURE.md §6.5): ein Temperaturfeld über
 * alle Zellen (fest, flüssig, Gas), Wärmeleitung implizit — Stahl, Wasser und
 * Luft nebeneinander ohne Stabilitätsgrenze:
 *
 *   C_i (T_i^{n+1} − T_i*)/Δt = Σ_j G_ij (T_j^{n+1} − T_i^{n+1}) + q_i,
 *   G_ij = k_ij D,  k_ij = 2 k_i k_j/(k_i + k_j)
 *
 * (die Fläche Δx·D über den Abstand Δx; D die Dicke der Schicht). Gelöst wird
 * nach δ = T^{n+1} − T* mit Jacobi-CG (symmetrisch positiv definit, stark
 * diagonal).
 *
 * Eine Zelle hat Teile: Feststoff (E_s), Gas (H_g, mit Nebel) und den Anteil
 * der Teilchen, der ihr mit den Wärmegewichten (liquid.wt) zufällt. C ist die
 * Summe ihrer Wärmekapazitäten, T* das mit C gewichtete Mittel. <b>Genaue
 * Buchhaltung</b>: die Energieänderung jeder Zelle kommt aus den Flüssen der
 * gelösten Temperaturen (jede Fläche einmal, antisymmetrisch) plus q Δt; jeder
 * Teil bekommt seinen Anteil C_Teil/C — die Teilchen über dieselben Gewichte
 * zurück (ΔT_p = Σ_i w_ip ΔE_i/C_i): die Flüssigkeit verschmiert nicht, ihre
 * eigenen Temperaturunterschiede bleiben.
 *
 * Heizung: feste Stahlzellen mit Rolle 1 und innerer Quelle — Leistung (W) oder
 * Thermostat (PI-Regelung der mittleren Temperatur der Platte, begrenzt auf die
 * eingestellte Leistung). Verluste h_ext (T − T_amb) an jeder Wandseite, in
 * Reihe mit der halben Zelle; an offenen Seiten Leitung zur Umgebung (der
 * Rest geht mit dem Gas hinaus). Keine Strahlung (SIMPLIFICATIONS.md #7).
 */

import type { Gas } from './gas';
import type { Grid } from './grid';
import type { Liquid } from './liquid';
import { cpL, cpLiq, hL, H_EXT, kL, kLiq, kMix, SOLIDS, WATER } from './materials';
import type { Particles } from './particles';
import type { HeaterMode } from './scene';
import type { GridSolver, SolveResult } from './solver';
import { GAS, H2O, LIQUID, SOLID, T0 } from './units';

export interface Heater {
  readonly group: number;
  mode: HeaterMode;
  /** Höchstleistung (W, für die Schicht der Dicke D). */
  power: number;
  /** Solltemperatur des Thermostats (K). */
  target: number;
  on: boolean;
  /** Leistung im letzten Schritt (W), mittlere Temperatur der Platte (K), Integral des Reglers (K·s). */
  P: number;
  Tmean: number;
  integral: number;
  cells: number;
}

export interface HeatStats {
  solve: SolveResult;
  /** Energie dieses Schritts (J): Heizung, Verluste durch Wände, Leitung durch offene Seiten. */
  heater: number;
  lossWalls: number;
  lossOpen: number;
}

/** Regler des Thermostats: volle Leistung 5 K unter dem Ziel, Nachstellzeit 30 s (Modellparameter). */
const KP_FULL_K = 5;
const TI_S = 30;

export class Heat {
  private readonly g: Grid;
  private readonly P: Particles;
  private readonly L: Liquid;
  private readonly G: Gas;
  private readonly solver: GridSolver;
  /** Wärmequellen anderer Stufen in diesem Schritt (W je Zelle): latente Wärme, gezielt abgegebene Wärme. */
  readonly src: Float64Array;
  /** Je Zelle in diesem Schritt: Wärmekapazitäten der Teile, T*, Leitfähigkeit. */
  readonly C: Float64Array;
  readonly Cs: Float64Array;
  readonly Cg: Float64Array;
  readonly CTl: Float64Array;
  readonly Tstar: Float64Array;
  readonly k: Float64Array;
  readonly dE: Float64Array;
  private readonly Tnew: Float64Array;
  /** Leitwerte der Flächen je Schritt (W/K): zur rechten (gx) und zur oberen Nachbarzelle (gy) — einmal berechnet, im Aufbau und bei den Flüssen gelesen. */
  private readonly gx: Float64Array;
  private readonly gy: Float64Array;
  private readonly q: Float64Array;
  /** Je Zelle: Wärmekapazität und Σ C·k der Teilchen anderer Flüssigkeiten als Wasser (ihre Leitfähigkeit mischt sich ein). */
  private readonly Co: Float64Array;
  private readonly CKo: Float64Array;
  heaters: Heater[] = [];
  ambientT = 293.15;
  /** Geleitete Energie seit dem Start (J) zwischen Zellarten: Feststoff → Flüssigkeit, Flüssigkeit → Gas, Feststoff → Gas (für Test 11 und die Energiebilanz der Anzeige). */
  fluxSL = 0;
  fluxLG = 0;
  fluxSG = 0;
  /** Davon über Wandseiten aus festen Zellen verloren (J, seit dem Start). */
  lossSolids = 0;
  /** Leistung, die gleichmässig in die Flüssigkeit geht (W; nach Wärmekapazität verteilt — wie ein Mikrowellenherd; Prüfstand und Werkzeug). */
  liquidPower = 0;
  hExt = H_EXT;
  readonly last: HeatStats = { solve: { iterations: 0, residual: 0, capped: false }, heater: 0, lossWalls: 0, lossOpen: 0 };

  constructor(grid: Grid, particles: Particles, liquid: Liquid, gas: Gas, solver: GridSolver) {
    this.g = grid;
    this.P = particles;
    this.L = liquid;
    this.G = gas;
    this.solver = solver;
    const n = grid.n;
    this.src = new Float64Array(n);
    this.C = new Float64Array(n);
    this.Cs = new Float64Array(n);
    this.Cg = new Float64Array(n);
    this.CTl = new Float64Array(n);
    this.Tstar = new Float64Array(n);
    this.k = new Float64Array(n);
    this.dE = new Float64Array(n);
    this.Tnew = new Float64Array(n);
    this.gx = new Float64Array(n);
    this.gy = new Float64Array(n);
    this.q = new Float64Array(n);
    this.Co = new Float64Array(n);
    this.CKo = new Float64Array(n);
  }

  /* -- Feststoffe ------------------------------------------------------------------------------------ */

  /** Wärmekapazität des Feststoffs einer Zelle ohne Film (J/K). */
  solidCap(c: number): number {
    const s = SOLIDS[this.g.solid[c] - 1];
    return s.rho * s.cp * this.g.vCell;
  }

  /** Energie eines Feststoffs bei T (J): m c_s (T − 0 °C) plus der Wasserfilm mit h_l(T). */
  solidEnergy(c: number, T: number): number {
    return this.solidCap(c) * (T - T0) + this.g.film[c] * hL(T);
  }

  /** T eines Feststoffs aus seiner Energie. */
  deriveSolid(c: number): void {
    const g = this.g;
    const cs = this.solidCap(c);
    const film = g.film[c];
    if (film <= 0) { g.T[c] = T0 + g.Es[c] / cs; return; }
    let T = g.T[c] > 100 ? g.T[c] : T0 + g.Es[c] / cs;
    for (let it = 0; it < 3; it += 1) T -= (this.solidEnergy(c, T) - g.Es[c]) / (cs + film * cpL(T));
    g.T[c] = T;
  }

  /* -- Heizung --------------------------------------------------------------------------------------- */

  /** Zellen und mittlere Temperatur jeder Heizgruppe (vor jeder Leistung und nach jedem Handgriff). */
  countHeaters(): void {
    const g = this.g;
    for (const h of this.heaters) { h.Tmean = 0; h.cells = 0; }
    for (let c = 0; c < g.n; c += 1) {
      const grp = g.heater[c];
      if (grp < 0 || g.role[c] !== 1) continue;
      const h = this.heaters[grp];
      if (h === undefined) continue;
      h.Tmean += g.T[c];
      h.cells += 1;
    }
    for (const h of this.heaters) if (h.cells > 0) h.Tmean /= h.cells;
  }

  /** Leistung jeder Heizgruppe für diesen Schritt (Thermostat: PI auf die mittlere Plattentemperatur). */
  private heaterPower(dt: number): void {
    this.countHeaters();
    for (const h of this.heaters) {
      if (h.cells === 0) { h.P = 0; continue; }
      if (!h.on) { h.P = 0; h.integral = 0; continue; }
      if (h.mode === 'power') { h.P = h.power; continue; }
      const kp = h.power / KP_FULL_K;
      const e = h.target - h.Tmean;
      const next = h.integral + e * dt;
      const raw = kp * (e + next / TI_S);
      /* Anti-Windup: das Integral wächst nur, solange der Regler nicht anschlägt. */
      if (raw > 0 && raw < h.power) h.integral = next;
      h.P = Math.min(h.power, Math.max(0, kp * (e + h.integral / TI_S)));
    }
  }

  /* -- Ein Schritt ----------------------------------------------------------------------------------- */

  step(dt: number, tol: number, maxIter: number): HeatStats {
    const { g, P, L, G } = this;
    const { nx, ny, n, depth, dx } = g;
    const { C, Cs, Cg, CTl, Tstar, k, q, src } = this;
    this.heaterPower(dt);
    /* Teile jeder Zelle: Feststoff, Gas, Teilchen. */
    CTl.fill(0);
    const Cl = g.Cl;
    Cl.fill(0);
    const { Co, CKo } = this;
    let other = false;
    let ClSum = 0;
    for (let p = 0; p < P.count; p += 1) {
      const mat = P.mat[p];
      const Tp = P.T[p];
      const Cp = P.mass[p] * cpLiq(mat, Tp);
      ClSum += Cp;
      const o = 9 * p;
      const i0 = L.bi[p];
      const j0 = L.bj[p];
      /* Andere Flüssigkeiten: ihr Anteil an der Leitfähigkeit der Zelle (nach Wärmekapazität gewichtet). */
      const kp = mat === WATER ? 0 : kLiq(mat, Tp);
      if (mat !== WATER && !other) { other = true; Co.fill(0); CKo.fill(0); }
      for (let kk = 0; kk < 9; kk += 1) {
        const w = L.wt[o + kk];
        if (w === 0) continue;
        const i = i0 + (kk % 3);
        const j = j0 + ((kk / 3) | 0);
        if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
        const c = i + j * nx;
        Cl[c] += w * Cp;
        CTl[c] += w * Cp * Tp;
        if (mat !== WATER) { Co[c] += w * Cp; CKo[c] += w * Cp * kp; }
      }
    }
    let heaterW = 0;
    for (let c = 0; c < n; c += 1) {
      let cs = 0;
      let kc = 0;
      if (g.solid[c] !== 0) {
        cs = this.solidCap(c) + g.film[c] * cpL(g.T[c]);
        kc = SOLIDS[g.solid[c] - 1].k;
      }
      const cg = G.cap[c] > 0 && g.solid[c] === 0 ? G.cap[c] : 0;
      const cl = Cl[c];
      const sum = cs + cg + cl;
      Cs[c] = cs;
      Cg[c] = cg;
      C[c] = sum;
      if (sum <= 0) { Tstar[c] = g.T[c]; k[c] = 0; q[c] = 0; continue; }
      const T = (cs * g.T[c] + cg * g.T[c] + CTl[c]) / sum;
      Tstar[c] = T;
      if (cl > 0) g.Tl[c] = CTl[c] / cl;
      if (g.solid[c] === 0) {
        if (cl >= cg) kc = other && Co[c] > 0 ? ((cl - Co[c]) * kL(T) + CKo[c]) / cl : kL(T);
        else kc = kMix(g.mg[c], g.mg[n + c], g.mg[H2O * n + c], T);
      }
      k[c] = kc;
      let qc = src[c];
      if (this.liquidPower !== 0 && cl > 0) { const w = (this.liquidPower * cl) / ClSum; qc += w; heaterW += w; }
      const grp = g.heater[c];
      if (grp >= 0 && g.role[c] === 1) {
        const h = this.heaters[grp];
        if (h !== undefined && h.cells > 0) { qc += h.P / h.cells; heaterW += h.P / h.cells; }
      }
      q[c] = qc;
    }
    /* Leitwerte der Flächen: harmonisches Mittel der Wärmeleitfähigkeiten, mal Tiefe (Fläche Δx·D über den Abstand Δx). */
    const { gx, gy } = this;
    for (let j = 0; j < ny; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        const c = i + j * nx;
        gx[c] = 0;
        gy[c] = 0;
        if (C[c] <= 0) continue;
        const kc = k[c];
        if (i + 1 < nx && C[c + 1] > 0) { const kn = k[c + 1]; if (kc + kn > 0) gx[c] = ((2 * kc * kn) / (kc + kn)) * depth; }
        if (j + 1 < ny && C[c + nx] > 0) { const kn = k[c + nx]; if (kc + kn > 0) gy[c] = ((2 * kc * kn) / (kc + kn)) * depth; }
      }
    }
    /* Das System in δ = T^{n+1} − T*. */
    const S = this.solver;
    const sys = S.begin(nx, ny);
    const stride = sys.stride;
    const A = dx * depth;
    const hA = this.hExt * A;
    const Ta = this.ambientT;
    for (let j = 0; j < ny; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        const c = i + j * nx;
        if (C[c] <= 0) continue;
        const s = i + 1 + (j + 1) * stride;
        sys.act[s] = 1;
        sys.dH[s] = C[c] / dt;
        let b = q[c];
        const kc = k[c];
        /* Nachbarn: rechts und oben setzen die Fläche; die Flüsse der alten Temperaturen in die rechte Seite. */
        const Tc = Tstar[c];
        if (i + 1 < nx) { sys.ax[s] = gx[c]; b += gx[c] * (Tstar[c + 1] - Tc); }
        if (i > 0) b += gx[c - 1] * (Tstar[c - 1] - Tc);
        if (j + 1 < ny) { sys.ay[s] = gy[c]; b += gy[c] * (Tstar[c + nx] - Tc); }
        if (j > 0) b += gy[c - nx] * (Tstar[c - nx] - Tc);
        /* Seiten der Kiste: Wand (h_ext in Reihe mit der halben Zelle) oder offen (Leitung zur Umgebung). */
        let Gb = 0;
        if (i === 0) Gb += this.sideConductance(g.openL, kc, hA, depth);
        if (i === nx - 1) Gb += this.sideConductance(g.openR, kc, hA, depth);
        if (j === 0) Gb += this.sideConductance(g.openB, kc, hA, depth);
        if (j === ny - 1) Gb += this.sideConductance(g.openT, kc, hA, depth);
        if (Gb > 0) { sys.dDx[s] = Gb; b += Gb * (Ta - Tstar[c]); }
        sys.b[s] = b;
      }
    }
    const res = S.solve(tol, maxIter, false);
    const st = this.last.solve;
    st.iterations = res.iterations; st.residual = res.residual; st.capped = res.capped;
    const Tn = this.Tnew;
    const X = sys.x;
    for (let j = 0; j < ny; j += 1) for (let i = 0; i < nx; i += 1) {
      const c = i + j * nx;
      Tn[c] = C[c] > 0 ? Tstar[c] + X[i + 1 + (j + 1) * stride] : g.T[c];
    }
    /* Energie je Zelle aus den Flüssen der gelösten Temperaturen: jede Fläche einmal. */
    const dE = this.dE;
    let lossWalls = 0;
    let lossOpen = 0;
    for (let c = 0; c < n; c += 1) dE[c] = C[c] > 0 ? q[c] * dt : 0;
    for (let j = 0; j < ny; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        const c = i + j * nx;
        if (C[c] <= 0) continue;
        const kc = k[c];
        if (gx[c] > 0) {
          const F = gx[c] * (Tn[c + 1] - Tn[c]) * dt;
          dE[c] += F;
          dE[c + 1] -= F;
          if (g.kind[c] !== g.kind[c + 1]) this.pair(g.kind[c], g.kind[c + 1], F);
        }
        if (gy[c] > 0) {
          const F = gy[c] * (Tn[c + nx] - Tn[c]) * dt;
          dE[c] += F;
          dE[c + nx] -= F;
          if (g.kind[c] !== g.kind[c + nx]) this.pair(g.kind[c], g.kind[c + nx], F);
        }
        /* Seiten der Kiste. */
        for (let side = 0; side < 4; side += 1) {
          const at = side === 0 ? i === 0 : side === 1 ? i === nx - 1 : side === 2 ? j === 0 : j === ny - 1;
          if (!at) continue;
          const open = side === 0 ? g.openL : side === 1 ? g.openR : side === 2 ? g.openB : g.openT;
          const F = this.sideConductance(open, kc, hA, depth) * (Tn[c] - Ta) * dt;
          dE[c] -= F;
          if (open) lossOpen += F; else lossWalls += F;
          if (g.solid[c] !== 0) this.lossSolids += F;
        }
      }
    }
    /* Verteilen: jeder Teil nach seiner Wärmekapazität. */
    for (let c = 0; c < n; c += 1) {
      if (C[c] <= 0) continue;
      const share = dE[c] / C[c];
      if (Cs[c] > 0) { g.Es[c] += share * Cs[c]; this.deriveSolid(c); }
      if (Cg[c] > 0) g.Hg[c] += share * Cg[c];
      /* Für die Teilchen: ΔE/C je Zelle (in Tn zwischengelagert). */
      Tn[c] = share;
    }
    for (let p = 0; p < P.count; p += 1) {
      const o = 9 * p;
      const i0 = L.bi[p];
      const j0 = L.bj[p];
      let dT = 0;
      for (let kk = 0; kk < 9; kk += 1) {
        const w = L.wt[o + kk];
        if (w === 0) continue;
        const i = i0 + (kk % 3);
        const j = j0 + ((kk / 3) | 0);
        if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
        const c = i + j * nx;
        if (C[c] > 0) dT += w * Tn[c];
      }
      if (dT === 0) continue;
      const m = P.mass[p];
      const before = m / P.rho[p];
      P.h[p] += cpLiq(P.mat[p], P.T[p]) * dT;
      P.derive(p);
      L.dVp[p] += m / P.rho[p] - before;
    }
    for (let c = 0; c < n; c += 1) if (Cg[c] > 0) G.deriveCell(c);
    src.fill(0);
    const out = this.last;
    out.heater = heaterW * dt;
    out.lossWalls = lossWalls;
    out.lossOpen = lossOpen;
    return out;
  }

  /** Energie F (J) floss von einer Zelle der Art b in eine der Art a: nach Paaren buchen. */
  private pair(a: number, b: number, F: number): void {
    if (a === SOLID && b === LIQUID) this.fluxSL -= F;
    else if (a === LIQUID && b === SOLID) this.fluxSL += F;
    else if (a === LIQUID && b === GAS) this.fluxLG -= F;
    else if (a === GAS && b === LIQUID) this.fluxLG += F;
    else if (a === SOLID && b === GAS) this.fluxSG -= F;
    else if (a === GAS && b === SOLID) this.fluxSG += F;
  }

  /** Leitwert einer Kistenseite (W/K): Wand = h_ext A in Reihe mit k A/(Δx/2); offen = k A/(Δx/2) zur Umgebung. */
  private sideConductance(open: boolean, kc: number, hA: number, depth: number): number {
    const half = 2 * kc * depth;
    if (open) return half;
    if (hA <= 0 || half <= 0) return 0;
    return 1 / (1 / hA + 1 / half);
  }
}

