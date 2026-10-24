/**
 * LABOR 2D (v2) — M3c: Körner (Kochsalz). Tore aus SANDBOX.md §13: die
 * Sinkgeschwindigkeit (Ferguson & Church), das Lösen gegen den Stoffübergang,
 * die Abkühlung aus der Lösungswärme, Salz genau über Lösen und Wachsen; dazu
 * Keime an Körnern in überhitztem Wasser und der Handgriff „grains“ im JSON.
 * Der Schüttwinkel (Test 49) steht in m3c.slow.test.ts.
 */

import { describe, expect, it } from 'vitest';

import { Engine } from '../engine/engine';
import { gridVelocityAt } from '../engine/extend';
import { settlingVelocity } from '../engine/grainFlow';
import { hL, muL, rhoL } from '../engine/materials';
import { readScene, writeScene } from '../engine/scene';
import { hCrystal, hSol, RHO_CRYSTAL, saltDiffusivity, satFraction } from '../engine/solution';
import { LIQUID } from '../engine/units';
import { scene } from './scenes';

const sealed = { left: 'wall', right: 'wall', bottom: 'wall', top: 'wall' } as const;
const T20 = 293.15;

/** Ein einzelnes Korn des Durchmessers d (ein echtes Korn) bei (x, y), gebucht. */
function oneGrain(e: Engine, x: number, y: number, d: number, T = T20): number {
  const m = (RHO_CRYSTAL * Math.PI * d ** 3) / 6;
  e.grains.add(x, y, m, 1, T, 0);
  e.ledger.salt += m;
  e.ledger.energy += m * hCrystal(T);
  return m;
}

/** Wasser ohne Schwerkraft (harness) in einer verschlossenen, isolierten Kiste, 2 cm hoch. */
function stillWater(T: number, composition: Record<string, number> = { H2O: 1 }): Engine {
  return new Engine(scene({ box: { w: 0.03, h: 0.03, depth: 0.01 }, ambient: { p: 101.325, T: T - 273.15, rh: 1, g: 0 }, sides: sealed, ops: [
    { op: 'fill', region: { rect: [0, 0, 0.03, 0.02] }, composition, phase: 'liquid', T: T - 273.15 }] }), { harness: true, insulated: true });
}

describe('M3c — the grains operation', () => {
  it('fills a region loosely (four grains per cell at the packing fraction), keeps grains through JSON, books the salt; scenes with grains run on the CPU', () => {
    const json = scene({ box: { w: 0.04, h: 0.04, depth: 0.01 }, ops: [{ op: 'grains', region: { rect: [0.01, 0, 0.03, 0.01] }, material: 'NaCl', d: 0.0004, T: 20 }] });
    const e = new Engine(json);
    const G = e.grains;
    const cells = (0.02 / e.grid.dx) * (0.01 / e.grid.dx);
    expect(G.count).toBe(4 * cells);
    expect(Math.abs(G.diameter(0) - 0.0004)).toBeLessThan(1e-12);
    expect(Math.abs(e.measureBudget().salt.grains - G.totals().salt)).toBe(0);
    expect(Math.abs(e.saltError())).toBeLessThan(1e-15);
    expect(e.needsCpu()).toBe(true);
    const again = readScene(writeScene(readScene(json).scene)).scene;
    const op = again.ops[0];
    expect(op.op === 'grains' && op.material === 'NaCl' && Math.abs(op.d - 0.0004) < 1e-12).toBe(true);
  });
});

describe('M3c — test 50: a grain settles at the Ferguson–Church velocity', () => {
  it('a 0.5 mm salt grain in saturated brine (it hardly dissolves or grows) sinks relative to the brine at w (±10 %)', () => {
    const ws = satFraction(T20);
    const e = new Engine(scene({ box: { w: 0.04, h: 0.12, depth: 0.01 }, ambient: { p: 101.325, T: 20, rh: 0.75, g: 9.81 }, sides: { left: 'wall', right: 'wall', bottom: 'wall', top: 'open' }, ops: [
      { op: 'fill', region: { rect: [0, 0, 0.04, 0.10] }, composition: { H2O: 1 - ws, NaCl: ws }, phase: 'liquid', T: 20 }] }));
    const d = 5e-4;
    const m = oneGrain(e, 0.02, 0.09, d);
    const G = e.grains;
    const vel = new Float64Array(2);
    let sum = 0, n = 0;
    while (e.time < 1.2 && G.y[0] > 0.015) {
      e.step();
      if (e.time > 0.2) { gridVelocityAt(e.grid, G.x[0], G.y[0], vel); sum += vel[1] - G.vy[0]; n += 1; }
    }
    const slip = sum / n;
    const w = settlingVelocity(d, RHO_CRYSTAL, e.liquid.rhoRef, muL(T20), 9.81);
    console.log(`test 50: slip ${(slip * 1000).toFixed(2)} mm/s over ${n} steps, Ferguson–Church ${(w * 1000).toFixed(2)} mm/s (${(100 * (slip / w - 1)).toFixed(2)} %), the grain kept ${(G.m[0] / m).toFixed(6)} of its mass`);
    expect(Math.abs(slip / w - 1)).toBeLessThan(0.1);
    /* Gesättigte Sole: das Korn löst sich nicht (ein Hauch Übersättigung lässt es kaum wachsen). */
    expect(Math.abs(G.m[0] / m - 1)).toBeLessThan(1e-3);
  });
});

