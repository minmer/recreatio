/**
 * LABOR 2D (v2) — ENTSPANNUNGSVERDAMPFEN (ARCHITECTURE.md §9, Teil 2 der
 * Grenzflächenstufe): eine Oberflächenzelle über ihrer Siedetemperatur gibt
 * ihre überschüssige fühlbare Wärme als Dampf ab; die Teilchen enden genau bei
 * T_sat (mit Salz bei T_b der Lösung, das Salz bleibt im Teilchen). Ebenso
 * Tröpfchen unter der Zellgrösse in Gaszellen; ein Tropfen, der dabei ganz
 * verdampfte, verschwindet (sein Salz wird Kruste).
 */

import type { Engine } from './engine';
import { hL, hV, WATER } from './materials';
import { MIN_MASS, type Phase } from './phase';
import { hCrystal, hSol, hWaterIn } from './solution';
import { GAS, H2O, LIQUID } from './units';

/** Entspannungsverdampfen (siehe oben). */
export function flashStep(e: Engine, ph: Phase, dt: number): void {
  const { grid: g, particles: P, liquid: L, regions: R, gas, heat } = e;
  const { nx, ny, n, kind } = g;
  const { Tl } = ph;
  /*
   * Oberflächenzellen über T_sat: die Siedetemperatur steht in rd[c] (Arbeitsfeld), sonst 0. Dazu Gaszellen mit
   * Teilchen darin — Tröpfchen unter der Zellgrösse (eine dünne Schicht, ein Spritzer): über T_sat verdampfen auch
   * sie bis T_sat, ihr Dampf bleibt in ihrer Zelle (ohne das heizte eine heisse Platte sie weit über den Siedepunkt).
   */
  const ts = ph.rd;
  let any = false;
  for (let c = 0; c < n; c += 1) {
    ts[c] = 0;
    if (kind[c] === GAS && ph.Cl[c] > 0) {
      const Tsat = ph.boilingAt(c, R.pAt(c));
      if (Tl[c] > Tsat) { ts[c] = Tsat; any = true; }
      continue;
    }
    if (kind[c] !== LIQUID) continue;
    const i = c % nx;
    const j = (c - i) / nx;
    const up = j + 1 < ny ? c + nx : -1;
    /* Nur durch offene Flächen: hinter einer dünnen Wand eines Körpers liegt keine Oberfläche. */
    const surface = (up >= 0 && kind[up] === GAS && g.faceOpen(c, 3) > 0) || (i > 0 && kind[c - 1] === GAS && g.faceOpen(c, 0) > 0)
      || (i < nx - 1 && kind[c + 1] === GAS && g.faceOpen(c, 1) > 0) || (j > 0 && kind[c - nx] === GAS && g.faceOpen(c, 2) > 0);
    if (!surface) continue;
    const Tsat = ph.boilingAt(c, R.pAt(c));
    if (Tl[c] > Tsat) { ts[c] = Tsat; any = true; }
  }
  if (!any) return;
  const vap = ph.mtot;
  vap.fill(0);
  const vapH = ph.Y0;
  vapH.fill(0);
  const nominal = (L.rhoRef * g.vCell) / 4;
  for (let p = 0; p < P.count; p += 1) {
    /* Nur Wasser hat eine Siedelinie (mit Salz: die der Lösung, ts ist dann T_b; das Salz bleibt im Teilchen). */
    if (P.mat[p] !== WATER) continue;
    const s = P.smass[2 * p];
    const ws = s > 0 ? s / P.mass[p] : 0;
    const o = 9 * p;
    let lost = 0;
    let lostE = 0;
    let main = -1;
    let mainW = 0;
    for (let pass = 0; pass < 2; pass += 1) {
      for (let k = 0; k < 9; k += 1) {
        const w = L.wt[o + k];
        if (w === 0) continue;
        const i = L.bi[p] + (k % 3);
        const j = L.bj[p] + ((k / 3) | 0);
        if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
        const c = i + j * nx;
        const Tsat = ts[c];
        if (Tsat === 0) continue;
        const hs = s > 0 ? hSol(Tsat, ws) : hL(Tsat);
        if (P.h[p] <= hs) continue;
        const hv = hV(Tsat);
        const dmv = (w * P.mass[p] * (P.h[p] - hs)) / (hv - (s > 0 ? hWaterIn(Tsat, ws) : hs));
        if (pass === 0) {
          lost += dmv;
          lostE += dmv * hv;
          if (w > mainW) { mainW = w; main = c; }
        } else {
          vap[c] += dmv;
          vapH[c] += dmv * hv;
        }
      }
      if (lost === 0) break;
      if (pass === 0 && P.mass[p] - s - lost < MIN_MASS * nominal) {
        /*
         * Ein kleiner Tropfen (eine heisse Platte heizt die letzten Reste schnell) verdampfte ganz: alles Wasser wird
         * Dampf bei T_sat seiner Hauptzelle, das Salz Kruste; was die Energie des Teilchens darüber hinaus hatte oder
         * zu wenig hatte, gibt oder nimmt die Zelle als Wärme.
         */
        const Tm = ts[main];
        const mw = P.mass[p] - s;
        const hv = hV(Tm);
        const Hs = s > 0 ? s * hCrystal(Tm) : 0;
        vap[main] += mw;
        vapH[main] += mw * hv;
        if (s > 0) e.salt.deposit(P.x[p], P.y[p], s, Hs);
        heat.src[main] -= (mw * hv + Hs - P.mass[p] * P.h[p]) / dt;
        lost = -1;
        break;
      }
    }
    if (lost === 0) continue;
    if (lost < 0) { L.removeParticle(p); p -= 1; continue; }
    const before = P.mass[p] / P.rho[p];
    const m = P.mass[p] - lost;
    P.h[p] = (P.mass[p] * P.h[p] - lostE) / m;
    P.mass[p] = m;
    P.derive(p);
    L.dVp[p] += m / P.rho[p] - before;
  }
  /* Der Dampf geht in die Gasnachbarn der Oberflächenzelle (bevorzugt nach oben). */
  for (let c = 0; c < n; c += 1) {
    if (vap[c] === 0) continue;
    const i = c % nx;
    const j = (c - i) / nx;
    let targets = 0;
    const up = kind[c] === GAS ? c : j + 1 < ny && kind[c + nx] === GAS && g.faceOpen(c, 3) > 0 ? c + nx : -1;
    if (up >= 0) {
      g.mg[H2O * n + up] += vap[c];
      g.Hg[up] += vapH[c];
      gas.deriveCell(up);
    } else {
      const nbs = ph.side;
      nbs[0] = i > 0 && kind[c - 1] === GAS && g.faceOpen(c, 0) > 0 ? c - 1 : -1;
      nbs[1] = i < nx - 1 && kind[c + 1] === GAS && g.faceOpen(c, 1) > 0 ? c + 1 : -1;
      nbs[2] = j > 0 && kind[c - nx] === GAS && g.faceOpen(c, 2) > 0 ? c - nx : -1;
      nbs[3] = -1;
      for (let k = 0; k < 3; k += 1) if (nbs[k] >= 0) targets += 1;
      for (let k = 0; k < 3; k += 1) {
        if (nbs[k] < 0) continue;
        g.mg[H2O * n + nbs[k]] += vap[c] / targets;
        g.Hg[nbs[k]] += vapH[c] / targets;
        gas.deriveCell(nbs[k]);
      }
    }
    ph.produced += vap[c];
  }
}
