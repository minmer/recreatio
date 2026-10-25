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
  /** Körper (bodyCover.ts): Nummer + 1 des Körpers mit dem grössten Anteil an der Zelle (0: keiner — dann ist eine feste Zelle ein Bau aus „solid“). */
  readonly owner: Int16Array;
  /** Anteil der Zelle, den Körper bedecken (0–1, genau aus ihren Rechtecken); ab CLOSED (CLOSED_FREE bei einem freien Körper; oder durchschnitten) ist die Zelle fest. */
  readonly fs: Float32Array;
  /** Wärmekapazität der Körperteile einer Zelle (J/K, aus ihren inneren Zellen; 0: keine — eine feste Zelle hat dann die ihres Werkstoffs). */
  readonly capB: Float64Array;
  /** Werkstoff + 1 des Körpers mit dem grössten Anteil an der Zelle (0: keiner) — für die Wärmeleitung gemischter Zellen. */
  readonly matB: Uint8Array;
  /** Temperatur des festen Anteils einer Zelle (K): in festen Zellen gleich T, in Zellen mit Fluid und Körperteil die des Körperteils. */
  readonly Ts: Float32Array;
  /** Offener Anteil jeder Seitenfläche (0–1): was kein Körper bedeckt (feste Zellen und Wandseiten zählen nicht hier). */
  readonly au: Float32Array;
  readonly av: Float32Array;
  /** Geschwindigkeit des festen Teils einer Seitenfläche (m/s): die des Körpers, der sie bedeckt, sonst 0. */
  readonly usol: Float32Array;
  readonly vsol: Float32Array;
  /** Nachbarn hinter einer dünnen Wand je Zelle (updateThin) und ob es überhaupt welche gibt. */
  readonly thin: Uint16Array;
  thinAny = false;

  /* -- je Schritt -- */
  readonly phi: Float32Array;
  readonly alpha: Float32Array;
  /** Volumenanteil der Körner (M3c, aus ihren Teilchen) — die Flüssigkeit weicht ihm wie dem der Blasen. */
  readonly grain: Float32Array;
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
    this.fs = new Float32Array(n);
    this.capB = new Float64Array(n);
    this.matB = new Uint8Array(n);
    this.Ts = new Float32Array(n);
    this.au = new Float32Array(this.nu).fill(1);
    this.av = new Float32Array(this.nv).fill(1);
    this.usol = new Float32Array(this.nu);
    this.vsol = new Float32Array(this.nv);
    this.thin = new Uint16Array(n);
    this.phi = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.grain = new Float32Array(n);
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

  /** Offener Anteil der Seite k (0 links, 1 rechts, 2 unten, 3 oben) der Zelle c: 0, wo ein Körper sie ganz deckt (eine dünne Wand quer durch zwei Zellen). */
  faceOpen(c: number, k: number): number {
    const i = c % this.nx;
    const j = (c - i) / this.nx;
    return k === 0 ? this.au[i + j * (this.nx + 1)] : k === 1 ? this.au[i + 1 + j * (this.nx + 1)] : k === 2 ? this.av[c] : this.av[c + this.nx];
  }

  /**
   * Dünne Wände: je Zelle die Nachbarn ihrer 3×3-Umgebung (Bit k = a + 1 + 3 (b + 1)), die eine ganz bedeckte Fläche
   * von ihr trennt, obwohl beide nicht fest sind (eine Becherwand quer durch zwei Zellen) — über Eck, wenn beide Wege
   * durch eine nicht feste Zelle so getrennt sind. Teilchen tragen dorthin nichts (liquid.ts), sonst läge das Wasser
   * innen auch in der Zelle draussen. Ohne solche Flächen bleibt alles 0 (thinAny false). Nach jeder Änderung der Flächen.
   */
  updateThin(): void {
    const { nx, ny, au, av, solid } = this;
    if (this.thinAny) this.thin.fill(0);
    this.thinAny = false;
    /* Jede dünne Fläche (links bzw. unter einer Zelle) betrifft nur die Zellen, in deren Umgebung ihre beiden Seiten liegen. */
    for (let j = 0; j < ny; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        const c = i + j * nx;
        if (solid[c] !== 0) continue;
        if (i > 0 && au[i + j * (nx + 1)] <= 0 && solid[c - 1] === 0) this.thinBlock(i - 1, i, j - 1, j + 1);
        if (j > 0 && av[c] <= 0 && solid[c - nx] === 0) this.thinBlock(i - 1, i + 1, j - 1, j);
      }
    }
  }

  /** Die Masken der Zellen (i0 … i1, j0 … j1) neu. */
  private thinBlock(i0: number, i1: number, j0: number, j1: number): void {
    this.thinAny = true;
    for (let j = Math.max(0, j0); j <= Math.min(this.ny - 1, j1); j += 1) {
      for (let i = Math.max(0, i0); i <= Math.min(this.nx - 1, i1); i += 1) this.thinCell(i, j);
    }
  }

  /** Die Maske einer Zelle: welche nicht festen Nachbarn eine ganz bedeckte Fläche von ihr trennt (über Eck: beide Wege). */
  private thinCell(i: number, j: number): void {
    const { nx, ny, au, av, solid } = this;
    const su = nx + 1;
    const c = i + j * nx;
    let m = 0;
    if (solid[c] === 0) {
      for (let k = 0; k < 9; k += 1) {
        const a = (k % 3) - 1;
        const b = ((k / 3) | 0) - 1;
        const ii = i + a;
        const jj = j + b;
        if (k === 4 || ii < 0 || jj < 0 || ii >= nx || jj >= ny || solid[ii + jj * nx] !== 0) continue;
        /* Die Fläche zwischen der Zelle und dem Nachbarn in Richtung a (waagrecht) bzw. b (senkrecht). */
        const fx = (a > 0 ? 1 : 0) + j * su;
        const fy = (b > 0 ? 1 : 0) * nx;
        let cut: boolean;
        if (b === 0) cut = au[i + fx] <= 0;
        else if (a === 0) cut = av[i + j * nx + fy] <= 0;
        else {
          /* Über (ii, j): fest — wie bisher durchlässig; sonst getrennt, wenn eine der beiden Flächen zu ist. Ebenso über (i, jj). */
          const viaX = solid[ii + j * nx] === 0 && (au[i + fx] <= 0 || av[ii + j * nx + fy] <= 0);
          const viaY = solid[i + jj * nx] === 0 && (av[i + j * nx + fy] <= 0 || au[i + (a > 0 ? 1 : 0) + jj * su] <= 0);
          cut = viaX && viaY;
        }
        if (cut) m |= 1 << k;
      }
    }
    this.thin[c] = m;
  }

  /** Die Gewichte w[o … o + 8] eines Teilchens in Zelle (i, j) ohne die Nachbarn hinter einer dünnen Wand (updateThin): ihr Anteil geht an die übrigen. */
  cutWeights(i: number, j: number, w: Float32Array, o: number): void {
    const m = i >= 0 && j >= 0 && i < this.nx && j < this.ny ? this.thin[i + j * this.nx] : 0;
    if (m === 0) return;
    let sum = 0;
    for (let k = 0; k < 9; k += 1) { if ((m >> k) & 1) w[o + k] = 0; else sum += w[o + k]; }
    if (sum > 0) for (let k = 0; k < 9; k += 1) w[o + k] /= sum;
  }

  /** Ob die Nachbarzelle (i, j) — auch ausserhalb — fest ist: Feststoff, oder hinter einer Wandseite. */
  solidAt(i: number, j: number): boolean {
    if (i < 0) return !this.openL;
    if (i >= this.nx) return !this.openR;
    if (j < 0) return !this.openB;
    if (j >= this.ny) return !this.openT;
    return this.solid[i + j * this.nx] !== 0;
  }

  /** Fester Anteil der Zelle (i, j) — auch ausserhalb: 1 hinter einer Wandseite, 0 hinter einer offenen; eine feste Zelle 1, sonst der Anteil der Körper. */
  solidShare(i: number, j: number): number {
    if (i < 0) return this.openL ? 0 : 1;
    if (i >= this.nx) return this.openR ? 0 : 1;
    if (j < 0) return this.openB ? 0 : 1;
    if (j >= this.ny) return this.openT ? 0 : 1;
    const c = i + j * this.nx;
    return this.solid[c] !== 0 ? 1 : this.fs[c];
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
    /* φ_s: die Glättung des festen Anteils über die Nachbarn (feste Zellen und Wandseiten ganz, Zellen mit einem Körperteil mit seinem Anteil fs) — so viel Volumen fehlt den Teilchen dort. */
    for (let j = J0; j <= J1; j += 1) {
      for (let i = I0; i <= I1; i += 1) {
        const c = i + j * nx;
        if (this.solid[c] !== 0) { this.phiS[c] = 1; continue; }
        let s = 0;
        for (let b = -1; b <= 1; b += 1) for (let a = -1; a <= 1; a += 1) s += K1[a + 1] * K1[b + 1] * this.solidShare(i + a, j + b);
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