describe('M3c — test 51: a grain dissolves at its mass-transfer rate', () => {
  it('a 0.2 mm grain in still fresh water (no gravity: Sh = 2) is gone after d0²/(2K), K = 4 D ρ ln(1 + B)/ρ_s (±20 %); salt and energy exact', () => {
    const e = stillWater(T20);
    const d0 = 2e-4;
    const m0 = oneGrain(e, 0.015, 0.01, d0);
    const ws = satFraction(T20);
    const K = (4 * saltDiffusivity(T20) * rhoL(T20) * Math.log(1 + ws / (1 - ws))) / RHO_CRYSTAL;
    const want = (d0 * d0) / (2 * K);
    while (e.grains.count > 0 && e.time < 2 * want) e.step();
    console.log(`test 51: gone after ${e.time.toFixed(2)} s, d0²/(2K) ${want.toFixed(2)} s (${(100 * (e.time / want - 1)).toFixed(1)} %); salt error ${e.saltError().toExponential(2)} kg of ${m0.toExponential(2)}, energy error ${e.energyError().toExponential(2)} J`);
    expect(e.grains.count).toBe(0);
    expect(Math.abs(e.time / want - 1)).toBeLessThan(0.2);
    expect(Math.abs(e.saltError())).toBeLessThan(1e-12 * m0);
    expect(Math.abs(e.energyError())).toBeLessThan(1e-6);
  });
});

describe('M3c — test 52: dissolving salt cools the water', () => {
  it('2.4 % fine salt spread through water at 20 °C: once dissolved the solution is as much colder as its enthalpy says (±5 %), energy exact', () => {
    const e = stillWater(T20);
    const g = e.grid;
    const P = e.particles;
    let mw = 0;
    for (let p = 0; p < P.count; p += 1) mw += P.mass[p];
    const cells: number[] = [];
    for (let c = 0; c < g.n; c += 1) if (g.kind[c] === LIQUID) cells.push(c);
    const ms = 0.024 * mw;
    const d = 1e-4;
    const each = ms / cells.length;
    for (const c of cells) {
      const i = c % g.nx;
      const j = (c - i) / g.nx;
      e.grains.add((i + 0.5) * g.dx, (j + 0.5) * g.dx, each, each / ((RHO_CRYSTAL * Math.PI * d ** 3) / 6), T20, 0);
    }
    e.ledger.salt += ms;
    e.ledger.energy += ms * hCrystal(T20);
    const air = e.measureBudget().air;
    while (e.grains.count > 0 && e.time < 60) e.step();
    let MT = 0, M = 0;
    for (let p = 0; p < P.count; p += 1) { MT += P.mass[p] * P.T[p]; M += P.mass[p]; }
    const dT = MT / M - T20;
    /* Erwartet: (m_w + m_s) h_sol(T, w) + C_Luft (T − T_i) = m_w h_l(T_i) + m_s h_Kristall(T_i). */
    const w = ms / (mw + ms);
    let T = T20;
    for (let it = 0; it < 50; it += 1) {
      const f = (mw + ms) * hSol(T, w) + air * 1005 * (T - T20) - (mw * hL(T20) + ms * hCrystal(T20));
      const df = ((mw + ms) * (hSol(T + 1e-3, w) - hSol(T - 1e-3, w))) / 2e-3 + air * 1005;
      T -= f / df;
    }
    console.log(`test 52: dissolved in ${e.time.toFixed(2)} s, ΔT ${dT.toFixed(4)} K, from the enthalpy ${(T - T20).toFixed(4)} K (${(100 * (dT / (T - T20) - 1)).toFixed(1)} %); salt error ${e.saltError().toExponential(2)} kg, energy error ${e.energyError().toExponential(2)} J`);
    expect(e.grains.count).toBe(0);
    expect(dT).toBeLessThan(0);
    expect(Math.abs(dT / (T - T20) - 1)).toBeLessThan(0.05);
    expect(Math.abs(e.saltError())).toBeLessThan(1e-12 * ms);
    expect(Math.abs(e.energyError())).toBeLessThan(1e-6);
  });
});

