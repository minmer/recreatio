/**
 * LABOR 2D (v2) — DAS GITTER (ARCHITECTURE.md §3.1): ein versetztes
 * MAC-Gitter aus quadratischen Zellen der Kante Δx über der Kiste; die Seiten
 * der Kiste sind der Rand des Gebiets, keine Zellen.
 *
 * Zelle (i, j), Index c = i + j·nx, Mitte ((i + ½)Δx, (j + ½)Δx), y nach
 * oben. u-Flächen bei x = iΔx: Index i + j·(nx + 1); v-Flächen bei y = jΔx:
 * Index i + j·nx. Struktur aus Feldern, einmal je Szene angelegt; Massen und
 * Energien Float64, alles andere Float32.
 */

import { SPECIES_SLOTS } from './units';

/** Die Glättung einer vollen Zelle durch den quadratischen B-Spline: Anteil, den eine Nachbarzelle im Abstand −1, 0, +1 abbekommt. */
const K1 = [1 / 6, 2 / 3, 1 / 6] as const;

export class Grid {
  readonly nx: number;
  readonly ny: number;
  readonly n: number;
  readonly dx: number;
  readonly depth: number;
  /** Volumen einer Zelle (m³) und Fläche einer Seitenfläche (m²). */
  readonly vCell: number;
  readonly aFace: number;
  readonly nu: number;
  readonly nv: number;
  /** Offene Seiten (sonst Wand): links, rechts, unten, oben. */
  openL = false;
  openR = false;
  openB = false;
  openT = true;

  /* -- fest (ändert sich nur durch Werkzeuge) -- */
  /** Feststoff: Index + 1 in SOLIDS, 0 = Fluid. */
  readonly solid: Uint8Array;
  /** 1 = Heizelement (innere Wärmequelle). */
  readonly role: Uint8Array;
  /** Heizgruppe der Zelle (−1: keine). */
  readonly heater: Int16Array;
  /** Anteil, den feste Nachbarn (und Wände) zum Volumenanteil beitragen — ersetzt die fehlenden Spiegelteilchen. */
  readonly phiS: Float32Array;
  /** Vorzeichenbehafteter Abstand zur Feststoffgrenze in der Zellmitte (m): positiv im Fluid. */
  readonly sdf: Float32Array;
  /** Körper (M3a): Nummer + 1 des Körpers, dem die feste Zelle gehört (0: keinem — ein fester Bau aus „solid“). */
  readonly owner: Int16Array;
  /** Wärmekapazität des Feststoffs einer Zelle, die ein gedrehter oder bewegter Körper füllt (J/K, aus seinen Voxeln; 0: aus dem Werkstoff). */
  readonly capB: Float64Array;
  /** Geschwindigkeit fester Seitenflächen (m/s): an Zellen bewegter Körper die des Körpers, sonst 0. */
  readonly usol: Float32Array;
  readonly vsol: Float32Array;

  /* -- je Schritt -- */
  readonly phi: Float32Array;
  readonly alpha: Float32Array;
  readonly kind: Uint8Array;
  readonly region: Int32Array;
  /** Druck der Flüssigkeit über p_ref (Pa, mit Hydrostatik) und Abweichung des Gases p′ = p − p_amb(y). */
  readonly pl: Float32Array;
  readonly pg: Float32Array;
  /** Gasmassen je Art (kg): [k·n + c]. */
  readonly mg: Float64Array;
  readonly mfog: Float64Array;
  /** Enthalpie des Gases einer Zelle samt Nebel (J). */
  readonly Hg: Float64Array;
  /** Energie (Enthalpie) eines Feststoffs (J). */
  readonly Es: Float64Array;
  /** Wasserfilm auf einer festen Oberflächenzelle (kg). */
  readonly film: Float64Array;
  /** Salzkruste auf einer festen Zelle (kg Kochsalz, M2b) — ihre Enthalpie steckt in Es. */
  readonly crust: Float64Array;
  /** Temperatur der Zelle (K, abgeleitet). */
  readonly T: Float32Array;
  /** Temperatur und Wärmekapazität des flüssigen Anteils (aus den Teilchen). */
  readonly Tl: Float32Array;
  readonly Cl: Float64Array;
  readonly Sl: Float32Array;
  readonly Sg: Float32Array;
  readonly ul: Float32Array;
  readonly vl: Float32Array;
  readonly ug: Float32Array;
  readonly vg: Float32Array;

  constructor(nx: number, ny: number, dx: number, depth: number) {
    this.nx = nx;
    this.ny = ny;
    this.n = nx * ny;
    this.dx = dx;
    this.depth = depth;
    this.vCell = dx * dx * depth;
    this.aFace = dx * depth;
    this.nu = (nx + 1) * ny;
    this.nv = nx * (ny + 1);
    const n = this.n;
    this.solid = new Uint8Array(n);
    this.role = new Uint8Array(n);
    this.heater = new Int16Array(n).fill(-1);
    this.phiS = new Float32Array(n);
    this.sdf = new Float32Array(n);
    this.owner = new Int16Array(n);
    this.capB = new Float64Array(n);
    this.usol = new Float32Array(this.nu);
    this.vsol = new Float32Array(this.nv);
    this.phi = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.kind = new Uint8Array(n);
    this.region = new Int32Array(n).fill(-1);
    this.pl = new Float32Array(n);
    this.pg = new Float32Array(n);
    this.mg = new Float64Array(SPECIES_SLOTS * n);
    this.mfog = new Float64Array(n);
    this.Hg = new Float64Array(n);
    this.Es = new Float64Array(n);
    this.film = new Float64Array(n);
    this.crust = new Float64Array(n);
    this.T = new Float32Array(n);
    this.Tl = new Float32Array(n);
    this.Cl = new Float64Array(n);
    this.Sl = new Float32Array(n);
    this.Sg = new Float32Array(n);
    this.ul = new Float32Array(this.nu);
    this.vl = new Float32Array(this.nv);
    this.ug = new Float32Array(this.nu);
    this.vg = new Float32Array(this.nv);
  }

