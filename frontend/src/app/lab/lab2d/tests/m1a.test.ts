/**
 * LABOR 2D (v2) — M1a: Wärme und Gas. Tore des Prompts: Test 2
 * (Wärmeleitung gegen erf), Test 15 (verschlossener Kasten: p0 steigt um
 * p0 ΔT/T), der Gasteil von Test 4 (Energie und Masse) und Test 16 (Zeit je
 * Stufe). Die zehn simulierten Minuten von Test 4 laufen in m1a.slow.test.ts.
 */

import { describe, expect, it } from 'vitest';

import { Engine } from '../engine/engine';
import { MOLAR } from '../engine/materials';
import { STAGES } from '../engine/stages';
import { GAS, H2O, N2, O2, T0 } from '../engine/units';
import { boilingScene, erf, scene, waterTolerance } from './scenes';

const sealed = { left: 'wall', right: 'wall', bottom: 'wall', top: 'wall' } as const;

/** Mittlere Gastemperatur (massengewichtet) und Gasmasse. */
function gasMean(e: Engine): { T: number; m: number; n: number } {
  const g = e.grid;
  let m = 0, mt = 0, n = 0;
  for (let c = 0; c < g.n; c += 1) {
    if (g.kind[c] !== GAS) continue;
    const mc = g.mg[N2 * g.n + c] + g.mg[O2 * g.n + c] + g.mg[H2O * g.n + c];
    m += mc;
    mt += mc * g.T[c];
    n += g.mg[N2 * g.n + c] / MOLAR[N2] + g.mg[O2 * g.n + c] / MOLAR[O2] + g.mg[H2O * g.n + c] / MOLAR[H2O];
  }
  return { T: mt / m, m, n };
}

describe('M1a — test 2: conduction', () => {
  it('a temperature step in a steel slab follows the erf solution within 2 %', () => {
    const e = new Engine(scene({
      box: { w: 0.2, h: 0.02, depth: 0.01 },
      sides: sealed,
      ops: [
        { op: 'solid', region: { rect: [0, 0, 0.1, 0.02] }, material: 'steel', T: 100 },
        { op: 'solid', region: { rect: [0.1, 0, 0.2, 0.02] }, material: 'steel', T: 20 }
      ]
    }), { insulated: true });
    const t = 20;
    while (e.time < t - 1e-9) e.step();
    /* Stahl 304 (Incropera A.1): α = k/(ρ c). */
    const alpha = 14.9 / (7900 * 477);
    const g = e.grid;
    const j = Math.floor(g.ny / 2);
    let worst = 0;
    for (let i = 0; i < g.nx; i += 1) {
      const x = (i + 0.5) * g.dx;
      const exact = T0 + 60 + 40 * erf((0.1 - x) / (2 * Math.sqrt(alpha * e.time)));
      worst = Math.max(worst, Math.abs(g.T[i + j * g.nx] - exact));
    }
    console.log(`test 2: largest deviation from erf after ${e.time.toFixed(2)} s: ${worst.toFixed(4)} K of an 80 K step (${(100 * worst / 80).toFixed(3)} %)`);
    expect(worst / 80).toBeLessThan(0.02);
    /* Insulated and closed: the energy stays. */
    expect(Math.abs(e.energyError())).toBeLessThan(1e-6 * 1e5);
  });
});

describe('M1a — test 15: sealed box', () => {
  it('heating a sealed box of dry air by a mean ΔT raises p0 by p0·ΔT/T within 1 %', () => {
    const e = new Engine(scene({
      box: { w: 0.1, h: 0.08, depth: 0.01 },
      ambient: { p: 101.325, T: 20, rh: 0, g: 9.81 },
      sides: sealed,
      ops: [{ op: 'hotplate', x: 0.05, y: 0, w: 0.06, h: 0.006, material: 'steel', mode: 'power', power: 20, on: true, T: 20 }]
    }), { insulated: true });
    const before = gasMean(e);
    const p0 = e.regions.p0[0];
    expect(e.regions.open[0]).toBe(0);
    while (e.time < 15) e.step();
    const after = gasMean(e);
    const p1 = e.regions.p0[0];
    const expected = p0 * (after.T - before.T) / before.T;
    const rise = p1 - p0;
    console.log(`test 15: mean ΔT = ${(after.T - before.T).toFixed(3)} K, p0 rose by ${rise.toFixed(2)} Pa, p0·ΔT/T = ${expected.toFixed(2)} Pa (${(100 * (rise / expected - 1)).toFixed(3)} %)`);
    expect(after.T - before.T).toBeGreaterThan(0.5);
    expect(Math.abs(rise / expected - 1)).toBeLessThan(0.01);
    /* The gas mass does not change in a sealed box. */
    expect(Math.abs(after.m / before.m - 1)).toBeLessThan(1e-12);
  });
});

