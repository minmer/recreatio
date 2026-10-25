/**
 * LABOR 2D (v2) — DAS GAS (ARCHITECTURE.md §6): eulersch auf dem Gitter.
 *
 * - Zustand je Zelle: Massen je Art m_k (N₂, O₂, H₂O), Nebel m_f und die
 *   Enthalpie H; T folgt aus H (Newton auf Σ m_k h_k(T) + m_f h_l(T)), die
 *   Dichte aus den Massen und dem Gasvolumen V_gas = V_Zelle (1 − φ − α_b).
 * - Transport in Flussform zwischen Gaszellen und durch offene Seiten,
 *   MUSCL mit van-Leer-Begrenzer, in Teilschritten mit Courant-Zahl ≤ 0,9 (der
 *   Prompt verlangt ≤ 1; der Ausfluss einer Zelle bleibt zusätzlich unter
 *   ihrem Inhalt begrenzt); die Enthalpie fliesst mit denselben Flüssen. Flächen
 *   zur Flüssigkeit oder zu Feststoffen tragen keine Gasmasse.
 * - Geschwindigkeit: MacCormack (vorwärts und rückwärts semi-Lagrange mit
 *   Begrenzer, wie Energy2D), stabil beim Hauptschritt; Zähigkeit explizit;
 *   Auftrieb je Masse g (ρ − ρ̄)/ρ mit ρ = p M/(R T) — nicht Boussinesq.
 * - Projektion auf p′ = p − p_amb(y): ∇·((Δt/ρ_f)∇p′) = ∇·u* − S_g, p′ = 0 an
 *   offenen Seiten, Flächen zur Flüssigkeit mit deren Geschwindigkeit (eine
 *   bewegte Wand), zu Feststoffen 0.
 * - S_g aus der Zustandsgleichung: (V_eos − V_gas)/(V Δt) — das Volumen, das
 *   die Massen bei p(y) und T einnehmen wollen, gegen das, das sie haben —
 *   plus die Volumenänderung, die Wärme, Verdampfen, Platzen und Nebel im
 *   letzten Schritt bewirkt haben (die Vorhersage für diesen Schritt). Das
 *   sind die vier Teile des Prompts (Heizung, zugefügtes Volumen,
 *   Zusammensetzung, Volumenkorrektur), ohne sie einzeln zu nähern.
 */

import type { Grid } from './grid';
import { gasHeatCapacity, gasTemperature, hGas, hL, MOLAR, muMix } from './materials';
import type { Regions } from './regions';
import { GasTransport, Q, QF, QH } from './gasTransport';
import type { GridSolver, SolveResult } from './solver';
import { GAS, GAS_SPECIES, H2O, LIQUID, R_GAS, SOLID } from './units';

/** Untergrenze der Dichte in Druck- und Auftriebskoeffizienten (kg/m³): heisser Dampf bei 1 atm hat 0,4; das hier ist nur eine Sicherung für fast leere Zellen. */
const RHO_MIN = 0.05;

export interface GasStats {
  solve: SolveResult;
  substeps: number;
  cells: number;
  /** Grösste Gasgeschwindigkeit (m/s). */
  uMax: number;
}

/** So viele Zellen weit sucht release() nach einer Gaszelle. */
const RELEASE_REACH = 400;

export class Gas {
  private readonly g: Grid;
  private readonly R: Regions;
  private readonly solver: GridSolver;
  /* Abgeleitet je Zelle. */
  readonly vgas: Float64Array;
  readonly rho: Float64Array;
  readonly nmol: Float64Array;
  /** Wärmekapazität des Gases einer Zelle Σ m c_p (J/K). */
  readonly cap: Float64Array;
  readonly mu: Float64Array;
  readonly veos: Float64Array;
  /** Volumenänderung durch Quellen im letzten Schritt (m³) und V_eos nach dem Transport (für die nächste). */
  readonly srcV: Float64Array;
  readonly veosMid: Float64Array;
  /* Transport (gasTransport.ts). */
  private readonly mover: GasTransport;
  /* Geschwindigkeit. */
  readonly gasU: Uint8Array;
  readonly gasV: Uint8Array;
  private readonly u0: Float32Array;
  private readonly v0: Float32Array;
  private readonly u1: Float32Array;
  private readonly v1: Float32Array;
  /** Grenzen der Stützwerte je Fläche (u-Flächen, dann v-Flächen; je Min und Max). */
  private readonly lim: Float32Array;
  /** Umgebungsluft je Volumen: Massen der Arten, Nebel 0, Enthalpie (für Zufluss an offenen Seiten). */
  readonly amb = new Float64Array(Q);
  ambT = 293.15;
  /** Entwichen durch offene Seiten seit dem Start: Massen je Grösse (kg) und Enthalpie (J); negativ: hereingekommen. */
  readonly escaped = new Float64Array(Q);
  /** Δp0 je Gebiet im letzten Schritt (Pa) — die Engine gibt Teilchen und Blasen ihren Anteil V Δp0. */
  dp0: Float64Array = new Float64Array(8);
  /* Suche nach der nächsten Gaszelle (release): Warteschlange und Marken (Arbeitsspeicher). */
  private readonly queue: Int32Array;
  private readonly seen: Int32Array;
  private seenTag = 0;
  readonly last: GasStats = { solve: { iterations: 0, residual: 0, capped: false }, substeps: 0, cells: 0, uMax: 0 };

