/**
 * LABOR 2D (v2) — DIE GLEICHUNGSLÖSER (ARCHITECTURE.md §6.6).
 *
 * Ein lineares System auf (einem Ausschnitt) des Gitters, in der Form der
 * finiten Volumen:
 *
 *   (A x)_c = (dH_c + dDx_c + dDy_c + Σ_f a_f) x_c − Σ_f a_f x_nb(f)
 *
 * mit a_f ≥ 0 je Fläche zwischen zwei Unbekannten (ax: zur rechten, ay: zur
 * oberen Nachbarzelle), dH einem Flächenterm (C/Δt beim Wärmeleiten) und
 * dDx, dDy den Kopplungen an Dirichlet-Werte über Flächen quer zu x bzw. y
 * (offene Seiten, Gaszellen über der Flüssigkeit). A ist symmetrisch positiv
 * (semi)definit.
 *
 * - <b>Druck</b>: CG, vorkonditioniert mit einem V-Zyklus des geometrischen
 *   Mehrgitters (McAdams, Sifakis, Teran 2010): Zellmitten-Stufen 2 × 2 → 1;
 *   rot-schwarzes Gauss-Seidel vor (rot, schwarz) und nach (schwarz, rot)
 *   dem Grobgitter, bilineare Verlängerung der Zellmitten, Restriktion = ihre
 *   Transponierte — so bleibt der Vorkonditionierer symmetrisch.
 *   <b>Grobe Operatoren geometrisch</b>: jede grobe Zelle kennt ihre aktive
 *   Fläche und deren Schwerpunkt; eine grobe Fläche bekommt Σ κL ihrer feinen
 *   Flächen geteilt durch den Abstand der Schwerpunkte, eine
 *   Dirichlet-Kopplung κL durch den Abstand vom Schwerpunkt zur Fläche. Eine
 *   grobe Zelle, die nur halb im Gebiet liegt (ungerade Ränder, die
 *   Oberfläche des Wassers, Wände), bekommt so die richtigen Kopplungen —
 *   mit blossen Mitteln liegt der Dirichlet-Rand auf der groben Stufe falsch,
 *   und der V-Zyklus divergiert dort.
 * - <b>Wärme, Diffusion</b>: CG mit Jacobi (das System ist stark diagonal).
 * - Rein Neumann'sche Gebiete (ein verschlossener Kasten): die Konstante wird
 *   aus rechter Seite und Vorkonditionierung herausprojiziert.
 *
 * Die Felder haben einen Rand aus Geisterzellen (Koeffizienten 0, x = 0):
 * Zelle (i, j) des Ausschnitts liegt bei (i + 1) + (j + 1)·stride. So laufen
 * die inneren Schleifen ohne Verzweigung; eine inaktive Zelle hat Diagonale 1,
 * rechte Seite 0 und keine Kopplung — sie bleibt von selbst bei 0.
 *
 * Bridson (2015), Kap. 5, für Projektion und Druck; kein MIC(0) (Prompt v2:
 * bei voller Auflösung zu langsam). Alles ist einmal je Szene angelegt.
 */

interface Level {
  nx: number;
  ny: number;
  stride: number;
  /** Kantenlänge einer Zelle in feinsten Zellen (2^Stufe). */
  h: number;
  /** Übertragung von der nächstfeineren Stufe: je feine Zelle vier grobe Zellen und ihre Gewichte (nur auf groben Stufen). */
  readonly pIdx: Int32Array;
  readonly pW: Float32Array;
  readonly ax: Float64Array;
  readonly ay: Float64Array;
  /** Zähler der Flächenkoeffizienten: Σ κL (a = g/Abstand der Schwerpunkte). */
  readonly gx: Float64Array;
  readonly gy: Float64Array;
  readonly dH: Float64Array;
  readonly dDx: Float64Array;
  readonly dDy: Float64Array;
  /** Dirichlet: Σ κL und der wirksame Abstand vom Schwerpunkt (in feinsten Zellen). */
  readonly gDx: Float64Array;
  readonly gDy: Float64Array;
  readonly eDx: Float64Array;
  readonly eDy: Float64Array;
  /** Aktiver Flächenanteil und Schwerpunkt (relativ zur Zellmitte, in Zellkanten dieser Stufe). */
  readonly area: Float64Array;
  readonly ox: Float64Array;
  readonly oy: Float64Array;
  readonly diag: Float64Array;
  readonly inv: Float64Array;
  readonly act: Uint8Array;
  readonly x: Float64Array;
  readonly b: Float64Array;
  readonly r: Float64Array;
}