  get w(): number { return this.nx * this.dx; }
  get h(): number { return this.ny * this.dx; }

  /** Die Zelle, in der (x, y) liegt (−1 ausserhalb). */
  cellAt(x: number, y: number): number {
    const i = Math.floor(x / this.dx);
    const j = Math.floor(y / this.dx);
    return i < 0 || j < 0 || i >= this.nx || j >= this.ny ? -1 : i + j * this.nx;
  }

  /** Ob die Nachbarzelle (i, j) — auch ausserhalb — fest ist: Feststoff, oder hinter einer Wandseite. */
  solidAt(i: number, j: number): boolean {
    if (i < 0) return !this.openL;
    if (i >= this.nx) return !this.openR;
    if (j < 0) return !this.openB;
    if (j >= this.ny) return !this.openT;
    return this.solid[i + j * this.nx] !== 0;
  }

  /**
   * Feste Daten nach jeder Änderung der Feststoffe oder Seiten neu: φ_s und der
   * Abstand zur Wand — überall oder (bewegte Körper) nur in einem Rechteck der
   * Zellen (i0, j0)–(i1, j1), das alle geänderten Zellen samt vier Zellen Rand
   * (so weit sucht der Abstand) enthält.
   */
  updateStatic(ri0 = 0, rj0 = 0, ri1 = this.nx - 1, rj1 = this.ny - 1): void {
    const { nx, ny, dx } = this;
    const I0 = Math.max(0, ri0);
    const J0 = Math.max(0, rj0);
    const I1 = Math.min(nx - 1, ri1);
    const J1 = Math.min(ny - 1, rj1);
    for (let j = J0; j <= J1; j += 1) {
      for (let i = I0; i <= I1; i += 1) {
        const c = i + j * nx;
        if (this.solid[c] !== 0) { this.phiS[c] = 1; continue; }
        let s = 0;
        for (let b = -1; b <= 1; b += 1) for (let a = -1; a <= 1; a += 1) if ((a !== 0 || b !== 0) && this.solidAt(i + a, j + b)) s += K1[a + 1] * K1[b + 1];
        this.phiS[c] = s;
      }
    }
    /* Abstand: zum nächsten Punkt einer festen Zelle (oder einer Wandseite), höchstens 4 Zellen weit gesucht. */
    const R = 4;
    const far = R * dx;
    for (let j = J0; j <= J1; j += 1) {
      for (let i = I0; i <= I1; i += 1) {
        const c = i + j * nx;
        const inSolid = this.solid[c] !== 0;
        const x = (i + 0.5) * dx;
        const y = (j + 0.5) * dx;
        let best = far;
        if (!inSolid) {
          if (!this.openL) best = Math.min(best, x);
          if (!this.openR) best = Math.min(best, this.w - x);
          if (!this.openB) best = Math.min(best, y);
          if (!this.openT) best = Math.min(best, this.h - y);
        }
        for (let b = -R; b <= R; b += 1) {
          const jj = j + b;
          if (jj < 0 || jj >= ny) continue;
          for (let a = -R; a <= R; a += 1) {
            const ii = i + a;
            if (ii < 0 || ii >= nx) continue;
            const other = this.solid[ii + jj * nx] !== 0;
            if (other === inSolid) continue;
            /* Abstand der Mitte zum Quadrat der anderen Art. */
            const ex = Math.max(0, Math.abs(ii + 0.5 - (i + 0.5)) - 0.5) * dx;
            const ey = Math.max(0, Math.abs(jj + 0.5 - (j + 0.5)) - 0.5) * dx;
            const d = Math.hypot(ex, ey);
            if (d < best) best = d;
          }
        }
        this.sdf[c] = inSolid ? -best : best;
      }
    }
  }

  /** Der Abstand zur Wand an einem Punkt, bilinear aus den Zellmitten (m); ausserhalb einer Wandseite negativ. */
  sdfAt(x: number, y: number): number {
    const { nx, ny, dx } = this;
    const fx = Math.min(nx - 1.0001, Math.max(0, x / dx - 0.5));
    const fy = Math.min(ny - 1.0001, Math.max(0, y / dx - 0.5));
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const tx = fx - i;
    const ty = fy - j;
    const i1 = Math.min(nx - 1, i + 1);
    const j1 = Math.min(ny - 1, j + 1);
    const s = this.sdf;
    let d = (1 - ty) * ((1 - tx) * s[i + j * nx] + tx * s[i1 + j * nx]) + ty * ((1 - tx) * s[i + j1 * nx] + tx * s[i1 + j1 * nx]);
    if (!this.openL) d = Math.min(d, x);
    if (!this.openR) d = Math.min(d, this.w - x);
    if (!this.openB) d = Math.min(d, y);
    if (!this.openT) d = Math.min(d, this.h - y);
    return d;
  }
}