  constructor(grid: Grid, regions: Regions, solver: GridSolver) {
    this.g = grid;
    this.R = regions;
    this.solver = solver;
    const n = grid.n;
    this.vgas = new Float64Array(n);
    this.rho = new Float64Array(n);
    this.nmol = new Float64Array(n);
    this.cap = new Float64Array(n);
    this.mu = new Float64Array(n);
    this.veos = new Float64Array(n);
    this.srcV = new Float64Array(n);
    this.veosMid = new Float64Array(n);
    this.gasU = new Uint8Array(grid.nu);
    this.gasV = new Uint8Array(grid.nv);
    this.u0 = new Float32Array(grid.nu);
    this.v0 = new Float32Array(grid.nv);
    this.u1 = new Float32Array(grid.nu);
    this.v1 = new Float32Array(grid.nv);
    this.lim = new Float32Array(2 * (grid.nu + grid.nv));
    this.queue = new Int32Array(n);
    this.seen = new Int32Array(n);
    this.mover = new GasTransport(grid, this);
  }

  /** Die Umgebungsluft festlegen: T (K), p (Pa), Massenanteile Y (je Gasart). */
  setAmbient(T: number, p: number, Y: Float64Array): void {
    let inv = 0;
    for (let k = 0; k < GAS_SPECIES; k += 1) inv += Y[k] / MOLAR[k];
    const rho = p / (R_GAS * T * inv);
    let H = 0;
    for (let k = 0; k < GAS_SPECIES; k += 1) {
      this.amb[k] = rho * Y[k];
      H += rho * Y[k] * hGas(k, T);
    }
    this.amb[QF] = 0;
    this.amb[QH] = H;
    this.ambT = T;
  }

  /* -- Zustand einer Zelle -------------------------------------------------------------------------- */

  /** Enthalpie des Gases einer Zelle bei T (J) und ihre Ableitung (J/K). */
  private enthalpy(c: number, T: number): number {
    const g = this.g;
    const n = g.n;
    let H = g.mfog[c] * hL(T);
    for (let k = 0; k < GAS_SPECIES; k += 1) H += g.mg[k * n + c] * hGas(k, T);
    return H;
  }

  heatCapacity(c: number, T: number): number {
    const g = this.g;
    const n = g.n;
    return gasHeatCapacity(g.mg[c], g.mg[n + c], g.mg[H2O * n + c], g.mfog[c], T);
  }

  /** T aus H (Newton ab dem letzten T), dazu Dichte, Mole, Wärmekapazität, Zähigkeit, V_gas. */
  deriveCell(c: number): void {
    const g = this.g;
    const n = g.n;
    const vg = Math.max(1e-3, 1 - g.fs[c] - g.phi[c] - g.alpha[c]) * g.vCell;
    this.vgas[c] = vg;
    const mN = g.mg[c];
    const mO = g.mg[n + c];
    const mV = g.mg[H2O * n + c];
    const mF = g.mfog[c];
    const m = mN + mO + mV;
    this.nmol[c] = mN / MOLAR[0] + mO / MOLAR[1] + mV / MOLAR[H2O];
    if (m + mF <= 1e-30) {
      this.rho[c] = 0;
      this.cap[c] = 0;
      this.mu[c] = 1.8e-5;
      return;
    }
    let T: number;
    if (mF <= 0) {
      /* Ohne Nebel geschlossen (quadratisch in T). */
      T = gasTemperature(mN, mO, mV, g.Hg[c]);
    } else {
      T = g.T[c] > 100 ? g.T[c] : this.ambT;
      for (let it = 0; it < 4; it += 1) {
        const dT = (g.Hg[c] - this.enthalpy(c, T)) / this.heatCapacity(c, T);
        T += dT;
        if (Math.abs(dT) < 1e-10) break;
      }
    }
    if (!(T > 150 && T < 3000)) T = Math.min(3000, Math.max(150, Number.isFinite(T) ? T : this.ambT));
    g.T[c] = T;
    this.cap[c] = gasHeatCapacity(mN, mO, mV, mF, T);
    this.rho[c] = m / vg;
    this.mu[c] = muMix(mN, mO, mV, T);
  }

  /** Alle Gaszellen (und gefangenes Gas in Flüssigkeitszellen) neu ableiten, V_eos dazu. */
  deriveAll(): void {
    const g = this.g;
    for (let c = 0; c < g.n; c += 1) {
      if (g.kind[c] === SOLID) { this.vgas[c] = 0; this.rho[c] = 0; this.veos[c] = 0; continue; }
      if (g.kind[c] === LIQUID && this.massOf(c) <= 0) { this.vgas[c] = 0; this.veos[c] = 0; continue; }
      this.deriveCell(c);
      this.veos[c] = (this.nmol[c] * R_GAS * g.T[c]) / this.R.pAt(c);
    }
  }