/** Was der Aufrufer füllt: die Koeffizienten, die rechte Seite und (Warmstart) x — alles mit Rand, Index über `at`. */
export interface System {
  readonly nx: number;
  readonly ny: number;
  readonly stride: number;
  readonly ax: Float64Array;
  readonly ay: Float64Array;
  readonly dH: Float64Array;
  readonly dDx: Float64Array;
  readonly dDy: Float64Array;
  readonly act: Uint8Array;
  readonly x: Float64Array;
  readonly b: Float64Array;
}

export interface SolveResult {
  iterations: number;
  /** Relatives Residuum ‖b − A x‖₂ / ‖b‖₂ am Ende. */
  residual: number;
  /** Die Höchstzahl der Schritte wurde erreicht, ohne die Toleranz zu treffen. */
  capped: boolean;
}

const makeLevel = (n: number, fineN: number): Level => ({
  nx: 0,
  ny: 0,
  stride: 2,
  h: 1,
  pIdx: new Int32Array(4 * fineN),
  pW: new Float32Array(4 * fineN),
  ax: new Float64Array(n),
  ay: new Float64Array(n),
  gx: new Float64Array(n),
  gy: new Float64Array(n),
  dH: new Float64Array(n),
  dDx: new Float64Array(n),
  dDy: new Float64Array(n),
  gDx: new Float64Array(n),
  gDy: new Float64Array(n),
  eDx: new Float64Array(n),
  eDy: new Float64Array(n),
  area: new Float64Array(n),
  ox: new Float64Array(n),
  oy: new Float64Array(n),
  diag: new Float64Array(n),
  inv: new Float64Array(n),
  act: new Uint8Array(n),
  x: new Float64Array(n),
  b: new Float64Array(n),
  r: new Float64Array(n)
});

/** Kleinste Stufe: so grob wird das Mehrgitter höchstens. */
const COARSE_CELLS = 24;
/** Glättungsschritte vor und nach dem Grobgitter, Sweeps auf der gröbsten Stufe. */
const PRE = 1;
const POST = 1;
const COARSEST_SWEEPS = 24;

const padded = (nx: number, ny: number): number => (nx + 2) * (ny + 2);

export class GridSolver {
  private readonly levels: Level[] = [];
  private depth = 1;
  /** Die Vektoren des CG: Lösung, rechte Seite; r liegt in b der feinsten Mehrgitterstufe, z in deren x. */
  private readonly xs: Float64Array;
  private readonly bs: Float64Array;
  private readonly p: Float64Array;
  private readonly q: Float64Array;
  private readonly zj: Float64Array;
  private readonly rj: Float64Array;
  /** Rein Neumann'sche Gebiete: Gebiet je Zelle (−1: keins) und Summen je Gebiet. */
  private readonly nullId: Int32Array;
  private readonly stack: Int32Array;
  private nullSum: Float64Array = new Float64Array(16);
  private nullCnt: Float64Array = new Float64Array(16);
  private nullCount = 0;
  readonly system: System;
  /** Das Ergebnis des letzten Lösens (ein Objekt, wiederverwendet — keine Zuweisung im Schritt). */
  readonly result: SolveResult = { iterations: 0, residual: 0, capped: false };
  private readonly pw = new Float64Array(4);
  private readonly pi = new Int32Array(4);

  constructor(maxNx: number, maxNy: number) {
    let nx = maxNx;
    let ny = maxNy;
    let fineN = 0;
    for (;;) {
      this.levels.push(makeLevel(padded(nx, ny), fineN));
      if (nx * ny <= COARSE_CELLS || (nx <= 2 && ny <= 2)) break;
      fineN = padded(nx, ny);
      nx = Math.ceil(nx / 2);
      ny = Math.ceil(ny / 2);
    }
    const n = padded(maxNx, maxNy);
    this.xs = new Float64Array(n);
    this.bs = new Float64Array(n);
    this.p = new Float64Array(n);
    this.q = new Float64Array(n);
    this.zj = new Float64Array(n);
    this.rj = new Float64Array(n);
    this.nullId = new Int32Array(n);
    this.stack = new Int32Array(n);
    const L0 = this.levels[0];
    const xs = this.xs;
    const bs = this.bs;
    this.system = {
      get nx() { return L0.nx; },
      get ny() { return L0.ny; },
      get stride() { return L0.stride; },
      ax: L0.ax, ay: L0.ay, dH: L0.dH, dDx: L0.dDx, dDy: L0.dDy, act: L0.act, x: xs, b: bs
    };
  }

