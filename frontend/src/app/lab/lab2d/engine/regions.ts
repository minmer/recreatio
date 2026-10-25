/**
 * LABOR 2D (v2) — GEBIETE UND DER DRUCK p0 (ARCHITECTURE.md §6.4).
 *
 * Ein Fluidgebiet ist eine zusammenhängende Menge nicht fester Zellen (Gas
 * und Flüssigkeit, über Seitenflächen verbunden). Berührt es eine offene
 * Seite, ist es offen: p0 = p_amb. Sonst ist es verschlossen (ein Kasten, eine
 * Zlewka mit Deckel) und hat seinen eigenen, gleichmässigen Druck p0(t).
 *
 * Statt die Gleichung dp0/dt = γ p0 / V_g (∫S_g dV − dV_g/dt) aufzuintegrieren,
 * wird p0 in jedem Schritt aus dem Zustand gesetzt (der Prompt verlangt das
 * Zurücksetzen ohnehin, damit nichts driftet):
 *
 *   Σ_c n_c R T_c / (p0 − ρ̄ g y_c) = V_g,   V_g = V_Gebiet − Σ m_p/ρ_p − Σ V_b
 *
 * (die Hydrostatik ρ̄ g y innerhalb des Gebiets eingeschlossen; V_g ändert sich
 * glatt, weil es Teilchen- und Blasenvolumina zählt, nicht Zellarten). Die
 * Projektion zieht für ein rein Neumann'sches Gasgebiet das Mittel der
 * rechten Seite ab — das ist genau der gleichmässige Anteil (1/(γ p0)) dp0/dt.
 * Die Kompressionswärme V_c Δp0 kommt in finish() zur Enthalpie des Gases.
 *
 * Eine kleine Tasche (unter VENT_V), die erst ein freier Körper verschliesst —
 * ein schräg aufgesetzter Stab über einer Kante, ein Klotz, der auf einer Stufe
 * landet —, ist offen: der Spalt, den das Gitter zuklappt (dünner als eine halbe
 * Zelle), lässt die Luft hinaus. Bis 2026-10-24 bekam sie p0 aus dem Zustand;
 * der sinkende Stab presste sie in einem Schritt auf 2 bar, und ihr Druck
 * schleuderte ihn mit 50 m/s aus der Kiste.
 */

import type { Bubbles } from './bubbles';
import type { Grid } from './grid';
import { MOLAR } from './materials';
import type { Particles } from './particles';
import { GAS, GAS_SPECIES, R_GAS, SOLID } from './units';

/** Bis zu diesem Fluidvolumen (m³; 2 cm³ — bei 1 cm Tiefe 2 cm²) ist eine Tasche, die ein freier Körper verschliesst, nicht dicht. */
const VENT_V = 2e-6;

export class Regions {
  private readonly g: Grid;
  /** Fluidgebiet je Zelle (−1: fest). */
  readonly id: Int32Array;
  count = 0;
  /** Je Gebiet: offen?, Volumen der Fluidzellen, p0 (Pa, auf Höhe des Bodens), mittlere Gasdichte, Volumina. */
  open: Uint8Array = new Uint8Array(4);
  vFluid: Float64Array = new Float64Array(4);
  p0: Float64Array = new Float64Array(4);
  rhoBar: Float64Array = new Float64Array(4);
  vLiq: Float64Array = new Float64Array(4);
  vBub: Float64Array = new Float64Array(4);
  vGas: Float64Array = new Float64Array(4);
  /** Gasmole und Gasmasse je Gebiet (für p0 und ρ̄). */
  private nSum: Float64Array = new Float64Array(4);
  private mSum: Float64Array = new Float64Array(4);
  private readonly stack: Int32Array;
  /** Druck und Dichte der Umgebung (offene Gebiete). */
  pAmb = 101325;
  rhoAmb = 1.2;
  gy = 9.81;
  /** Ist der Körper mit diesem Besitzerwert (Index + 1, grid.owner) frei? (Von der Engine gesetzt; ohne: keiner.) */
  freeAt: ((owner: number) => boolean) | null = null;

  constructor(grid: Grid) {
    this.g = grid;
    this.id = new Int32Array(grid.n).fill(-1);
    this.stack = new Int32Array(grid.n);
  }