  /** Nur Volumina, Dichten und V_eos neu (T unverändert): nach einer Änderung von φ. */
  updateVolumes(): void {
    const g = this.g;
    const n = g.n;
    for (let c = 0; c < n; c += 1) {
      if (g.kind[c] === SOLID) { this.vgas[c] = 0; this.rho[c] = 0; this.veos[c] = 0; continue; }
      const m = g.mg[c] + g.mg[n + c] + g.mg[H2O * n + c];
      if (g.kind[c] === LIQUID && m + g.mfog[c] <= 0) { this.vgas[c] = 0; this.veos[c] = 0; continue; }
      const vg = Math.max(1e-3, 1 - g.fs[c] - g.phi[c] - g.alpha[c]) * g.vCell;
      this.vgas[c] = vg;
      this.rho[c] = m / vg;
      this.veos[c] = (this.nmol[c] * R_GAS * g.T[c]) / this.R.pAt(c);
    }
  }

  /** V_eos aller Zellen mit Gas neu (die Zellen sind schon abgeleitet). */
  updateEos(): void {
    const g = this.g;
    for (let c = 0; c < g.n; c += 1) this.veos[c] = g.kind[c] === SOLID || this.vgas[c] <= 0 ? 0 : (this.nmol[c] * R_GAS * g.T[c]) / this.R.pAt(c);
  }

  massOf(c: number): number {
    const g = this.g;
    let m = g.mfog[c];
    for (let k = 0; k < GAS_SPECIES; k += 1) m += g.mg[k * g.n + c];
    return m;
  }

  /** Die Zelle mit Gas im Gleichgewicht füllen: Zusammensetzung Y, Temperatur T, beim Druck ihrer Umgebung (für Szenenaufbau und Werkzeuge). */
  fillCell(c: number, T: number, Y: Float64Array, fraction = 1): void {
    const g = this.g;
    const n = g.n;
    const vg = Math.max(1e-3, fraction) * g.vCell;
    let inv = 0;
    for (let k = 0; k < GAS_SPECIES; k += 1) inv += Y[k] / MOLAR[k];
    const m = (this.R.pAt(c) * vg) / (R_GAS * T * inv);
    let H = 0;
    for (let k = 0; k < GAS_SPECIES; k += 1) {
      g.mg[k * n + c] = m * Y[k];
      H += m * Y[k] * hGas(k, T);
    }
    g.mfog[c] = 0;
    g.Hg[c] = H;
    g.T[c] = T;
  }

  /* -- Wechsel der Zellart ------------------------------------------------------------------------ */

  /**
   * Zellen, die ihre Art gewechselt haben: wird eine Gaszelle flüssig, geht ihr
   * Gas zu den Gasnachbarn (nach deren Gasvolumen); ohne Gasnachbarn zur
   * nächsten Gaszelle über offene Flächen (release). Wird eine Zelle zu Gas,
   * holt sie sich von den Gasnachbarn so viel, wie bei ihrem Druck in ihr
   * Volumen passt. Alles genau erhalten.
   */
  transitions(prev: Uint8Array): number {
    const g = this.g;
    const { nx, n, kind } = g;
    let changed = 0;
    for (let c = 0; c < n; c += 1) {
      const was = prev[c];
      const now = kind[c];
      if (was === now || now === SOLID || was === SOLID) continue;
      changed += 1;
      const i = c % nx;
      const j = (c - i) / nx;
      /* Gasnachbarn und ihr Gasvolumen. */
      let wsum = 0;
      for (let k = 0; k < 4; k += 1) {
        const nb = this.across(c, i, j, k);
        if (nb >= 0 && kind[nb] === GAS && prev[nb] === GAS) wsum += this.vgas[nb] > 0 ? this.vgas[nb] : g.vCell;
      }
      if (wsum <= 0) {
        if (now === LIQUID) this.release(c);
        continue;
      }
      if (now === LIQUID) {
        /* Alles hinaus. */
        for (let k = 0; k < 4; k += 1) {
          const nb = this.across(c, i, j, k);
          if (nb < 0 || kind[nb] !== GAS || prev[nb] !== GAS) continue;
          const share = (this.vgas[nb] > 0 ? this.vgas[nb] : g.vCell) / wsum;
          this.move(c, nb, share);
        }
      } else {
        /* Auffüllen bis zur Masse, die bei p(y) und der Temperatur der Nachbarn passt. */
        let have = this.massOf(c);
        let want = 0;
        for (let k = 0; k < 4; k += 1) {
          const nb = this.across(c, i, j, k);
          if (nb < 0 || kind[nb] !== GAS || prev[nb] !== GAS) continue;
          const w = (this.vgas[nb] > 0 ? this.vgas[nb] : g.vCell) / wsum;
          want += w * this.rho[nb];
        }
        want *= Math.max(1e-3, 1 - g.fs[c] - g.phi[c] - g.alpha[c]) * g.vCell;
        if (want <= have) continue;
        for (let k = 0; k < 4; k += 1) {
          const nb = this.across(c, i, j, k);
          if (nb < 0 || kind[nb] !== GAS || prev[nb] !== GAS) continue;
          const w = (this.vgas[nb] > 0 ? this.vgas[nb] : g.vCell) / wsum;
          const mnb = this.massOf(nb);
          if (mnb <= 0) continue;
          /* Höchstens ein Viertel des Nachbarn. */
          const take = Math.min(0.25, ((want - have) * w) / mnb);
          this.move(nb, c, take);
        }
        have = this.massOf(c);
        if (have > 0) g.T[c] = this.ambT;
      }
      this.deriveCell(c);
    }
    /* Gas, das noch in einer flüssigen Zelle sitzt (sie wurde flüssig, ohne dass es fort konnte), zur nächsten Gaszelle. */
    for (let c = 0; c < n; c += 1) if (kind[c] === LIQUID && this.massOf(c) > 0) this.release(c);
    return changed;
  }