  /** Index der Zelle (i, j) des Ausschnitts in den Feldern. */
  at(i: number, j: number): number {
    return i + 1 + (j + 1) * this.levels[0].stride;
  }

  /** Ein neues System der Grösse nx × ny anfangen: alles null, nichts aktiv. */
  begin(nx: number, ny: number): System {
    const L0 = this.levels[0];
    L0.nx = nx;
    L0.ny = ny;
    L0.stride = nx + 2;
    L0.h = 1;
    const n = padded(nx, ny);
    L0.ax.fill(0, 0, n);
    L0.ay.fill(0, 0, n);
    L0.dH.fill(0, 0, n);
    L0.dDx.fill(0, 0, n);
    L0.dDy.fill(0, 0, n);
    L0.act.fill(0, 0, n);
    this.bs.fill(0, 0, n);
    this.xs.fill(0, 0, n);
    return this.system;
  }

  /* -- Hilfen ------------------------------------------------------------------------------------- */

  /** Diagonale und ihr Kehrwert; inaktive Zellen: 1 (Koeffizienten zu ihnen sind 0). */
  private static diagonal(L: Level): void {
    const { nx, ny, stride, ax, ay, dH, dDx, dDy, diag, inv, act } = L;
    for (let j = 1; j <= ny; j += 1) {
      let c = 1 + j * stride;
      for (let i = 1; i <= nx; i += 1, c += 1) {
        if (act[c] === 0) { diag[c] = 1; inv[c] = 1; continue; }
        const d = dH[c] + dDx[c] + dDy[c] + ax[c] + ax[c - 1] + ay[c] + ay[c - stride];
        diag[c] = d > 0 ? d : 1e-300;
        inv[c] = 1 / diag[c];
      }
    }
  }

  /** y = A x (inaktive Zellen: x = 0 vorausgesetzt, y = x). */
  private static apply(L: Level, x: Float64Array, y: Float64Array): void {
    const { nx, ny, stride, ax, ay, diag } = L;
    for (let j = 1; j <= ny; j += 1) {
      let c = 1 + j * stride;
      for (let i = 1; i <= nx; i += 1, c += 1) {
        y[c] = diag[c] * x[c] - ax[c] * x[c + 1] - ax[c - 1] * x[c - 1] - ay[c] * x[c + stride] - ay[c - stride] * x[c - stride];
      }
    }
  }

  /** Ein Gauss-Seidel-Durchgang über eine Farbe ((i + j) & 1 === color). */
  private static color(L: Level, color: number): void {
    const { nx, ny, stride, ax, ay, inv, x, b } = L;
    for (let j = 1; j <= ny; j += 1) {
      let c = 1 + ((1 + j + color) & 1) + j * stride;
      const end = nx + j * stride;
      for (; c <= end; c += 2) {
        x[c] = (b[c] + ax[c] * x[c + 1] + ax[c - 1] * x[c - 1] + ay[c] * x[c + stride] + ay[c - stride] * x[c - stride]) * inv[c];
      }
    }
  }

  /** Die feinste Stufe für das Mehrgitter vorbereiten: Zähler, Flächen, Schwerpunkte. */
  private prepareFine(): void {
    const L = this.levels[0];
    const n = padded(L.nx, L.ny);
    for (let c = 0; c < n; c += 1) {
      if (L.act[c] === 0) {
        L.gx[c] = 0; L.gy[c] = 0; L.gDx[c] = 0; L.gDy[c] = 0; L.eDx[c] = 0.5; L.eDy[c] = 0.5;
        L.area[c] = 0; L.ox[c] = 0; L.oy[c] = 0;
        continue;
      }
      /* Feinste Zellen: Fläche 1, Abstand der Mitten 1 — der Zähler ist der Koeffizient selbst; Dirichlet in halber Zelle. */
      L.gx[c] = L.ax[c];
      L.gy[c] = L.ay[c];
      L.gDx[c] = 0.5 * L.dDx[c];
      L.gDy[c] = 0.5 * L.dDy[c];
      L.eDx[c] = 0.5;
      L.eDy[c] = 0.5;
      L.area[c] = 1;
      L.ox[c] = 0;
      L.oy[c] = 0;
    }
  }