describe('M1a — test 4, gas part: conservation', () => {
  it('sealed and insulated: ΔE equals ∫P dt within 0.5 %, water and air exact (60 s; 10 min in the slow suite)', () => {
    const e = new Engine(scene({
      box: { w: 0.08, h: 0.06, depth: 0.01 },
      ambient: { p: 101.325, T: 20, rh: 0.5, g: 9.81 },
      sides: sealed,
      ops: [{ op: 'hotplate', x: 0.04, y: 0, w: 0.04, h: 0.006, material: 'steel', mode: 'power', power: 10, on: true, T: 20 }]
    }), { insulated: true });
    const air0 = e.measureBudget().air;
    while (e.time < 60) e.step();
    const s = e.stats();
    const err = Math.abs(s.energyError);
    console.log(`test 4 (sealed, 60 s): ∫P dt = ${s.flows.heater.toFixed(2)} J, |ΔE − ∫P dt| = ${err.toExponential(3)} J (${(100 * err / s.flows.heater).toExponential(2)} %), water error ${s.waterError.toExponential(2)} kg`);
    expect(err / s.flows.heater).toBeLessThan(0.005);
    expect(Math.abs(s.waterError)).toBeLessThan(waterTolerance(e));
    expect(Math.abs(s.budget.air / air0 - 1)).toBeLessThan(1e-12);
    expect(s.flows.lossWalls).toBe(0);
  });

  it('open box: the budgets close including what escaped', () => {
    const e = new Engine(scene({
      box: { w: 0.08, h: 0.06, depth: 0.01 },
      ambient: { p: 101.325, T: 20, rh: 0.5, g: 9.81 },
      ops: [{ op: 'hotplate', x: 0.04, y: 0, w: 0.04, h: 0.006, material: 'steel', mode: 'power', power: 10, on: true, T: 20 }]
    }));
    const air0 = e.measureBudget().air;
    while (e.time < 30) e.step();
    const s = e.stats();
    const err = Math.abs(s.energyError);
    console.log(`test 4 (open, 30 s): heater ${s.flows.heater.toFixed(2)} J, walls ${s.flows.lossWalls.toFixed(3)} J, open-side conduction ${s.flows.lossOpen.toFixed(3)} J, escaped ${s.flows.escapedEnergy.toFixed(3)} J; error ${err.toExponential(3)} J, escaped air ${s.flows.escapedAir.toExponential(3)} kg`);
    expect(err / s.flows.heater).toBeLessThan(0.005);
    expect(Math.abs(s.budget.air / air0 - 1)).toBeLessThan(1e-9);
    expect(Math.abs(s.waterError)).toBeLessThan(waterTolerance(e));
  });
});

describe('M1a — test 16: time per stage', () => {
  it('reports milliseconds for every stage of the benchmark scene (boiling beaker, 2 mm)', () => {
    const e = new Engine(boilingScene('high'));
    for (let k = 0; k < 240; k += 1) e.step();
    const s = e.stats();
    const line = s.stages.map((t, k) => `${STAGES[k]} ${t.toFixed(2)}`).join(' · ');
    console.log(`test 16 (2 mm, ${s.nx}×${s.ny}, ${s.particles} particles): ${line} · step ${s.stepMs.toFixed(2)} ms · frame (2 steps) ${(2 * s.stepMs).toFixed(2)} ms`);
    expect(s.stages.every((t) => t >= 0)).toBe(true);
    expect(s.stepMs).toBeGreaterThan(0);
  });
});