  private grow(k: number): void {
    if (k < this.open.length) return;
    const n = Math.max(2 * this.open.length, k + 1);
    const g8 = (a: Uint8Array): Uint8Array => { const b = new Uint8Array(n); b.set(a); return b; };
    const g64 = (a: Float64Array): Float64Array => { const b = new Float64Array(n); b.set(a); return b; };
    this.open = g8(this.open);
    this.vFluid = g64(this.vFluid);
    this.p0 = g64(this.p0);
    this.rhoBar = g64(this.rhoBar);
    this.vLiq = g64(this.vLiq);
    this.vBub = g64(this.vBub);
    this.vGas = g64(this.vGas);
    this.nSum = g64(this.nSum);
    this.mSum = g64(this.mSum);
  }

  /** Die Fluidgebiete neu bestimmen (nach jeder Änderung der Feststoffe oder Seiten). Ein neues verschlossenes Gebiet bekommt p0 aus dem Zustand. */
  label(): void {
    const g = this.g;
    const { nx, ny, solid, au, av } = g;
    const nxu = nx + 1;
    this.id.fill(-1);
    let k = 0;
    for (let s = 0; s < g.n; s += 1) {
      if (solid[s] !== 0 || this.id[s] !== -1) continue;
      this.grow(k);
      let top = 0;
      let open = 0;
      let vol = 0;
      let free = false;
      this.stack[top++] = s;
      this.id[s] = k;
      while (top > 0) {
        const c = this.stack[--top];
        vol += 1 - g.fs[c];
        if (!free && g.owner[c] > 0 && this.freeAt !== null && this.freeAt(g.owner[c])) free = true;
        const i = c % nx;
        const j = (c - i) / nx;
        /* Über Seitenflächen verbunden, die ein Körper nicht ganz bedeckt (eine dünne Wand quer durch zwei Zellen trennt). */
        const fu = i + j * nxu;
        const fv = i + j * nx;
        if ((i === 0 && g.openL && au[fu] > 0) || (i === nx - 1 && g.openR && au[fu + 1] > 0) || (j === 0 && g.openB && av[fv] > 0) || (j === ny - 1 && g.openT && av[fv + nx] > 0)) open = 1;
        if (i > 0 && solid[c - 1] === 0 && this.id[c - 1] === -1 && au[fu] > 0) { this.id[c - 1] = k; this.stack[top++] = c - 1; }
        if (i < nx - 1 && solid[c + 1] === 0 && this.id[c + 1] === -1 && au[fu + 1] > 0) { this.id[c + 1] = k; this.stack[top++] = c + 1; }
        if (j > 0 && solid[c - nx] === 0 && this.id[c - nx] === -1 && av[fv] > 0) { this.id[c - nx] = k; this.stack[top++] = c - nx; }
        if (j < ny - 1 && solid[c + nx] === 0 && this.id[c + nx] === -1 && av[fv + nx] > 0) { this.id[c + nx] = k; this.stack[top++] = c + nx; }
      }
      /* Eine kleine Tasche an einem freien Körper ist nicht dicht (siehe oben). */
      if (open === 0 && free && vol * g.vCell < VENT_V) open = 1;
      this.open[k] = open;
      this.vFluid[k] = vol * g.vCell;
      k += 1;
    }
    this.count = k;
  }

  /** Volumen der Fluidzellen (ohne die Körperstücke darin: ein bewegter Körper ändert es), der Flüssigkeit und der Blasen je Gebiet. */
  private volumes(P: Particles, B: Bubbles): void {
    const g = this.g;
    this.vFluid.fill(0, 0, this.count);
    for (let c = 0; c < g.n; c += 1) {
      const r = this.id[c];
      if (r >= 0) this.vFluid[r] += 1 - g.fs[c];
    }
    for (let r = 0; r < this.count; r += 1) this.vFluid[r] *= g.vCell;
    this.vLiq.fill(0, 0, this.count);
    this.vBub.fill(0, 0, this.count);
    for (let p = 0; p < P.count; p += 1) {
      const c = g.cellAt(P.x[p], P.y[p]);
      const r = c < 0 ? -1 : this.id[c];
      if (r >= 0) this.vLiq[r] += P.mass[p] / P.rho[p];
    }
    for (let b = 0; b < B.count; b += 1) {
      const c = g.cellAt(B.x[b], B.y[b]);
      const r = c < 0 ? -1 : this.id[c];
      if (r >= 0) this.vBub[r] += B.V[b];
    }
    for (let r = 0; r < this.count; r += 1) this.vGas[r] = Math.max(1e-3 * this.vFluid[r], this.vFluid[r] - this.vLiq[r] - this.vBub[r]);
  }