  /** Die gröberen Stufen aus der feinen bauen (geometrisch, siehe oben). */
  private coarsen(): void {
    this.depth = 1;
    for (let l = 1; l < this.levels.length; l += 1) {
      const F = this.levels[l - 1];
      if (F.nx * F.ny <= COARSE_CELLS || (F.nx <= 2 && F.ny <= 2)) break;
      const C = this.levels[l];
      const nx = Math.ceil(F.nx / 2);
      const ny = Math.ceil(F.ny / 2);
      C.nx = nx;
      C.ny = ny;
      C.stride = nx + 2;
      C.h = 2 * F.h;
      const np = padded(nx, ny);
      C.ax.fill(0, 0, np);
      C.ay.fill(0, 0, np);
      C.gx.fill(0, 0, np);
      C.gy.fill(0, 0, np);
      C.act.fill(0, 0, np);
      C.area.fill(0, 0, np);
      const fs = F.stride;
      const hf = F.h;
      const hc = C.h;
      /* 1. Flächen, Schwerpunkte, Flächenterme, Dirichlet-Kopplungen. */
      for (let J = 0; J < ny; J += 1) {
        for (let I = 0; I < nx; I += 1) {
          const c = I + 1 + (J + 1) * C.stride;
          let area = 0, mx = 0, my = 0, dH = 0;
          for (let b = 0; b < 2; b += 1) {
            const j = 2 * J + b;
            if (j >= F.ny) continue;
            for (let a = 0; a < 2; a += 1) {
              const i = 2 * I + a;
              if (i >= F.nx) continue;
              const f = i + 1 + (j + 1) * fs;
              if (F.act[f] === 0) continue;
              const A = F.area[f];
              area += A;
              mx += A * ((a - 0.5) * hf + F.ox[f] * hf);
              my += A * ((b - 0.5) * hf + F.oy[f] * hf);
              dH += F.dH[f];
            }
          }
          if (area <= 0) { C.act[c] = 0; C.dH[c] = 0; C.dDx[c] = 0; C.dDy[c] = 0; C.gDx[c] = 0; C.gDy[c] = 0; C.ox[c] = 0; C.oy[c] = 0; continue; }
          C.act[c] = 1;
          C.area[c] = area / 4;
          const xc = mx / area;
          const yc = my / area;
          C.ox[c] = xc / hc;
          C.oy[c] = yc / hc;
          C.dH[c] = dH;
          let gDx = 0, cDx = 0, gDy = 0, cDy = 0;
          for (let b = 0; b < 2; b += 1) {
            const j = 2 * J + b;
            if (j >= F.ny) continue;
            for (let a = 0; a < 2; a += 1) {
              const i = 2 * I + a;
              if (i >= F.nx) continue;
              const f = i + 1 + (j + 1) * fs;
              if (F.act[f] === 0) continue;
              if (F.gDx[f] > 0) {
                const xf = (a - 0.5) * hf + F.ox[f] * hf;
                gDx += F.gDx[f];
                cDx += F.gDx[f] / (F.eDx[f] + Math.abs(xf - xc));
              }
              if (F.gDy[f] > 0) {
                const yf = (b - 0.5) * hf + F.oy[f] * hf;
                gDy += F.gDy[f];
                cDy += F.gDy[f] / (F.eDy[f] + Math.abs(yf - yc));
              }
            }
          }
          C.gDx[c] = gDx;
          C.gDy[c] = gDy;
          C.dDx[c] = cDx;
          C.dDy[c] = cDy;
          C.eDx[c] = cDx > 0 ? gDx / cDx : 0.5 * hc;
          C.eDy[c] = cDy > 0 ? gDy / cDy : 0.5 * hc;
        }
      }
      /* 2. Flächen zwischen groben Zellen: Σ κL der feinen Flächen durch den Abstand der Schwerpunkte. */
      for (let J = 0; J < ny; J += 1) {
        for (let I = 0; I < nx; I += 1) {
          const c = I + 1 + (J + 1) * C.stride;
          if (C.act[c] === 0) continue;
          if (I + 1 < nx && C.act[c + 1] !== 0) {
            const i = 2 * I + 1;
            let g = 0;
            if (i + 1 < F.nx) {
              for (let b = 0; b < 2; b += 1) {
                const j = 2 * J + b;
                if (j >= F.ny) continue;
                g += F.gx[i + 1 + (j + 1) * fs];
              }
            }
            if (g > 0) {
              const d = hc * (1 + C.ox[c + 1] - C.ox[c]);
              C.gx[c] = g;
              C.ax[c] = g / Math.max(0.25 * hc, d);
            }
          }
          if (J + 1 < ny && C.act[c + C.stride] !== 0) {
            const j = 2 * J + 1;
            let g = 0;
            if (j + 1 < F.ny) {
              for (let a = 0; a < 2; a += 1) {
                const i = 2 * I + a;
                if (i >= F.nx) continue;
                g += F.gy[i + 1 + (j + 1) * fs];
              }
            }
            if (g > 0) {
              const d = hc * (1 + C.oy[c + C.stride] - C.oy[c]);
              C.gy[c] = g;
              C.ay[c] = g / Math.max(0.25 * hc, d);
            }
          }
        }
      }
      GridSolver.diagonal(C);
      /* 3. Die Übertragung F ↔ C einmal je Lösen. */
      for (let j = 0; j < F.ny; j += 1) {
        let f = 1 + (j + 1) * fs;
        for (let i = 0; i < F.nx; i += 1, f += 1) {
          if (F.act[f] === 0) { C.pW[4 * f] = 0; C.pW[4 * f + 1] = 0; C.pW[4 * f + 2] = 0; C.pW[4 * f + 3] = 0; C.pIdx[4 * f] = 0; C.pIdx[4 * f + 1] = 0; C.pIdx[4 * f + 2] = 0; C.pIdx[4 * f + 3] = 0; continue; }
          GridSolver.weights(C, i, j, F.dDx[f] + F.dDy[f] > 0, this.pw, this.pi);
          for (let k = 0; k < 4; k += 1) { C.pIdx[4 * f + k] = this.pi[k]; C.pW[4 * f + k] = this.pw[k]; }
        }
      }
      this.depth = l + 1;
    }
  }

