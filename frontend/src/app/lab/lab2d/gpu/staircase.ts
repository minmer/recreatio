/**
 * LABOR 2D (v2) — KÖRPER AUF DEM BESCHLEUNIGTEN WEG: Treppen aus Zellen
 * (seit 2026-10-23). Die CPU-Engine kennt Körper als genaue Rechtecke mit
 * Anteilen an Zellen und Flächen (bodyCover.ts); die Rechenkerne der GPU
 * kennen nur ganze Zellen. Beim Hochladen wird darum jede Zelle, die ein
 * (angehefteter) Körper zu mehr als der Hälfte bedeckt oder die die CPU
 * geschlossen hat, dort fest; liegt eine Fläche ganz in einem Körper (eine
 * dünne Wand auf der Grenze zweier Zellen) und ist keine ihrer Zellen fest,
 * wird die mit dem grösseren Anteil fest — dicht, ohne die Wand zu verdoppeln: mit dem Werkstoff des Körpers, seiner
 * Temperatur (die Energie aus der Wärmekapazität der ganzen Zelle, wie der
 * Rechenkern rechnet) und seiner Heizgruppe; φ_s, der Abstand zur Wand und das
 * Fluidvolumen der Gebiete gelten für diese Treppe. Das Gas einer Zelle, die
 * erst dort fest wird, bleibt in ihr liegen (die Kerne rechnen feste Zellen
 * nicht; es zu den Nachbarn zu schieben, ohne deren abgeleitete Grössen neu
 * zu rechnen, liess den Druck eines verschlossenen Gebiets davonlaufen).
 *
 * Beim Zurückholen bekommt jede Treppenzelle wieder die Energie des
 * Körperanteils bei ihrer Temperatur, collect gibt die Änderung an die
 * inneren Zellen (wie nach einem Schritt), und Zellen, die die CPU nicht
 * schliesst, erhalten ihre alte Art zurück.
 *
 * In den Szenen der Voreinstellungen liegen Zlewka und Platte bei 1 mm genau
 * auf den Zellen: die Treppe ist dann der Körper selbst.
 */

import { solidEnergy, solidTemperature } from '../engine/body';
import type { Engine } from '../engine/engine';
import { hL, SOLIDS } from '../engine/materials';
import { SOLID, T0 } from '../engine/units';

/** Die Treppe einer Engine (je Zelle), wie die GPU sie bekommt. */
export interface Stair {
  /** 1: Treppenzelle eines Körpers (auf der GPU fest). */
  readonly body: Uint8Array;
  /** Die Art der Zelle auf der CPU beim Hochladen (für das Zurückholen). */
  readonly kindCpu: Uint8Array;
  readonly solid: Uint8Array;
  readonly kind: Uint8Array;
  readonly hgrp: Uint32Array;
  readonly es: Float64Array;
  readonly film: Float64Array;
  /** Temperatur je Zelle (Treppenzellen: die des Körperanteils). */
  readonly T: Float32Array;
  readonly phiS: Float32Array;
  readonly sdf: Float32Array;
  /** Zellen je Heizgruppe. */
  readonly heaterCells: number[];
  /** Je Gebiet der CPU: um so viel ist sein Fluidvolumen auf der GPU kleiner (Treppenzellen, die die CPU nicht schliesst; m³). */
  readonly vFix: Float64Array;
}

/** Die quadratischen B-Spline-Gewichte der Glättung von φ_s (wie grid.ts). */
const K1 = [0.125, 0.75, 0.125];