describe('M3c — test 53: salt stays exact through dissolving and growing', () => {
  it('saturated brine with grains: warmed they dissolve, cooled they grow again (no crust while grains are near); salt exact, energy closes', () => {
    const Ti = 313.15;
    const ws = satFraction(Ti);
    const e = stillWater(Ti, { H2O: 1 - ws, NaCl: ws });
    const g = e.grid;
    const d = 2e-4;
    for (let c = 0; c < g.n; c += 1) {
      if (g.kind[c] !== LIQUID) continue;
      const i = c % g.nx;
      const j = (c - i) / g.nx;
      const m = 2e-7;
      e.grains.add((i + 0.5) * g.dx, (j + 0.5) * g.dx, m, m / ((RHO_CRYSTAL * Math.PI * d ** 3) / 6), Ti, 0);
      e.ledger.salt += m;
      e.ledger.energy += m * hCrystal(Ti);
    }
    const s0 = e.grains.totals().salt;
    const salt0 = e.measureBudget().salt.total;
    e.heat.liquidPower = 4;
    while (e.time < 5) e.step();
    const warm = e.grains.totals().salt;
    e.heat.liquidPower = -4;
    while (e.time < 15) e.step();
    const b = e.measureBudget();
    console.log(`test 53: grains ${(s0 * 1e6).toFixed(3)} → ${(warm * 1e6).toFixed(3)} mg warmed (dissolved ${(e.grainSalt.dissolved * 1e6).toFixed(3)} mg) → ${(b.salt.grains * 1e6).toFixed(3)} mg cooled (grown ${(e.grainSalt.grown * 1e6).toFixed(3)} mg), crust ${b.salt.crust.toExponential(2)} kg; salt error ${e.saltError().toExponential(2)} kg of ${salt0.toExponential(2)}, energy error ${e.energyError().toExponential(2)} J`);
    expect(warm).toBeLessThan(s0);
    expect(b.salt.grains).toBeGreaterThan(warm);
    expect(e.grainSalt.grown).toBeGreaterThan(0);
    expect(b.salt.crust).toBe(0);
    expect(Math.abs(e.saltError())).toBeLessThan(1e-12 * salt0);
    expect(Math.abs(e.energyError())).toBeLessThan(1e-5);
  });
});

describe('M3c — test 54: salt into superheated water', () => {
  it('grains falling into water 4 K above T_sat set off bubbles at their cavities (air in their crevices) again and again, which grow to millimetres; budgets close', () => {
    const e = new Engine(scene({ box: { w: 0.06, h: 0.08, depth: 0.01 }, ambient: { p: 101.325, T: 20, rh: 0.5, g: 9.81 }, ops: [
      { op: 'fill', region: { rect: [0, 0, 0.06, 0.04] }, composition: { H2O: 1 }, phase: 'liquid', T: 104 },
      { op: 'grains', region: { rect: [0.028, 0.05, 0.032, 0.054] }, material: 'NaCl', d: 0.0005, T: 20 }] }), { insulated: true });
    const B = e.bubbles;
    let rmax = 0;
    while (e.time < 1.5) {
      e.step();
      for (let b = 0; b < B.count; b += 1) rmax = Math.max(rmax, B.r[b]);
    }
    console.log(`test 54: ${e.grainSalt.burst} bubbles from ${e.grains.count} grains, largest ${(rmax * 1000).toFixed(2)} mm; salt error ${e.saltError().toExponential(2)} kg, water error ${e.waterError().toExponential(2)} kg, energy error ${e.energyError().toExponential(2)} J`);
    /* Wie Kavitäten der Wand: jedes Korn immer wieder, solange das Wasser überhitzt ist — und die Blasen wachsen. */
    expect(e.grainSalt.burst).toBeGreaterThan(10 * e.grains.count);
    expect(rmax).toBeGreaterThan(2e-3);
    expect(Math.abs(e.saltError())).toBeLessThan(1e-15);
    expect(Math.abs(e.waterError())).toBeLessThan(1e-12);
    expect(Math.abs(e.energyError())).toBeLessThan(1e-6);
  });
});
