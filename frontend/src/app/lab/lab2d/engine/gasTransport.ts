/**
 * LABOR 2D (v2) — DER TRANSPORT DES GASES IN FLUSSFORM (ARCHITECTURE.md §6.1):
 * Massen der Gasarten, Nebel und Enthalpie wandern zwischen Gaszellen und durch
 * offene Seiten, MUSCL mit van-Leer-Begrenzer, in Teilschritten. Was eine Zelle
 * abgibt, bekommt die andere genau (Float64); was eine offene Seite verlässt,
 * ist „entwichen“. Gehört zum Gas (gas.ts), das die Felder, die Gasflächen und
 * die Umgebungsluft hält.
 */

import type { Gas } from './gas';
import type { Grid } from './grid';
import { GAS, GAS_SPECIES } from './units';

/** Transportierte Grössen je Zelle: die Gasarten, der Nebel, die Enthalpie. */
export const Q = GAS_SPECIES + 2;
export const QF = GAS_SPECIES;
export const QH = GAS_SPECIES + 1;
/** Courant-Zahl je Teilschritt (Ausfluss einer Zelle je Teilschritt höchstens dieser Anteil). */
const CFL = 0.9;
const MAX_SUB = 16;

export class GasTransport {
  private readonly g: Grid;
  private readonly gas: Gas;
  /** Konzentrationen (je Volumen) der Grössen, Flüsse durch die u- und v-Flächen, Ausfluss und Kürzung je Zelle. */
  private readonly conc: Float64Array;
  private readonly fu: Float64Array;
  private readonly fv: Float64Array;
  private readonly outM: Float64Array;
  private readonly scale: Float64Array;

  constructor(grid: Grid, gas: Gas) {
    this.g = grid;
    this.gas = gas;
    const n = grid.n;
    this.conc = new Float64Array(Q * n);
    this.fu = new Float64Array(Q * grid.nu);
    this.fv = new Float64Array(Q * grid.nv);
    this.outM = new Float64Array(n);
    this.scale = new Float64Array(n);
  }