  /**
   * Bilineare Verlängerung (Zellmitten): die feine Zelle (i, j) liegt ¼ grobe
   * Zelle neben der Mitte ihrer Mutter (I, J); Gewichte 9/16, 3/16, 3/16, 1/16
   * zur Mutter und den drei Nachbarn auf ihrer Seite. Fehlt ein grober
   * Nachbar: an einem Dirichlet-Rand (die feine Zelle koppelt an einen) fällt
   * sein Gewicht weg — der Fehler ist dort null —, an einer Wand (Neumann)
   * geht es an die Mutter (das Spiegelbild).
   */
  private static weights(C: Level, i: number, j: number, dirichlet: boolean, w: Float64Array, at: Int32Array): void {
    const I = i >> 1;
    const J = j >> 1;
    const di = (i & 1) === 1 ? 1 : -1;
    const dj = (j & 1) === 1 ? 1 : -1;
    const cs = C.stride;
    const base = I + 1 + (J + 1) * cs;
    at[0] = base;
    at[1] = base + di;
    at[2] = base + dj * cs;
    at[3] = base + di + dj * cs;
    const okI = I + di >= 0 && I + di < C.nx;
    const okJ = J + dj >= 0 && J + dj < C.ny;
    w[0] = 9 / 16;
    w[1] = okI && C.act[at[1]] !== 0 ? 3 / 16 : 0;
    w[2] = okJ && C.act[at[2]] !== 0 ? 3 / 16 : 0;
    w[3] = okI && okJ && C.act[at[3]] !== 0 ? 1 / 16 : 0;
    if (!dirichlet) w[0] = 1 - w[1] - w[2] - w[3];
  }