/** Die Treppe aus dem Zustand der CPU-Engine. */
export function stairOf(e: Engine): Stair {
  const g = e.grid;
  const { n, nx, ny, dx } = g;
  const body = new Uint8Array(n);
  const kindCpu = Uint8Array.from(g.kind);
  const solid = new Uint8Array(n);
  const kind = new Uint8Array(n);
  const hgrp = new Uint32Array(n);
  const es = new Float64Array(n);
  const film = new Float64Array(n);
  const Tc = Float32Array.from(g.T);
  const heaterCells = e.heat.heaters.map(() => 0);
  const vFix = new Float64Array(Math.max(1, e.regions.count));
  const bodies = e.bodies.list;
  /* Welche Zellen fest werden: geschlossen oder mehr als halb bedeckt; dazu je ganz bedeckter Fläche ohne feste Zelle die mit dem grösseren Anteil. */
  const take = new Uint8Array(n);
  for (let c = 0; c < n; c += 1) if (g.owner[c] !== 0 && g.matB[c] !== 0 && (g.solid[c] !== 0 || g.fs[c] > 0.5)) take[c] = 1;
  const pair = (a: number, b: number): void => {
    if (take[a] !== 0 || take[b] !== 0) return;
    const fa = g.owner[a] !== 0 && g.matB[a] !== 0 ? g.fs[a] : -1;
    const fb = g.owner[b] !== 0 && g.matB[b] !== 0 ? g.fs[b] : -1;
    if (fa < 0 && fb < 0) return;
    take[fb > fa ? b : a] = 1;
  };
  for (let j = 0; j < ny; j += 1) for (let i = 1; i < nx; i += 1) if (g.au[i + j * (nx + 1)] <= 0) pair(i - 1 + j * nx, i + j * nx);
  for (let j = 1; j < ny; j += 1) for (let i = 0; i < nx; i += 1) if (g.av[i + j * nx] <= 0) pair(i + (j - 1) * nx, i + j * nx);
  for (let c = 0; c < n; c += 1) {
    solid[c] = g.solid[c];
    kind[c] = g.kind[c];
    hgrp[c] = g.role[c] === 1 && g.heater[c] >= 0 ? g.heater[c] + 1 : 0;
    es[c] = g.Es[c];
    film[c] = g.film[c];
    if (take[c] === 0) continue;
    const own = g.owner[c];
    const closed = g.solid[c] !== 0;
    const b = bodies[own - 1];
    const mat = g.matB[c] - 1;
    const s = SOLIDS[mat];
    body[c] = 1;
    if (!closed) {
      const r = e.regions.id[c];
      if (r >= 0) vFix[r] += (1 - g.fs[c]) * g.vCell;
    }
    solid[c] = mat + 1;
    kind[c] = SOLID;
    /* Die Temperatur des Körperanteils, die Energie aus der ganzen Zelle (so rechnet der Rechenkern). */
    const T = g.Ts[c] > 0 ? g.Ts[c] : solidTemperature(g.Es[c], g.capB[c], g.film[c], g.crust[c], g.T[c]);
    es[c] = s.rho * s.cp * g.vCell * (T - T0) + g.film[c] * hL(T);
    Tc[c] = T;
    if (b !== undefined && b.heater >= 0 && b.heater < heaterCells.length) {
      hgrp[c] = b.heater + 1;
      heaterCells[b.heater] += 1;
    }
  }
  /* Gemalte Heizzellen (Rolle 1) zählen dazu. */
  for (let c = 0; c < n; c += 1) if (body[c] === 0 && hgrp[c] > 0 && hgrp[c] <= heaterCells.length) heaterCells[hgrp[c] - 1] += 1;
  /* φ_s und Abstand für die Treppe (wie grid.updateStatic, mit ganzen Zellen). */
  const share = (i: number, j: number): number => {
    if (i < 0) return g.openL ? 0 : 1;
    if (i >= nx) return g.openR ? 0 : 1;
    if (j < 0) return g.openB ? 0 : 1;
    if (j >= ny) return g.openT ? 0 : 1;
    return solid[i + j * nx] !== 0 ? 1 : 0;
  };
  const phiS = new Float32Array(n);
  const sdf = new Float32Array(n);
  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const c = i + j * nx;
      if (solid[c] !== 0) { phiS[c] = 1; continue; }
      let sum = 0;
      for (let b = -1; b <= 1; b += 1) for (let a = -1; a <= 1; a += 1) sum += K1[a + 1] * K1[b + 1] * share(i + a, j + b);
      phiS[c] = sum;
    }
  }
  const R = 4;
  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const c = i + j * nx;
      const inSolid = solid[c] !== 0;
      const x = (i + 0.5) * dx;
      const y = (j + 0.5) * dx;
      let best = R * dx;
      if (!inSolid) {
        if (!g.openL) best = Math.min(best, x);
        if (!g.openR) best = Math.min(best, g.w - x);
        if (!g.openB) best = Math.min(best, y);
        if (!g.openT) best = Math.min(best, g.h - y);
      }
      for (let b = -R; b <= R; b += 1) {
        const jj = j + b;
        if (jj < 0 || jj >= ny) continue;
        for (let a = -R; a <= R; a += 1) {
          const ii = i + a;
          if (ii < 0 || ii >= nx) continue;
          if ((solid[ii + jj * nx] !== 0) === inSolid) continue;
          const ex = Math.max(0, Math.abs(a) - 0.5) * dx;
          const ey = Math.max(0, Math.abs(b) - 0.5) * dx;
          best = Math.min(best, Math.hypot(ex, ey));
        }
      }
      sdf[c] = inSolid ? -best : best;
    }
  }
  return { body, kindCpu, solid, kind, hgrp, es, film, T: Tc, phiS, sdf, heaterCells, vFix };
}

/**
 * Nach dem Zurückholen: jede Treppenzelle wieder mit der Energie des
 * Körperanteils bei ihrer Temperatur, collect gibt die Änderung an die inneren
 * Zellen; Zellen, die die CPU nicht schliesst, bekommen ihre alte Art zurück.
 */
export function fromStair(e: Engine, stair: Stair | null): void {
  if (stair === null) return;
  const g = e.grid;
  const n = g.n;
  for (let c = 0; c < n; c += 1) {
    if (stair.body[c] === 0) continue;
    const s = SOLIDS[stair.solid[c] - 1];
    const T = solidTemperature(g.Es[c], s.rho * s.cp * g.vCell, g.film[c], 0, g.T[c]);
    g.Es[c] = solidEnergy(g.capB[c], g.film[c], g.crust[c], T);
    if (g.solid[c] === 0) g.kind[c] = stair.kindCpu[c];
  }
  e.bodies.cover.collect(e.bodies.list);
  for (let c = 0; c < n; c += 1) if (stair.body[c] !== 0 && g.capB[c] > 0) e.heat.deriveSolid(c);
}
