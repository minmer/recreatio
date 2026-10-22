/**
 * LABOR 2D (v2) — MEHRERE FLÜSSIGKEITEN IN EINEM STRÖMUNGSFELD (M2a): die
 * Zähigkeit als impliziter Schritt je Geschwindigkeitskomponente und die
 * Drift unaufgelöster Tröpfchen. Beides läuft nur, wenn eine andere
 * Flüssigkeit als Wasser in der Szene ist (liquid.ts entscheidet).
 */

import type { Grid } from './grid';
import { LIQUIDS, muLiq, rhoLiq, WATER } from './materials';
import type { Particles } from './particles';
import type { GridSolver } from './solver';

/**
 * Zähigkeit (M2a), implizit je Komponente mit der konstanten Dichte der
 * Projektion:
 *
 *   ρ_ref Δx²/Δt (u* − u) = Σ_Nachbarn η_f (u_nb − u*)
 *
 * (je Flächen-Kontrollvolumen Δx × Δx der Tiefe D, geteilt durch D). η_f
 * zwischen zwei Flächen: harmonisches Mittel ihrer massengewichteten
 * Zähigkeit (etaU/etaV kommen als Σ w m η und werden hier durch die Masse
 * geteilt). Ränder: an Wänden und Feststoffen haftet die Flüssigkeit (u = 0;
 * quer zur Wand im halben Abstand: 2η), an der freien Oberfläche und zu
 * leeren Flächen keine Spannung. Die vereinfachte Form ∇·(η∇u) ohne die
 * Glieder ∇·(η (∇u)ᵀ) (SIMPLIFICATIONS.md). SPD, CG mit Jacobi. Liefert die
 * Iterationen beider Lösungen.
 */
export function solveViscosity(
  g: Grid, S: GridSolver, etaU: Float64Array, etaV: Float64Array, mu: Float64Array, mv: Float64Array,
  knownU: Uint8Array, knownV: Uint8Array, rhoRef: number, empty: number, dt: number
): number {
  const { nx, ny, dx } = g;
  for (let f = 0; f < g.nu; f += 1) etaU[f] = mu[f] > empty ? etaU[f] / mu[f] : 0;
  for (let f = 0; f < g.nv; f += 1) etaV[f] = mv[f] > empty ? etaV[f] / mv[f] : 0;
  const dH = (rhoRef * dx * dx) / dt;
  const hm = (a: number, b: number): number => (a + b > 0 ? (2 * a * b) / (a + b) : 0);
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
  return its;
}

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
 * Auftrieb (SIMPLIFICATIONS.md). Mit Salz (M2b) ist die umgebende Sole so
 * dicht wie ihre Teilchen im Mittel.
 */
export class DropletDrift {
  /** Je Zelle die Masse jeder Flüssigkeit (bei Bedarf angelegt), die vorherrschende und mit Salz das Volumen des Wassers. */
  private cellMat: Float64Array | null = null;
  private cellHost: Uint8Array | null = null;
  private cellVolW: Float64Array | null = null;

  /** Die Drift je Teilchen in drift (m in y), 0 für die anderen; liefert, ob es eine gibt. */
  compute(P: Particles, g: Grid, dt: number, gy: number, drift: Float64Array): boolean {
    const { nx, ny, n } = g;
    const NL = LIQUIDS.length;
    if (this.cellMat === null || this.cellHost === null) { this.cellMat = new Float64Array(n * NL); this.cellHost = new Uint8Array(n); }
    const cm = this.cellMat;
    const host = this.cellHost;
    cm.fill(0);
    let salty = false;
    for (let p = 0; p < P.count; p += 1) {
      const i = Math.min(nx - 1, Math.max(0, Math.floor(P.x[p] / g.dx)));
      const j = Math.min(ny - 1, Math.max(0, Math.floor(P.y[p] / g.dx)));
      cm[(i + j * nx) * NL + P.mat[p]] += P.mass[p];
      if (P.smass[2 * p] > 0) salty = true;
    }
    if (salty) {
      if (this.cellVolW === null) this.cellVolW = new Float64Array(n);
      const cv = this.cellVolW;
      cv.fill(0);
      for (let p = 0; p < P.count; p += 1) {
        if (P.mat[p] !== WATER) continue;
        const i = Math.min(nx - 1, Math.max(0, Math.floor(P.x[p] / g.dx)));
        const j = Math.min(ny - 1, Math.max(0, Math.floor(P.y[p] / g.dx)));
        cv[i + j * nx] += P.mass[p] / P.rho[p];
      }
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
      const cw = this.cellVolW;
      const ci = i + j * nx;
      const rc = salty && hc === WATER && cw !== null && cw[ci] > 0 ? cm[ci * NL] / cw[ci] : rhoLiq(hc, T);
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
}