  /** Ein V-Zyklus ab Stufe l (x der Stufe startet bei 0, b ist gesetzt). */
  private vcycle(l: number): void {
    const L = this.levels[l];
    if (l === this.depth - 1) {
      for (let s = 0; s < COARSEST_SWEEPS; s += 1) { GridSolver.color(L, 0); GridSolver.color(L, 1); }
      for (let s = 0; s < COARSEST_SWEEPS; s += 1) { GridSolver.color(L, 1); GridSolver.color(L, 0); }
      return;
    }
    for (let s = 0; s < PRE; s += 1) { GridSolver.color(L, 0); GridSolver.color(L, 1); }
    GridSolver.apply(L, L.x, L.r);
    const C = this.levels[l + 1];
    C.b.fill(0, 0, padded(C.nx, C.ny));
    C.x.fill(0, 0, padded(C.nx, C.ny));
    const { stride, act, b, r, x } = L;
    const { pIdx, pW } = C;
    const cb = C.b;
    const cx = C.x;
    /* Restriktion = Transponierte der bilinearen Verlängerung (Gewichte aus coarsen()). */
    for (let j = 0; j < L.ny; j += 1) {
      let c = 1 + (j + 1) * stride;
      for (let i = 0; i < L.nx; i += 1, c += 1) {
        if (act[c] === 0) continue;
        const res = b[c] - r[c];
        const o = 4 * c;
        cb[pIdx[o]] += pW[o] * res;
        cb[pIdx[o + 1]] += pW[o + 1] * res;
        cb[pIdx[o + 2]] += pW[o + 2] * res;
        cb[pIdx[o + 3]] += pW[o + 3] * res;
      }
    }
    this.vcycle(l + 1);
    for (let j = 0; j < L.ny; j += 1) {
      let c = 1 + (j + 1) * stride;
      for (let i = 0; i < L.nx; i += 1, c += 1) {
        if (act[c] === 0) continue;
        const o = 4 * c;
        x[c] += pW[o] * cx[pIdx[o]] + pW[o + 1] * cx[pIdx[o + 1]] + pW[o + 2] * cx[pIdx[o + 2]] + pW[o + 3] * cx[pIdx[o + 3]];
      }
    }
    for (let s = 0; s < POST; s += 1) { GridSolver.color(L, 1); GridSolver.color(L, 0); }
  }

  /** Rein Neumann'sche Gebiete finden: zusammenhängend über Flächen mit a > 0, ohne Flächen- oder Dirichlet-Term. */
  private findNull(): void {
    const L = this.levels[0];
    const { nx, ny, stride, ax, ay, dH, dDx, dDy, act } = L;
    const id = this.nullId;
    const n = padded(nx, ny);
    id.fill(-2, 0, n);
    this.nullCount = 0;
    for (let j = 1; j <= ny; j += 1) {
      for (let i = 1; i <= nx; i += 1) {
        const s = i + j * stride;
        if (act[s] === 0 || id[s] !== -2) continue;
        let top = 0;
        let count = 0;
        let anchored = false;
        const mark = -3 - this.nullCount;
        this.stack[top++] = s;
        id[s] = mark;
        let lo = s;
        let hi = s;
        while (top > 0) {
          const c = this.stack[--top];
          count += 1;
          if (c < lo) lo = c;
          if (c > hi) hi = c;
          if (dH[c] > 0 || dDx[c] > 0 || dDy[c] > 0) anchored = true;
          if (ax[c] > 0 && id[c + 1] === -2) { id[c + 1] = mark; this.stack[top++] = c + 1; }
          if (ax[c - 1] > 0 && id[c - 1] === -2) { id[c - 1] = mark; this.stack[top++] = c - 1; }
          if (ay[c] > 0 && id[c + stride] === -2) { id[c + stride] = mark; this.stack[top++] = c + stride; }
          if (ay[c - stride] > 0 && id[c - stride] === -2) { id[c - stride] = mark; this.stack[top++] = c - stride; }
        }
        let value = -1;
        if (!anchored) {
          value = this.nullCount;
          if (value >= this.nullSum.length) {
            const grow = (a: Float64Array): Float64Array => { const b = new Float64Array(2 * a.length); b.set(a); return b; };
            this.nullSum = grow(this.nullSum);
            this.nullCnt = grow(this.nullCnt);
          }
          this.nullCnt[value] = count;
          this.nullCount += 1;
        }
        for (let c = lo; c <= hi; c += 1) if (id[c] === mark) id[c] = value;
      }
    }
  }

  /** Die Konstante je rein Neumann'schem Gebiet aus v entfernen. */
  private project(v: Float64Array): void {
    if (this.nullCount === 0) return;
    const L = this.levels[0];
    const n = padded(L.nx, L.ny);
    const id = this.nullId;
    this.nullSum.fill(0, 0, this.nullCount);
    for (let c = 0; c < n; c += 1) if (id[c] >= 0) this.nullSum[id[c]] += v[c];
    for (let k = 0; k < this.nullCount; k += 1) this.nullSum[k] /= this.nullCnt[k];
    for (let c = 0; c < n; c += 1) if (id[c] >= 0) v[c] -= this.nullSum[id[c]];
  }