  /**
   * Das ganze Gas einer flüssigen Zelle zur nächsten Gaszelle (Breitensuche über
   * offene Flächen, durch Flüssigkeit, höchstens RELEASE_REACH Zellen). Bis
   * 2026-10-24 blieb es gefangen: in einer Zelle, die ein Körper fast ganz
   * bedeckt, war es ein Hauch Gas mit winziger Wärmekapazität; die Wärmeleitung
   * trieb seine Temperatur ins Unsinnige (unter 150 K, über 3000 K), und neben
   * einem schmelzenden Eiswürfel auf der Heizplatte explodierte schliesslich das
   * Gas. Ohne erreichbare Gaszelle (ganz von Flüssigkeit umschlossen) bleibt es.
   */
  private release(c: number): void {
    const g = this.g;
    const { nx, kind } = g;
    const tag = ++this.seenTag;
    const queue = this.queue;
    const seen = this.seen;
    let head = 0;
    let tail = 0;
    queue[tail++] = c;
    seen[c] = tag;
    while (head < tail && tail < RELEASE_REACH) {
      const q = queue[head++];
      const qi = q % nx;
      const qj = (q - qi) / nx;
      for (let k = 0; k < 4; k += 1) {
        const nb = this.across(q, qi, qj, k);
        if (nb < 0 || seen[nb] === tag || kind[nb] === SOLID) continue;
        seen[nb] = tag;
        if (kind[nb] === GAS) {
          this.move(c, nb, 1);
          this.deriveCell(nb);
          this.deriveCell(c);
          return;
        }
        queue[tail++] = nb;
      }
    }
  }

  /** Die Nachbarzelle über Seite k (0 links, 1 rechts, 2 unten, 3 oben) — nur, wenn kein Körper diese Fläche ganz bedeckt (sonst −1: eine dünne Wand trennt zwei Gebiete). */
  across(c: number, i: number, j: number, k: number): number {
    const g = this.g;
    const { nx, ny } = g;
    if (k === 0) return i > 0 && g.au[i + j * (nx + 1)] > 0 ? c - 1 : -1;
    if (k === 1) return i < nx - 1 && g.au[i + 1 + j * (nx + 1)] > 0 ? c + 1 : -1;
    if (k === 2) return j > 0 && g.av[c] > 0 ? c - nx : -1;
    return j < ny - 1 && g.av[c + nx] > 0 ? c + nx : -1;
  }

  /** Den Anteil `share` des Gases (Arten, Nebel, Enthalpie) von a nach b verschieben. */
  move(a: number, b: number, share: number): void {
    const g = this.g;
    const n = g.n;
    for (let k = 0; k < GAS_SPECIES; k += 1) {
      const d = g.mg[k * n + a] * share;
      g.mg[k * n + a] -= d;
      g.mg[k * n + b] += d;
    }
    const f = g.mfog[a] * share;
    g.mfog[a] -= f;
    g.mfog[b] += f;
    const H = g.Hg[a] * share;
    g.Hg[a] -= H;
    g.Hg[b] += H;
    if (g.T[b] < 100) g.T[b] = g.T[a];
    /* Beide Zellen neu ableiten: T und Mole folgen den Massen und der Enthalpie (sonst rechnet p0 mit veralteten Werten). */
    this.deriveCell(a);
    this.deriveCell(b);
  }

  /* -- Transport ------------------------------------------------------------------------------------ */