  /** p0 und ρ̄ jedes Gebiets aus dem Zustand (offen: Umgebung). */
  update(P: Particles, B: Bubbles): void {
    const g = this.g;
    this.volumes(P, B);
    this.nSum.fill(0, 0, this.count);
    this.mSum.fill(0, 0, this.count);
    const n = g.n;
    for (let c = 0; c < n; c += 1) {
      const r = this.id[c];
      if (r < 0) continue;
      for (let k = 0; k < GAS_SPECIES; k += 1) {
        const m = g.mg[k * n + c];
        this.mSum[r] += m;
        this.nSum[r] += m / MOLAR[k];
      }
    }
    for (let r = 0; r < this.count; r += 1) {
      if (this.open[r] !== 0) {
        this.p0[r] = this.pAmb;
        this.rhoBar[r] = this.rhoAmb;
        continue;
      }
      this.rhoBar[r] = this.mSum[r] / this.vGas[r];
      this.p0[r] = this.statePressure(r);
    }
  }

  /** Σ_c n_c R T_c / (p0 − ρ̄ g y_c) = V_g nach p0 (Newton, zwei Schritte ab der Lösung ohne Hydrostatik). */
  statePressure(r: number): number {
    const g = this.g;
    const n = g.n;
    let A = 0;
    for (let c = 0; c < n; c += 1) {
      if (this.id[c] !== r || g.kind[c] === SOLID) continue;
      let nc = 0;
      for (let k = 0; k < GAS_SPECIES; k += 1) nc += g.mg[k * n + c] / MOLAR[k];
      A += nc * R_GAS * g.T[c];
    }
    if (A <= 0) return this.pAmb;
    const V = this.vGas[r];
    let p = A / V;
    const rg = this.rhoBar[r] * this.gy;
    if (rg === 0) return p;
    for (let it = 0; it < 2; it += 1) {
      let f = -V;
      let df = 0;
      for (let c = 0; c < n; c += 1) {
        if (this.id[c] !== r || g.kind[c] === SOLID) continue;
        let nc = 0;
        for (let k = 0; k < GAS_SPECIES; k += 1) nc += g.mg[k * n + c] / MOLAR[k];
        const d = p - rg * (g.dx * ((c - (c % g.nx)) / g.nx + 0.5));
        const a = nc * R_GAS * g.T[c];
        f += a / d;
        df -= a / (d * d);
      }
      p -= f / df;
    }
    return p;
  }

  /** Der Druck der Umgebung des Gases in Zelle c: p0 − ρ̄ g y (Pa). */
  pAt(c: number): number {
    const r = this.id[c];
    if (r < 0) return this.pAmb;
    const g = this.g;
    const y = g.dx * (Math.floor(c / g.nx) + 0.5);
    return this.p0[r] - this.rhoBar[r] * this.gy * y;
  }

  /** Ob eine Gaszelle in einem offenen Gebiet liegt. */
  isOpen(c: number): boolean {
    const r = this.id[c];
    return r >= 0 && this.open[r] !== 0;
  }

  /** Der Anteil −Σ_verschlossen p0·V_Fluid der Energiebilanz (U = H − p0 V in verschlossenen Gebieten). */
  pvTerm(): number {
    let pv = 0;
    for (let r = 0; r < this.count; r += 1) if (this.open[r] === 0) pv -= this.p0[r] * this.vFluid[r];
    return pv;
  }

  /** Wie viele verschlossene Gebiete es gibt (für die Anzeige). */
  sealedCount(): number {
    let s = 0;
    for (let r = 0; r < this.count; r += 1) if (this.open[r] === 0) s += 1;
    return s;
  }

  /** Erste Gaszelle eines Gebiets (−1: keine) — für Prüfungen. */
  firstGasCell(r: number): number {
    const g = this.g;
    for (let c = 0; c < g.n; c += 1) if (this.id[c] === r && g.kind[c] === GAS) return c;
    return -1;
  }
}