  /** Wie viele rein Neumann'sche Gebiete das letzte System hatte. */
  nullRegions(): number { return this.nullCount; }

  /**
   * Lösen: A x = b, x als Startwert. `mg`: V-Zyklus als Vorkonditionierer,
   * sonst Jacobi. Danach steht die Lösung in `system.x`.
   */
  solve(tol: number, maxIter: number, mg: boolean): SolveResult {
    const out = this.result;
    const L0 = this.levels[0];
    const n = padded(L0.nx, L0.ny);
    const { act } = L0;
    const x = this.xs;
    const b = this.bs;
    const s = L0.stride;
    for (let c = 0; c < n; c += 1) {
      if (act[c] === 0) { x[c] = 0; b[c] = 0; L0.ax[c] = 0; L0.ay[c] = 0; continue; }
      if (c + 1 >= n || act[c + 1] === 0) L0.ax[c] = 0;
      if (c + s >= n || act[c + s] === 0) L0.ay[c] = 0;
    }
    GridSolver.diagonal(L0);
    this.findNull();
    this.project(b);
    if (mg) { this.prepareFine(); this.coarsen(); }
    /* r liegt in L0.b (der V-Zyklus liest es nur), z in L0.x — beim Jacobi-Verfahren in eigenen Feldern. */
    const r = mg ? L0.b : this.rj;
    const z = mg ? L0.x : this.zj;
    const { p, q } = this;
    /* Die Geisterzellen schreibt apply() nie: ein früheres, grösseres System hätte dort Werte hinterlassen. */
    q.fill(0, 0, n);
    p.fill(0, 0, n);
    z.fill(0, 0, n);
    GridSolver.apply(L0, x, q);
    let bb = 0;
    let rr = 0;
    for (let c = 0; c < n; c += 1) {
      const rc = act[c] === 0 ? 0 : b[c] - q[c];
      r[c] = rc;
      bb += b[c] * b[c];
      rr += rc * rc;
    }
    this.project(r);
    const bnorm = Math.sqrt(bb);
    if (bnorm === 0) {
      x.fill(0, 0, n);
      out.iterations = 0; out.residual = 0; out.capped = false;
      return out;
    }
    let res = Math.sqrt(rr) / bnorm;
    if (res <= tol) { out.iterations = 0; out.residual = res; out.capped = false; return out; }
    this.precondition(mg, r, z, n);
    let rz = 0;
    for (let c = 0; c < n; c += 1) { p[c] = z[c]; rz += r[c] * z[c]; }
    let it = 0;
    while (it < maxIter) {
      it += 1;
      GridSolver.apply(L0, p, q);
      let pq = 0;
      for (let c = 0; c < n; c += 1) pq += p[c] * q[c];
      if (!(pq > 0)) break;
      const alpha = rz / pq;
      rr = 0;
      for (let c = 0; c < n; c += 1) {
        x[c] += alpha * p[c];
        const rc = r[c] - alpha * q[c];
        r[c] = rc;
        rr += rc * rc;
      }
      res = Math.sqrt(rr) / bnorm;
      if (res <= tol) break;
      this.precondition(mg, r, z, n);
      let rz2 = 0;
      for (let c = 0; c < n; c += 1) rz2 += r[c] * z[c];
      const beta = rz2 / rz;
      rz = rz2;
      for (let c = 0; c < n; c += 1) p[c] = z[c] + beta * p[c];
    }
    this.project(x);
    for (let c = 0; c < n; c += 1) if (act[c] === 0) x[c] = 0;
    out.iterations = it;
    out.residual = res;
    out.capped = res > tol;
    return out;
  }

  /** z = M⁻¹ r: ein V-Zyklus (z liegt dann in x der feinsten Stufe) oder Jacobi. */
  private precondition(mg: boolean, r: Float64Array, z: Float64Array, n: number): void {
    if (mg) {
      z.fill(0, 0, n);
      this.vcycle(0);
    } else {
      const inv = this.levels[0].inv;
      for (let c = 0; c < n; c += 1) z[c] = r[c] * inv[c];
    }
    this.project(z);
  }
}