  /** Welche Flächen Gasflächen sind (zwischen zwei Gaszellen, oder offene Seite an einer Gaszelle — nicht ganz von einem Körper bedeckt); die übrigen bekommen ihren Randwert. */
  markFaces(): void {
    const g = this.g;
    const { nx, ny, kind } = g;
    const nxu = nx + 1;
    const ug = g.ug;
    const vg = g.vg;
    for (let j = 0; j < ny; j += 1) {
      for (let i = 0; i <= nx; i += 1) {
        const f = i + j * nxu;
        const l = i > 0 ? kind[i - 1 + j * nx] : -1;
        const r = i < nx ? kind[i + j * nx] : -1;
        let gas = 0;
        if (l === GAS && r === GAS) gas = 1;
        else if ((i === 0 && g.openL && r === GAS) || (i === nx && g.openR && l === GAS)) gas = 1;
        if (g.au[f] <= 0) gas = 0;
        this.gasU[f] = gas;
        if (gas === 0) ug[f] = l === LIQUID || r === LIQUID ? (l === SOLID || r === SOLID || (i === 0 && !g.openL) || (i === nx && !g.openR) ? 0 : g.ul[f]) : g.usol[f];
      }
    }
    for (let j = 0; j <= ny; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        const f = i + j * nx;
        const b = j > 0 ? kind[i + (j - 1) * nx] : -1;
        const t = j < ny ? kind[i + j * nx] : -1;
        let gas = 0;
        if (b === GAS && t === GAS) gas = 1;
        else if ((j === 0 && g.openB && t === GAS) || (j === ny && g.openT && b === GAS)) gas = 1;
        if (g.av[f] <= 0) gas = 0;
        this.gasV[f] = gas;
        if (gas === 0) vg[f] = b === LIQUID || t === LIQUID ? (b === SOLID || t === SOLID || (j === 0 && !g.openB) || (j === ny && !g.openT) ? 0 : g.vl[f]) : g.vsol[f];
      }
    }
  }

  /** Flussform-Transport aller Grössen mit den Gasgeschwindigkeiten (gasTransport.ts); liefert die Zahl der Teilschritte. */
  transport(dt: number): number {
    return this.mover.transport(dt);
  }

  /* -- Geschwindigkeit ------------------------------------------------------------------------------ */

  /** Min und Max der vier Stützwerte der letzten Abfrage (für den Begrenzer von MacCormack). */
  private lo = 0;
  private hi = 0;

  private sampleU(a: Float32Array, x: number, y: number): number {
    const g = this.g;
    const { nx, ny, dx } = g;
    const nxu = nx + 1;
    const fx = Math.min(nx - 1e-6, Math.max(0, x / dx));
    const fy = Math.min(ny - 1.000001, Math.max(0, y / dx - 0.5));
    const i = Math.floor(fx), j = Math.floor(fy);
    const tx = fx - i, ty = fy - j;
    const a0 = a[i + j * nxu], a1 = a[i + 1 + j * nxu], a2 = a[i + (j + 1) * nxu], a3 = a[i + 1 + (j + 1) * nxu];
    this.lo = Math.min(a0, a1, a2, a3);
    this.hi = Math.max(a0, a1, a2, a3);
    return (1 - ty) * ((1 - tx) * a0 + tx * a1) + ty * ((1 - tx) * a2 + tx * a3);
  }

  private sampleV(a: Float32Array, x: number, y: number): number {
    const g = this.g;
    const { nx, ny, dx } = g;
    const fx = Math.min(nx - 1.000001, Math.max(0, x / dx - 0.5));
    const fy = Math.min(ny - 1e-6, Math.max(0, y / dx));
    const i = Math.floor(fx), j = Math.floor(fy);
    const tx = fx - i, ty = fy - j;
    const a0 = a[i + j * nx], a1 = a[i + 1 + j * nx], a2 = a[i + (j + 1) * nx], a3 = a[i + 1 + (j + 1) * nx];
    this.lo = Math.min(a0, a1, a2, a3);
    this.hi = Math.max(a0, a1, a2, a3);
    return (1 - ty) * ((1 - tx) * a0 + tx * a1) + ty * ((1 - tx) * a2 + tx * a3);
  }


  /** MacCormack-Transport der Gasgeschwindigkeit, Auftrieb, Zähigkeit. */
  velocity(dt: number, gy: number): void {
    const g = this.g;
    const { nx, ny, dx, kind } = g;
    const nxu = nx + 1;
    const ug = g.ug;
    const vg = g.vg;
    const { u0, v0, u1, v1 } = this;
    const lim = this.lim;
    u0.set(ug);
    v0.set(vg);
    /* Vorwärts: û = u(x − Δt U); die Grenzen der Stützwerte für den Begrenzer gleich mit. */
    for (let j = 0; j < ny; j += 1) for (let i = 0; i <= nx; i += 1) {
      const f = i + j * nxu;
      if (this.gasU[f] === 0) { u1[f] = u0[f]; continue; }
      const x = i * dx, y = (j + 0.5) * dx;
      const v = this.sampleV(v0, x, y);
      u1[f] = this.sampleU(u0, x - dt * u0[f], y - dt * v);
      lim[2 * f] = this.lo;
      lim[2 * f + 1] = this.hi;
    }
    const off = 2 * g.nu;
    for (let j = 0; j <= ny; j += 1) for (let i = 0; i < nx; i += 1) {
      const f = i + j * nx;
      if (this.gasV[f] === 0) { v1[f] = v0[f]; continue; }
      const x = (i + 0.5) * dx, y = j * dx;
      const u = this.sampleU(u0, x, y);
      v1[f] = this.sampleV(v0, x - dt * u, y - dt * v0[f]);
      lim[off + 2 * f] = this.lo;
      lim[off + 2 * f + 1] = this.hi;
    }
    /* Rückwärts und Korrektur: u = û + ½ (u − ũ), begrenzt auf die Stützwerte des Vorwärtsschritts. */
    for (let j = 0; j < ny; j += 1) for (let i = 0; i <= nx; i += 1) {
      const f = i + j * nxu;
      if (this.gasU[f] === 0) continue;
      const x = i * dx, y = (j + 0.5) * dx;
      const v = this.sampleV(v0, x, y);
      const back = this.sampleU(u1, x + dt * u0[f], y + dt * v);
      let val = u1[f] + 0.5 * (u0[f] - back);
      if (val < lim[2 * f] || val > lim[2 * f + 1]) val = u1[f];
      ug[f] = val;
    }
    for (let j = 0; j <= ny; j += 1) for (let i = 0; i < nx; i += 1) {
      const f = i + j * nx;
      if (this.gasV[f] === 0) continue;
      const x = (i + 0.5) * dx, y = j * dx;
      const u = this.sampleU(u0, x, y);
      const back = this.sampleV(v1, x + dt * u, y + dt * v0[f]);
      let val = v1[f] + 0.5 * (v0[f] - back);
      if (val < lim[off + 2 * f] || val > lim[off + 2 * f + 1]) val = v1[f];
      vg[f] = val;
    }
    /* Auftrieb auf den v-Flächen: g (ρ − ρ̄)/ρ, ρ̄ die Bezugsdichte des Gebiets. */
    const R = this.R;
    for (let j = 0; j <= ny; j += 1) for (let i = 0; i < nx; i += 1) {
      const f = i + j * nx;
      if (this.gasV[f] === 0) continue;
      const b = j > 0 ? i + (j - 1) * nx : -1;
      const t = j < ny ? i + j * nx : -1;
      const rb = b >= 0 && kind[b] === GAS ? this.rho[b] : -1;
      const rt = t >= 0 && kind[t] === GAS ? this.rho[t] : -1;
      const rf = Math.max(RHO_MIN, rb > 0 && rt > 0 ? 0.5 * (rb + rt) : Math.max(rb, rt));
      if (!(rb > 0 || rt > 0)) continue;
      const c = rb > 0 ? b : t;
      const r = R.id[c];
      const ref = r >= 0 ? R.rhoBar[r] : R.rhoAmb;
      vg[f] -= dt * gy * (rf - ref) / rf;
    }
    /* Zähigkeit, explizit (ν Δt/Δx² ≈ 0,03 bei 2 mm): Nachbarflächen, die keine Gasflächen sind, mit ihrem Randwert. */
    u1.set(ug);
    v1.set(vg);
    const k = dt / (dx * dx);
    for (let j = 0; j < ny; j += 1) for (let i = 0; i <= nx; i += 1) {
      const f = i + j * nxu;
      if (this.gasU[f] === 0) continue;
      const c = i < nx && kind[i + j * nx] === GAS ? i + j * nx : i - 1 + j * nx;
      const nu = this.mu[c] / Math.max(RHO_MIN, this.rho[c]);
      const uc = u1[f];
      const e = i < nx ? u1[f + 1] : uc;
      const w = i > 0 ? u1[f - 1] : uc;
      const s = j > 0 ? u1[f - nxu] : (g.openB ? uc : -uc);
      const nn = j < ny - 1 ? u1[f + nxu] : (g.openT ? uc : -uc);
      ug[f] = uc + Math.min(0.2, k * nu) * (e + w + s + nn - 4 * uc);
    }
    for (let j = 0; j <= ny; j += 1) for (let i = 0; i < nx; i += 1) {
      const f = i + j * nx;
      if (this.gasV[f] === 0) continue;
      const c = j < ny && kind[i + j * nx] === GAS ? i + j * nx : i + (j - 1) * nx;
      const nu = this.mu[c] / Math.max(RHO_MIN, this.rho[c]);
      const vc = v1[f];
      const nn = j < ny ? v1[f + nx] : vc;
      const s = j > 0 ? v1[f - nx] : vc;
      const w = i > 0 ? v1[f - 1] : (g.openL ? vc : -vc);
      const e = i < nx - 1 ? v1[f + 1] : (g.openR ? vc : -vc);
      vg[f] = vc + Math.min(0.2, k * nu) * (e + w + s + nn - 4 * vc);
    }
  }

  /* -- Projektion ----------------------------------------------------------------------------------- */

  /** S_g je Gaszelle (1/s) aus der Zustandsgleichung und den Quellen des letzten Schritts. */
  sources(dt: number): void {
    const g = this.g;
    const inv = 1 / (g.vCell * dt);
    for (let c = 0; c < g.n; c += 1) {
      if (g.kind[c] !== GAS) { g.Sg[c] = 0; continue; }
      /*
       * Die Volumenkorrektur je Schritt höchstens um eine halbe Zelle (in beide
       * Richtungen): ein plötzlicher Überschuss — eine grosse Blase platzt in
       * eine kleine Zelle — wird über einige Schritte hinausgedrückt (ein
       * kurzer Überdruck), statt eine Geschwindigkeit zu verlangen, die der
       * Transport nicht mehr fassen kann.
       */
      const corr = Math.max(-0.5 * g.vCell, Math.min(0.5 * g.vCell, this.veos[c] - this.vgas[c]));
      const src = Math.max(-0.5 * g.vCell, Math.min(0.5 * g.vCell, this.srcV[c]));
      g.Sg[c] = (corr + src) * inv;
    }
  }

  /** Volumenfluss (je Fläche Δx·D) einer u-Fläche: auf einer Gasfläche α u_g + (1 − α) u_Körper, sonst ihr Randwert. */
  private fluxU(f: number): number {
    const g = this.g;
    const a = g.au[f];
    return this.gasU[f] !== 0 && a < 1 ? a * g.ug[f] + (1 - a) * g.usol[f] : g.ug[f];
  }

  private fluxV(f: number): number {
    const g = this.g;
    const a = g.av[f];
    return this.gasV[f] !== 0 && a < 1 ? a * g.vg[f] + (1 - a) * g.vsol[f] : g.vg[f];
  }

  /** Projektion der Gasgeschwindigkeit (MGPCG auf dem Rechteck der Gaszellen). */
  project(dt: number, tol: number, maxIter: number): GasStats {
    const g = this.g;
    const { nx, ny, dx, kind } = g;
    const nxu = nx + 1;
    const ug = g.ug;
    const vg = g.vg;
    let i0 = nx, i1 = -1, j0 = ny, j1 = -1, cells = 0;
    for (let j = 0; j < ny; j += 1) for (let i = 0; i < nx; i += 1) {
      if (kind[i + j * nx] !== GAS) continue;
      cells += 1;
      if (i < i0) i0 = i;
      if (i > i1) i1 = i;
      if (j < j0) j0 = j;
      if (j > j1) j1 = j;
    }
    const st = this.last.solve;
    st.iterations = 0; st.residual = 0; st.capped = false;
    this.last.cells = cells;
    if (cells === 0) return this.last;
    const S = this.solver;
    const sys = S.begin(i1 - i0 + 1, j1 - j0 + 1);
    const rho = this.rho;
    for (let j = j0; j <= j1; j += 1) {
      for (let i = i0; i <= i1; i += 1) {
        const c = i + j * nx;
        if (kind[c] !== GAS) continue;
        const s = S.at(i - i0, j - j0);
        sys.act[s] = 1;
        sys.x[s] = g.pg[c];
        const fl = i + j * nxu;
        const fb = i + j * nx;
        /* Fluss je Fläche: auf Gasflächen der offene Teil mit dem Gas, der bedeckte mit dem Körper (Batty et al. 2007); sonst der Randwert. */
        const div = this.fluxU(fl + 1) - this.fluxU(fl) + this.fluxV(fb + nx) - this.fluxV(fb);
        sys.b[s] = g.Sg[c] * dx * dx - dx * div;
        const rc = Math.max(RHO_MIN, rho[c]);
        if (i + 1 < nx) { if (kind[c + 1] === GAS && i + 1 <= i1 && this.gasU[fl + 1] !== 0) sys.ax[s] = (g.au[fl + 1] * 2 * dt) / (rc + Math.max(RHO_MIN, rho[c + 1])); }
        else if (g.openR && this.gasU[fl + 1] !== 0) sys.dDx[s] += (g.au[fl + 1] * 2 * dt) / rc;
        if (i === 0 && g.openL && this.gasU[fl] !== 0) sys.dDx[s] += (g.au[fl] * 2 * dt) / rc;
        if (j + 1 < ny) { if (kind[c + nx] === GAS && j + 1 <= j1 && this.gasV[fb + nx] !== 0) sys.ay[s] = (g.av[fb + nx] * 2 * dt) / (rc + Math.max(RHO_MIN, rho[c + nx])); }
        else if (g.openT && this.gasV[fb + nx] !== 0) sys.dDy[s] += (g.av[fb + nx] * 2 * dt) / rc;
        if (j === 0 && g.openB && this.gasV[fb] !== 0) sys.dDy[s] += (g.av[fb] * 2 * dt) / rc;
      }
    }
    const res = S.solve(tol, maxIter, true);
    st.iterations = res.iterations; st.residual = res.residual; st.capped = res.capped;
    const pg = g.pg;
    for (let c = 0; c < g.n; c += 1) if (kind[c] !== GAS) pg[c] = 0;
    for (let j = j0; j <= j1; j += 1) for (let i = i0; i <= i1; i += 1) {
      const c = i + j * nx;
      if (kind[c] === GAS) pg[c] = sys.x[S.at(i - i0, j - j0)];
    }
    /* Flächen korrigieren. */
    for (let j = 0; j < ny; j += 1) for (let i = 0; i <= nx; i += 1) {
      const f = i + j * nxu;
      if (this.gasU[f] === 0) continue;
      if (i === 0) { ug[f] -= ((2 * dt) / Math.max(RHO_MIN, rho[j * nx]) / dx) * pg[j * nx]; continue; }
      if (i === nx) { ug[f] += ((2 * dt) / Math.max(RHO_MIN, rho[nx - 1 + j * nx]) / dx) * pg[nx - 1 + j * nx]; continue; }
      const L = i - 1 + j * nx;
      const Rr = i + j * nx;
      ug[f] -= ((2 * dt) / (Math.max(RHO_MIN, rho[L]) + Math.max(RHO_MIN, rho[Rr])) / dx) * (pg[Rr] - pg[L]);
    }
    for (let j = 0; j <= ny; j += 1) for (let i = 0; i < nx; i += 1) {
      const f = i + j * nx;
      if (this.gasV[f] === 0) continue;
      if (j === 0) { vg[f] -= ((2 * dt) / Math.max(RHO_MIN, rho[i]) / dx) * pg[i]; continue; }
      if (j === ny) { vg[f] += ((2 * dt) / Math.max(RHO_MIN, rho[i + (ny - 1) * nx]) / dx) * pg[i + (ny - 1) * nx]; continue; }
      const B = i + (j - 1) * nx;
      const T = i + j * nx;
      vg[f] -= ((2 * dt) / (Math.max(RHO_MIN, rho[B]) + Math.max(RHO_MIN, rho[T])) / dx) * (pg[T] - pg[B]);
    }
    return this.last;
  }

  /* -- Verschlossene Gebiete: Kompressionswärme ----------------------------------------------------- */

  /**
   * Nach allen Stufen (der Aufrufer hat regions.update() eben neu gerufen:
   * R.p0 ist der Druck des jetzigen Zustands): Δp0 gegen p0 vom Anfang des
   * Schritts; jede Gaszelle bekommt V_c Δp0 (die Arbeit der Kompression).
   * Weil diese Wärme T und damit p0 weiter hebt, gilt
   * Δp0 = (p_Zustand − p_alt)/(1 − a), a = (R/V_g) Σ n_c V_c/C_c
   * ((γ − 1)/γ für reine Luft) — die Bilanz m c_p ΔT = Q + V Δp ergibt dann
   * genau m c_v ΔT = Q. Liefert Σ V_g Δp0 (J) für die Energiebilanz.
   */
  compressionHeating(p0Start: Float64Array): number {
    const g = this.g;
    const R = this.R;
    const n = g.n;
    let work = 0;
    if (this.dp0.length < R.count) this.dp0 = new Float64Array(2 * R.count);
    this.dp0.fill(0);
    for (let r = 0; r < R.count; r += 1) {
      if (R.open[r] !== 0) continue;
      const V = R.vGas[r];
      if (V <= 0) continue;
      let a = 0;
      for (let c = 0; c < n; c += 1) {
        if (R.id[c] !== r || g.kind[c] === SOLID || this.cap[c] <= 0) continue;
        const nc = this.nmol[c];
        a += (nc * ((nc * R_GAS * g.T[c]) / R.pAt(c))) / this.cap[c];
      }
      a *= R_GAS / V;
      const k = 1 / Math.max(0.05, 1 - a);
      /* Bis der Zustandsdruck nach der Kompressionswärme genau p_alt + Δp0 ist (zwei, drei Durchgänge). */
      let total = 0;
      for (let it = 0; it < 4; it += 1) {
        const pState = R.statePressure(r);
        R.p0[r] = pState;
        const d = (pState - (p0Start[r] + total)) * k;
        if (Math.abs(d) <= 1e-10 * pState) break;
        let vsum = 0;
        for (let c = 0; c < n; c += 1) {
          if (R.id[c] !== r || g.kind[c] === SOLID || this.cap[c] <= 0) continue;
          const vc = (this.nmol[c] * R_GAS * g.T[c]) / R.pAt(c);
          vsum += vc;
          g.Hg[c] += vc * d;
          this.deriveCell(c);
        }
        total += d;
        work += vsum * d;
      }
      R.p0[r] = R.statePressure(r);
      this.dp0[r] = total;
    }
    return work;
  }

  /** Feuchte einer Gaszelle: Partialdruck des Dampfs (Pa) bei p(y). */
  vapourPressure(c: number): number {
    const g = this.g;
    const n = g.n;
    let mol = 0;
    for (let k = 0; k < GAS_SPECIES; k += 1) mol += g.mg[k * n + c] / MOLAR[k];
    if (mol <= 0) return 0;
    return ((g.mg[H2O * n + c] / MOLAR[H2O]) / mol) * this.R.pAt(c);
  }
}