  /**
   * Flussform-Transport aller Grössen mit den Gasgeschwindigkeiten. Teilschritte
   * aus dem grössten Ausfluss einer Zelle, gemessen an der ganzen Zelle: Σ
   * ausströmender Flächengeschwindigkeiten · h/Δx ≤ 0,9 (Prompt v2: Courant-Zahl
   * höchstens 1 aus der Gasgeschwindigkeit). Zellen, die nur zum Teil Gas sind
   * (an der Wasseroberfläche), schützt die Ausflussgrenze: nie mehr als 0,9 ihres
   * Inhalts je Teilschritt (limitOutflow) — was die Geschwindigkeit dann mehr
   * verlangt, gleicht die Volumenkorrektur von S_g im nächsten Schritt aus.
   */
  transport(dt: number): number {
    const g = this.g;
    const { nx, ny, n, kind, dx } = g;
    const nxu = nx + 1;
    const ug = g.ug;
    const vg = g.vg;
    let maxOut = 0;
    let umax = 0;
    for (let j = 0; j < ny; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        const c = i + j * nx;
        if (kind[c] !== GAS) continue;
        const fl = i + j * nxu;
        const a = ug[fl];
        const b = ug[fl + 1];
        const d = vg[c];
        const t = vg[c + nx];
        const out = (a < 0 ? -a : 0) + (b > 0 ? b : 0) + (d < 0 ? -d : 0) + (t > 0 ? t : 0);
        if (out > maxOut) maxOut = out;
        const s = Math.max(a < 0 ? -a : a, b < 0 ? -b : b, d < 0 ? -d : d, t < 0 ? -t : t);
        if (s > umax) umax = s;
      }
    }
    this.gas.last.uMax = umax;
    const sub = Math.min(MAX_SUB, Math.max(1, Math.ceil((maxOut * dt) / dx / CFL)));
    const h = dt / sub;
    const { conc } = this;
    const vgas = this.gas.vgas;
    const mg = g.mg;
    const mf = g.mfog;
    const Hg = g.Hg;
    for (let s = 0; s < sub; s += 1) {
      /* Konzentrationen (je Volumen) der Gaszellen. */
      for (let c = 0; c < n; c += 1) {
        if (kind[c] !== GAS) {
          for (let q = 0; q < Q; q += 1) conc[q * n + c] = 0;
          continue;
        }
        const iv = 1 / vgas[c];
        for (let k = 0; k < GAS_SPECIES; k += 1) conc[k * n + c] = mg[k * n + c] * iv;
        conc[QF * n + c] = mf[c] * iv;
        conc[QH * n + c] = Hg[c] * iv;
      }
      this.fluxesU(h);
      this.fluxesV(h);
      /* Ausfluss höchstens der Inhalt (gemeinsamer Faktor je Spenderzelle). */
      this.limitOutflow();
      this.applyFluxes();
    }
    for (let c = 0; c < n; c += 1) if (kind[c] === GAS) this.gas.deriveCell(c);
    this.gas.last.substeps = sub;
    return sub;
  }

  /** Der Wert auf der Fläche: Spenderzelle plus begrenzter Anstieg (MUSCL, van Leer); ohne Zelle stromauf nur der Spender. */
  private static face(cd: number, cu: number, cw: number): number {
    const d1 = cd - cu;
    const d2 = cw - cd;
    return d1 * d2 > 0 ? cd + (d1 * d2) / (d1 + d2) : cd;
  }

  /** Flüsse durch die u-Flächen (je Grösse, Teilschritt h). */
  private fluxesU(h: number): void {
    const g = this.g;
    const { nx, ny, n, kind } = g;
    const nxu = nx + 1;
    const nu = g.nu;
    const ug = g.ug;
    const { conc, fu } = this;
    const { amb, gasU } = this.gas;
    const A = g.aFace;
    const face = GasTransport.face;
    for (let j = 0; j < ny; j += 1) {
      const row = j * nx;
      const frow = j * nxu;
      for (let i = 0; i <= nx; i += 1) {
        const f = frow + i;
        const u = ug[f];
        if (gasU[f] === 0 || u === 0) {
          for (let q = 0; q < Q; q += 1) fu[q * nu + f] = 0;
          continue;
        }
        /* Durch den offenen Teil der Fläche (ein Körper bedeckt den Rest). */
        const vol = g.au[f] < 1 ? u * A * h * g.au[f] : u * A * h;
        if (i === 0 || i === nx) {
          /* Offene Seite: Zufluss bringt Umgebungsluft, Abfluss trägt die Zelle hinaus. */
          const c = i === 0 ? row : row + nx - 1;
          const inflow = i === 0 ? u > 0 : u < 0;
          for (let q = 0; q < Q; q += 1) fu[q * nu + f] = vol * (inflow ? amb[q] : conc[q * n + c]);
          continue;
        }
        let donor: number;
        let down: number;
        let up: number;
        if (u > 0) { donor = row + i - 1; down = row + i; up = i >= 2 && kind[row + i - 2] === GAS ? row + i - 2 : -1; }
        else { donor = row + i; down = row + i - 1; up = i + 1 < nx && kind[row + i + 1] === GAS ? row + i + 1 : -1; }
        if (up < 0) {
          for (let q = 0; q < Q; q += 1) fu[q * nu + f] = vol * conc[q * n + donor];
          continue;
        }
        for (let q = 0; q < Q; q += 1) {
          const o = q * n;
          fu[q * nu + f] = vol * face(conc[o + donor], conc[o + up], conc[o + down]);
        }
      }
    }
  }

  /** Flüsse durch die v-Flächen (je Grösse, Teilschritt h). */
  private fluxesV(h: number): void {
    const g = this.g;
    const { nx, ny, n, kind } = g;
    const nv = g.nv;
    const vg = g.vg;
    const { conc, fv } = this;
    const { amb, gasV } = this.gas;
    const A = g.aFace;
    const face = GasTransport.face;
    for (let j = 0; j <= ny; j += 1) {
      const row = j * nx;
      for (let i = 0; i < nx; i += 1) {
        const f = row + i;
        const v = vg[f];
        if (gasV[f] === 0 || v === 0) {
          for (let q = 0; q < Q; q += 1) fv[q * nv + f] = 0;
          continue;
        }
        const vol = g.av[f] < 1 ? v * A * h * g.av[f] : v * A * h;
        if (j === 0 || j === ny) {
          const c = j === 0 ? i : i + (ny - 1) * nx;
          const inflow = j === 0 ? v > 0 : v < 0;
          for (let q = 0; q < Q; q += 1) fv[q * nv + f] = vol * (inflow ? amb[q] : conc[q * n + c]);
          continue;
        }
        let donor: number;
        let down: number;
        let up: number;
        if (v > 0) { donor = f - nx; down = f; up = j >= 2 && kind[f - 2 * nx] === GAS ? f - 2 * nx : -1; }
        else { donor = f; down = f - nx; up = j + 1 < ny && kind[f + nx] === GAS ? f + nx : -1; }
        if (up < 0) {
          for (let q = 0; q < Q; q += 1) fv[q * nv + f] = vol * conc[q * n + donor];
          continue;
        }
        for (let q = 0; q < Q; q += 1) {
          const o = q * n;
          fv[q * nv + f] = vol * face(conc[o + donor], conc[o + up], conc[o + down]);
        }
      }
    }
  }

  /** Die Flüsse anwenden: was eine Zelle abgibt, bekommt die andere (genau); durch offene Seiten ins „Entwichene“. */
  private applyFluxes(): void {
    const g = this.g;
    const { nx, ny, n } = g;
    const nxu = nx + 1;
    const nu = g.nu;
    const nv = g.nv;
    const { fu, fv } = this;
    const { gasU, gasV, escaped } = this.gas;
    const mg = g.mg;
    const mf = g.mfog;
    const Hg = g.Hg;
    for (let j = 0; j < ny; j += 1) {
      const row = j * nx;
      const frow = j * nxu;
      for (let i = 1; i < nx; i += 1) {
        const f = frow + i;
        if (gasU[f] === 0) continue;
        const L = row + i - 1;
        const R = L + 1;
        for (let k = 0; k < GAS_SPECIES; k += 1) {
          const F = fu[k * nu + f];
          mg[k * n + L] -= F;
          mg[k * n + R] += F;
        }
        const Ff = fu[QF * nu + f];
        mf[L] -= Ff;
        mf[R] += Ff;
        const FH = fu[QH * nu + f];
        Hg[L] -= FH;
        Hg[R] += FH;
      }
      /* Offene Seiten links (Fluss > 0: herein) und rechts (Fluss > 0: hinaus). */
      if (gasU[frow] !== 0) {
        const c = row;
        for (let k = 0; k < GAS_SPECIES; k += 1) { const F = fu[k * nu + frow]; mg[k * n + c] += F; escaped[k] -= F; }
        const Ff = fu[QF * nu + frow]; mf[c] += Ff; escaped[QF] -= Ff;
        const FH = fu[QH * nu + frow]; Hg[c] += FH; escaped[QH] -= FH;
      }
      const fr = frow + nx;
      if (gasU[fr] !== 0) {
        const c = row + nx - 1;
        for (let k = 0; k < GAS_SPECIES; k += 1) { const F = fu[k * nu + fr]; mg[k * n + c] -= F; escaped[k] += F; }
        const Ff = fu[QF * nu + fr]; mf[c] -= Ff; escaped[QF] += Ff;
        const FH = fu[QH * nu + fr]; Hg[c] -= FH; escaped[QH] += FH;
      }
    }
    for (let j = 1; j < ny; j += 1) {
      const row = j * nx;
      for (let i = 0; i < nx; i += 1) {
        const f = row + i;
        if (gasV[f] === 0) continue;
        const B = f - nx;
        const T = f;
        for (let k = 0; k < GAS_SPECIES; k += 1) {
          const F = fv[k * nv + f];
          mg[k * n + B] -= F;
          mg[k * n + T] += F;
        }
        const Ff = fv[QF * nv + f];
        mf[B] -= Ff;
        mf[T] += Ff;
        const FH = fv[QH * nv + f];
        Hg[B] -= FH;
        Hg[T] += FH;
      }
    }
    /* Offene Seiten unten (Fluss > 0: herein) und oben (Fluss > 0: hinaus). */
    for (let i = 0; i < nx; i += 1) {
      if (gasV[i] !== 0) {
        const c = i;
        for (let k = 0; k < GAS_SPECIES; k += 1) { const F = fv[k * nv + i]; mg[k * n + c] += F; escaped[k] -= F; }
        const Ff = fv[QF * nv + i]; mf[c] += Ff; escaped[QF] -= Ff;
        const FH = fv[QH * nv + i]; Hg[c] += FH; escaped[QH] -= FH;
      }
      const ft = i + ny * nx;
      if (gasV[ft] !== 0) {
        const c = i + (ny - 1) * nx;
        for (let k = 0; k < GAS_SPECIES; k += 1) { const F = fv[k * nv + ft]; mg[k * n + c] -= F; escaped[k] += F; }
        const Ff = fv[QF * nv + ft]; mf[c] -= Ff; escaped[QF] += Ff;
        const FH = fv[QH * nv + ft]; Hg[c] -= FH; escaped[QH] += FH;
      }
    }
  }

  /** Flüsse, die aus einer Zelle mehr Masse holen würden, als sie hat, verkleinern (alle Grössen mit demselben Faktor). */
  private limitOutflow(): void {
    const g = this.g;
    const { nx, ny, n } = g;
    const nxu = nx + 1;
    const { fu, fv, outM, scale } = this;
    const nu = g.nu;
    const nv = g.nv;
    outM.fill(0);
    const massFlux = GasTransport.massFlux;
    const { gasU, gasV } = this.gas;
    for (let j = 0; j < ny; j += 1) for (let i = 0; i <= nx; i += 1) {
      const f = i + j * nxu;
      if (gasU[f] === 0) continue;
      const m = massFlux(fu, nu, f);
      if (m > 0 && i > 0) outM[i - 1 + j * nx] += m;
      else if (m < 0 && i < nx) outM[i + j * nx] -= m;
    }
    for (let j = 0; j <= ny; j += 1) for (let i = 0; i < nx; i += 1) {
      const f = i + j * nx;
      if (gasV[f] === 0) continue;
      const m = massFlux(fv, nv, f);
      if (m > 0 && j > 0) outM[i + (j - 1) * nx] += m;
      else if (m < 0 && j < ny) outM[i + j * nx] -= m;
    }
    let any = false;
    for (let c = 0; c < n; c += 1) {
      const have = 0.9 * this.gas.massOf(c);
      scale[c] = outM[c] > have && outM[c] > 0 ? have / outM[c] : 1;
      if (scale[c] < 1) any = true;
    }
    if (!any) return;
    for (let j = 0; j < ny; j += 1) for (let i = 0; i <= nx; i += 1) {
      const f = i + j * nxu;
      if (gasU[f] === 0) continue;
      const m = massFlux(fu, nu, f);
      const donor = m > 0 ? (i > 0 ? i - 1 + j * nx : -1) : i < nx ? i + j * nx : -1;
      if (donor < 0 || scale[donor] >= 1) continue;
      for (let q = 0; q < Q; q += 1) fu[q * nu + f] *= scale[donor];
    }
    for (let j = 0; j <= ny; j += 1) for (let i = 0; i < nx; i += 1) {
      const f = i + j * nx;
      if (gasV[f] === 0) continue;
      const m = massFlux(fv, nv, f);
      const donor = m > 0 ? (j > 0 ? i + (j - 1) * nx : -1) : j < ny ? i + j * nx : -1;
      if (donor < 0 || scale[donor] >= 1) continue;
      for (let q = 0; q < Q; q += 1) fv[q * nv + f] *= scale[donor];
    }
  }

  /** Massenfluss (alle Arten und Nebel) einer Fläche. */
  private static massFlux(arr: Float64Array, stride: number, f: number): number {
    let m = 0;
    for (let q = 0; q <= QF; q += 1) m += arr[q * stride + f];
    return m;
  }
}
