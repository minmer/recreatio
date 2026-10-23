/**
 * LABOR 2D (v2) — die langen Prüfungen von M1a und M1b
 * (`npm run test:lab2d:slow`): Test 4 über zehn simulierte Minuten (nur Gas,
 * dann mit Wasser) und Test 3 (Heizrate) nach dem Einschwingen der Platte.
 */

import { describe, expect, it } from 'vitest';

import { Engine } from '../engine/engine';
import { cpL, SOLIDS } from '../engine/materials';
import { scene, waterTolerance } from './scenes';

const sealed = { left: 'wall', right: 'wall', bottom: 'wall', top: 'wall' } as const;
/** Zeitgrenze je Lauf (ms): zehn simulierte Minuten brauchen auf dem Bezugsrechner bis zu 16 Minuten, wenn anderes nebenher läuft. */
const LONG = 45 * 60 * 1000;

const beakerOnPlate = (power: number, rh: number) => scene({
  box: { w: 0.10, h: 0.08, depth: 0.01 },
  ambient: { p: 101.325, T: 20, rh, g: 9.81 },
  sides: sealed,
  ops: [
    { op: 'hotplate', x: 0.05, y: 0, w: 0.06, h: 0.004, material: 'steel', mode: 'power', power, on: true, T: 20 },
    { op: 'beaker', x: 0.05, y: 0.004, w: 0.05, h: 0.05, wall: 0.002, material: 'glass', T: 20 },
    { op: 'fill', region: { rect: [0.027, 0.006, 0.073, 0.046] }, composition: { H2O: 1 }, phase: 'liquid', T: 20 }
  ]
});

describe('M1a/M1b — test 4 over ten simulated minutes', () => {
  it('sealed, insulated box of air with a heater: |ΔE − ∫P dt| below 0.5 % of ∫P dt, water exact', () => {
    const e = new Engine(scene({
      box: { w: 0.08, h: 0.06, depth: 0.01 },
      ambient: { p: 101.325, T: 20, rh: 0.5, g: 9.81 },
      sides: sealed,
      ops: [{ op: 'hotplate', x: 0.04, y: 0, w: 0.04, h: 0.006, material: 'steel', mode: 'power', power: 2, on: true, T: 20 }]
    }), { insulated: true });
    while (e.time < 600) e.step();
    const s = e.stats();
    console.log(`test 4 (air, 10 min): ∫P dt = ${s.flows.heater.toFixed(1)} J, error ${s.energyError.toExponential(3)} J (${(100 * Math.abs(s.energyError) / s.flows.heater).toExponential(2)} %), water ${s.waterError.toExponential(2)} kg, p0 ${(s.regions[0].p0 / 1000).toFixed(3)} kPa`);
    expect(Math.abs(s.energyError) / s.flows.heater).toBeLessThan(0.005);
    expect(Math.abs(s.waterError)).toBeLessThan(waterTolerance(e));
  }, LONG);

  it('sealed, insulated beaker of water on a hot plate: |ΔE − ∫P dt| below 0.5 % of ∫P dt, water exact', () => {
    const e = new Engine(beakerOnPlate(5, 0.5), { insulated: true });
    while (e.time < 600) e.step();
    const s = e.stats();
    console.log(`test 4 (water, 10 min): ∫P dt = ${s.flows.heater.toFixed(1)} J, error ${s.energyError.toExponential(3)} J (${(100 * Math.abs(s.energyError) / s.flows.heater).toExponential(2)} %), water ${s.waterError.toExponential(2)} kg, water ${(s.waterT - 273.15).toFixed(2)} °C`);
    expect(Math.abs(s.energyError) / s.flows.heater).toBeLessThan(0.005);
    expect(Math.abs(s.waterError)).toBeLessThan(waterTolerance(e));
  }, LONG);
});

describe('M1b — test 3: heating rate', () => {
  it('sealed, insulated, constant power below boiling: dT/dt = P/Σ(m c_p) within 5 % (water, plate, glass, air)', () => {
    const P = 10;
    const e = new Engine(beakerOnPlate(P, 0), { insulated: true });
    const g = e.grid;
    const samples: [number, number][] = [];
    while (e.time < 300) {
      e.step();
      if (e.time >= 180 && e.steps % 120 === 0) samples.push([e.time, e.waterTemperature().mean]);
    }
    /* Steigung der Wassertemperatur (kleinste Quadrate über 180–300 s, die Platte ist dann eingeschwungen: τ ≈ 60 s). */
    const n = samples.length;
    const mt = samples.reduce((a, [t]) => a + t, 0) / n;
    const mT = samples.reduce((a, [, T]) => a + T, 0) / n;
    const slope = samples.reduce((a, [t, T]) => a + (t - mt) * (T - mT), 0) / samples.reduce((a, [t]) => a + (t - mt) ** 2, 0);
    let C = 0;
    for (let p = 0; p < e.particles.count; p += 1) C += e.particles.mass[p] * cpL(e.particles.T[p]);
    /* Feststoffe: die Körper (Zlewka, Platte) mit ihren inneren Zellen — eine Wand quer durch zwei Zellen zählt dort ganz —, gemalte Bauten je Zelle. */
    let Cs = 0;
    let Cg = 0;
    for (let c = 0; c < g.n; c += 1) {
      if (g.solid[c] !== 0 && g.owner[c] === 0) { const s = SOLIDS[g.solid[c] - 1]; Cs += s.rho * s.cp * g.vCell; } else if (g.solid[c] === 0) Cg += e.gas.cap[c];
    }
    for (const b of e.bodies.list) if (!b.gone) for (let k = 0; k < b.ncell; k += 1) Cs += b.cellCap(k);
    const expected = P / (C + Cs + Cg);
    console.log(`test 3: Σ m c_p = ${(C + Cs + Cg).toFixed(2)} J/K (water ${C.toFixed(2)}, solids ${Cs.toFixed(2)}, air ${Cg.toFixed(3)}), dT/dt = ${slope.toFixed(5)} K/s, P/Σ m c_p = ${expected.toFixed(5)} K/s (${(100 * (slope / expected - 1)).toFixed(2)} %)`);
    expect(Math.abs(slope / expected - 1)).toBeLessThan(0.05);
  }, LONG);
});
